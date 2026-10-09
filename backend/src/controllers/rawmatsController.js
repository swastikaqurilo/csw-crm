const mongoose = require("mongoose");
const { RawStock, RawPurchase } = require("../models/RawMaterial");
const Contact = require("../models/Contacts");

const MAX_LIMIT = 200;
const MAX_MOVEMENT_LOG = 200;
const MAX_QUANTITY = 1e8;

const VALID_PAYMENT_MODES = [
  "Bank Transfer", "UPI", "Cheque", "Cash", "NEFT", "RTGS", "Other",
];

const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 500) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : "";
};

const normalizePhone = (v, max = 20) => {
  const raw = safeString(v, max);
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.replace(/\D/g, "").length < 7) return { error: true };
  return cleaned;
};

const handleError = (res, error, fallback) => {
  console.error(`[${fallback}]`, error);

  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      message: errors[0]?.message || "Validation failed",
      errors,
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A material with that name already exists.",
    });
  }

  return res.status(500).json({ success: false, message: fallback });
};

const getAllRawStock = async (req, res) => {
  try {
    const { category, search } = req.query;

    const query = { isActive: true };
    if (category) {
      if (!["Steel", "Tape", "Reel"].includes(category)) {
        return res.status(400).json({
          success: false,
          message: "category must be Steel, Tape, or Reel",
        });
      }
      query.category = category;
    }
    if (search && typeof search === "string" && search.trim()) {
      const safe = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.name = { $regex: safe, $options: "i" };
    }

    const items = await RawStock.find(query)
      .sort({ category: 1, sizeKg: 1, name: 1 })
      .limit(MAX_LIMIT);

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch raw stock");
  }
};

const getRawStockById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const item = await RawStock.findById(req.params.id);
    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    handleError(res, error, "Failed to fetch raw stock");
  }
};

const createRawStock = async (req, res) => {
  try {
    const {
      name,
      category,
      unit,
      sizeKg,
      quantity,
      reorderLevel,
      criticalLevel,
      notes,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "name is required" });
    }
    if (!["Steel", "Tape", "Reel"].includes(category)) {
      return res.status(400).json({
        success: false,
        message: "category must be Steel, Tape, or Reel",
      });
    }
    if (!["Kg", "Box", "Piece"].includes(unit)) {
      return res.status(400).json({
        success: false,
        message: "unit must be Kg, Box, or Piece",
      });
    }

    const qty = quantity !== undefined ? Number(quantity) : 0;
    if (isNaN(qty) || qty < 0 || qty > MAX_QUANTITY) {
      return res.status(400).json({
        success: false,
        message: `quantity must be 0–${MAX_QUANTITY}`,
      });
    }

    const reorder =
      reorderLevel !== undefined ? Number(reorderLevel) : 0;
    if (isNaN(reorder) || reorder < 0) {
      return res.status(400).json({
        success: false,
        message: "reorderLevel must be >= 0",
      });
    }
    const critical =
      criticalLevel !== undefined ? Number(criticalLevel) : 0;
    if (isNaN(critical) || critical < 0) {
      return res.status(400).json({
        success: false,
        message: "criticalLevel must be >= 0",
      });
    }
    if (critical > reorder) {
      return res.status(400).json({
        success: false,
        message: "criticalLevel cannot be greater than reorderLevel",
      });
    }

    const size =
      sizeKg !== undefined && sizeKg !== null && sizeKg !== ""
        ? Number(sizeKg)
        : null;
    if (size !== null && (isNaN(size) || size < 0)) {
      return res.status(400).json({
        success: false,
        message: "sizeKg must be a non-negative number",
      });
    }

    const item = await RawStock.create({
      name: name.trim().slice(0, 80),
      category,
      unit,
      sizeKg: size,
      quantity: qty,
      reservedQty: 0,
      reorderLevel: reorder,
      criticalLevel: critical,
      notes: safeString(notes, 5000) || "",
      isActive: true,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
      movementLog: qty
        ? [
            {
              type: "in",
              quantity: qty,
              unitAtTime: unit,
              beforeQty: 0,
              afterQty: qty,
              reason: "Initial stock",
              notes: null,
              refType: "Manual",
              refId: null,
              refLabel: null,
              by: req.user?._id || null,
              at: new Date(),
            },
          ]
        : [],
    });

    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    handleError(res, error, "Failed to create raw stock");
  }
};

const updateRawStock = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const item = await RawStock.findById(req.params.id);
    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const {
      name,
      category,
      unit,
      sizeKg,
      reorderLevel,
      criticalLevel,
      notes,
      isActive,
    } = req.body;

    // name, category, unit, sizeKg are immutable after create (enforced by model)
    if (
      name !== undefined ||
      category !== undefined ||
      unit !== undefined ||
      sizeKg !== undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "name, category, unit, and sizeKg cannot be changed after creation",
      });
    }
    if (reorderLevel !== undefined) {
      const reorder = Number(reorderLevel);
      if (isNaN(reorder) || reorder < 0) {
        return res.status(400).json({
          success: false,
          message: "reorderLevel must be >= 0",
        });
      }
      item.reorderLevel = reorder;
    }
    if (criticalLevel !== undefined) {
      const critical = Number(criticalLevel);
      if (isNaN(critical) || critical < 0) {
        return res.status(400).json({
          success: false,
          message: "criticalLevel must be >= 0",
        });
      }
      item.criticalLevel = critical;
    }
    const finalReorder = item.reorderLevel ?? 0;
    const finalCritical = item.criticalLevel ?? 0;
    if (finalCritical > finalReorder) {
      return res.status(400).json({
        success: false,
        message: "criticalLevel cannot be greater than reorderLevel",
      });
    }
    if (notes !== undefined) {
      item.notes = safeString(notes, 5000) || "";
    }
    if (isActive !== undefined) {
      item.isActive = Boolean(isActive);
    }

    if (req.user?._id) item.updatedBy = req.user._id;
    await item.save();

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    handleError(res, error, "Failed to update raw stock");
  }
};

const adjustRawStock = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const { type, quantity, reason, notes, overrideReserved } = req.body;

    if (!["in", "out", "adjustment"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type must be "in", "out", or "adjustment"',
      });
    }

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0 || numQty > MAX_QUANTITY) {
      return res.status(400).json({
        success: false,
        message: `quantity must be a positive number up to ${MAX_QUANTITY}`,
      });
    }

    const item = await RawStock.findById(req.params.id);
    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const before = Number(item.quantity) || 0;
    const reservedBefore = Number(item.reservedQty) || 0;
    let after = before;
    let reservedAfter = reservedBefore;

    if (type === "in") {
      after = before + numQty;
    } else if (type === "out") {
      const available = before - reservedBefore;
      if (!overrideReserved && numQty > available) {
        return res.status(400).json({
          success: false,
          message: `Insufficient available stock. Available: ${available}, requested: ${numQty}`,
          available,
          reserved: reservedBefore,
        });
      }
      if (overrideReserved && numQty > before) {
        return res.status(400).json({
          success: false,
          message: `Insufficient total stock. On hand: ${before}, requested: ${numQty}`,
        });
      }
      after = before - numQty;
      if (overrideReserved && reservedBefore > 0) {
        const reduceBy = Math.min(reservedBefore, numQty);
        reservedAfter = reservedBefore - reduceBy;
      }
    } else if (type === "adjustment") {
      after = numQty;
      if (after < reservedBefore) {
        reservedAfter = after;
      }
    }

    if (after < 0 || after > MAX_QUANTITY) {
      return res.status(400).json({
        success: false,
        message: `Resulting quantity ${after} is out of allowed range`,
      });
    }

    const logEntry = {
      type,
      quantity: type === "adjustment" ? Math.abs(after - before) : numQty,
      unitAtTime: item.unit,
      beforeQty: before,
      afterQty: after,
      reason: safeString(reason, 200) || (type === "adjustment" ? "Manual adjustment" : null),
      notes: safeString(notes, 500) || null,
      refType: "Manual",
      refId: null,
      refLabel: null,
      by: req.user?._id || null,
      at: new Date(),
    };

    // Conditional update — fails if concurrent change modified quantity/reserved
    const filter = {
      _id: item._id,
      isActive: true,
      quantity: before,
      reservedQty: reservedBefore,
    };

    const setFields = {
      quantity: after,
      reservedQty: reservedAfter,
      updatedBy: req.user?._id || null,
    };
    if (type === "in") setFields.lastReceivedAt = new Date();
    if (type === "out") setFields.lastIssuedAt = new Date();

    const result = await RawStock.updateOne(
      filter,
      [
        {
          $set: {
            ...setFields,
            movementLog: {
              $slice: [
                {
                  $concatArrays: [
                    { $ifNull: ["$movementLog", []] },
                    [logEntry],
                  ],
                },
                -MAX_MOVEMENT_LOG,
              ],
            },
          },
        },
      ],
      { updatePipeline: true }
    );

    if (result.modifiedCount !== 1) {
      return res.status(409).json({
        success: false,
        code: "STOCK_CHANGED",
        message: "Stock changed while adjusting. Please retry.",
      });
    }

    const updated = await RawStock.findById(item._id);

    return res.status(200).json({
      success: true,
      data: updated,
      adjustment: {
        type,
        quantity: numQty,
        before,
        after,
        reservedBefore,
        reservedAfter,
      },
    });
  } catch (error) {
    handleError(res, error, "Failed to adjust raw stock");
  }
};

const getRawStockMovements = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const item = await RawStock.findById(req.params.id)
      .select("name unit movementLog isActive")
      .lean();

    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const log = Array.isArray(item.movementLog) ? item.movementLog : [];
    const limit = Math.min(
      Number(req.query.limit) || 50,
      MAX_MOVEMENT_LOG
    );

    return res.status(200).json({
      success: true,
      data: {
        name: item.name,
        unit: item.unit,
        movements: log.slice(-limit).reverse(),
      },
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch movements");
  }
};

const seedDefaultMaterials = async (req, res) => {
  try {
    const defaults = [
      { name: "Steel Wire", category: "Steel", unit: "Kg", sizeKg: null, reorderLevel: 50, criticalLevel: 10 },
      { name: "Binding Tape", category: "Tape", unit: "Box", sizeKg: null, reorderLevel: 20, criticalLevel: 5 },
      { name: "Wooden Reel 2kg", category: "Reel", unit: "Piece", sizeKg: 2, reorderLevel: 10, criticalLevel: 3 },
      { name: "Wooden Reel 5kg", category: "Reel", unit: "Piece", sizeKg: 5, reorderLevel: 10, criticalLevel: 3 },
      { name: "Wooden Reel 8kg", category: "Reel", unit: "Piece", sizeKg: 8, reorderLevel: 10, criticalLevel: 3 },
      { name: "Wooden Reel 10kg", category: "Reel", unit: "Piece", sizeKg: 10, reorderLevel: 10, criticalLevel: 3 },
    ];

    const created = [];
    for (const d of defaults) {
      const exists = await RawStock.findOne({ name: d.name, isActive: true });
      if (!exists) {
        const item = await RawStock.create({
          ...d,
          quantity: 0,
          reservedQty: 0,
          notes: "Seeded default",
          isActive: true,
          createdBy: req.user?._id || null,
          updatedBy: req.user?._id || null,
          movementLog: [],
        });
        created.push(item);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Seeded ${created.length} materials`,
      data: created,
    });
  } catch (error) {
    handleError(res, error, "Failed to seed materials");
  }
};

// ─── Purchases ───────────────────────────────────────────────────────────────

const getAllPurchases = async (req, res) => {
  try {
    const { status, material, supplier, search } = req.query;
    const query = { isActive: true };

    if (status) {
      if (!["Pending", "Received", "Cancelled"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter",
        });
      }
      query.status = status;
    }
    if (material && isValidId(material)) query.material = material;
    if (supplier && isValidId(supplier)) query.supplier = supplier;

    if (search && typeof search === "string" && search.trim()) {
      const safe = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { purchaseNumber: { $regex: safe, $options: "i" } },
        { invoiceNumber: { $regex: safe, $options: "i" } },
        { notes: { $regex: safe, $options: "i" } },
      ];
    }

    const items = await RawPurchase.find(query)
      .populate("material", "name category unit sizeKg")
      .populate("supplier", "name company phone")
      .sort({ createdAt: -1 })
      .limit(MAX_LIMIT);

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch purchases");
  }
};

const getPurchaseById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const item = await RawPurchase.findById(req.params.id)
      .populate("material", "name category unit sizeKg quantity")
      .populate("supplier", "name company phone email");

    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    handleError(res, error, "Failed to fetch purchase");
  }
};

const createPurchase = async (req, res) => {
  try {
    const {
      material,
      supplier,
      quantity,
      unit,
      unitPrice,
      totalAmount,
      invoiceNumber,
      orderedAt,
      expectedAt,
      notes,
      paymentMode,
      amountPaid,
    } = req.body;

    if (!isValidId(material)) {
      return res.status(400).json({ success: false, message: "Valid material ID required" });
    }
    if (!isValidId(supplier)) {
      return res.status(400).json({ success: false, message: "Valid supplier ID required" });
    }

    const mat = await RawStock.findById(material);
    if (!mat || !mat.isActive) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    const sup = await Contact.findById(supplier);
    if (!sup || sup.status !== "active") {
      return res.status(404).json({ success: false, message: "Supplier not found or inactive" });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0 || qty > MAX_QUANTITY) {
      return res.status(400).json({
        success: false,
        message: `quantity must be positive up to ${MAX_QUANTITY}`,
      });
    }

    const price = Number(unitPrice);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ success: false, message: "unitPrice must be >= 0" });
    }

    let total = totalAmount !== undefined ? Number(totalAmount) : qty * price;
    if (isNaN(total) || total < 0) {
      return res.status(400).json({ success: false, message: "totalAmount must be >= 0" });
    }
    total = Math.round(total * 100) / 100;

    const paid = amountPaid !== undefined ? Number(amountPaid) : 0;
    if (isNaN(paid) || paid < 0) {
      return res.status(400).json({ success: false, message: "amountPaid must be >= 0" });
    }

    const purchaseUnit = unit || mat.unit;
    if (!["Kg", "Box", "Piece"].includes(purchaseUnit)) {
      return res.status(400).json({
        success: false,
        message: "unit must be Kg, Box, or Piece",
      });
    }

    if (paymentMode && !VALID_PAYMENT_MODES.includes(paymentMode)) {
      return res.status(400).json({
        success: false,
        message: `paymentMode must be one of: ${VALID_PAYMENT_MODES.join(", ")}`,
      });
    }

    const purchase = await RawPurchase.create({
      material,
      supplier,
      quantity: qty,
      unit: purchaseUnit,
      unitPrice: price,
      totalAmount: total,
      amountPaid: Math.min(paid, total),
      invoiceNumber: safeString(invoiceNumber, 60) || null,
      orderedAt: orderedAt ? new Date(orderedAt) : new Date(),
      expectedAt: expectedAt ? new Date(expectedAt) : null,
      notes: safeString(notes, 1000) || "",
      status: "Pending",
      isActive: true,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
      payments: paid > 0
        ? [
            {
              amount: Math.min(paid, total),
              method: (paymentMode && VALID_PAYMENT_MODES.includes(paymentMode))
                ? paymentMode
                : "Cash",
              paidAt: new Date(),
              notes: "Initial payment",
              by: req.user?._id || null,
            },
          ]
        : [],
    });

    const populated = await RawPurchase.findById(purchase._id)
      .populate("material", "name category unit sizeKg")
      .populate("supplier", "name company phone email");

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    handleError(res, error, "Failed to create purchase");
  }
};

const updatePurchase = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const purchase = await RawPurchase.findById(req.params.id);
    if (!purchase || !purchase.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (purchase.status === "Received") {
      return res.status(400).json({
        success: false,
        message: "Cannot update a received purchase",
      });
    }
    if (purchase.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot update a cancelled purchase",
      });
    }

    const {
      quantity,
      unitPrice,
      totalAmount,
      invoiceNumber,
      orderedAt,
      expectedAt,
      notes,
    } = req.body;

    if (quantity !== undefined) {
      const qty = Number(quantity);
      if (isNaN(qty) || qty <= 0 || qty > MAX_QUANTITY) {
        return res.status(400).json({
          success: false,
          message: `quantity must be positive up to ${MAX_QUANTITY}`,
        });
      }
      purchase.quantity = qty;
    }
    if (unitPrice !== undefined) {
      const price = Number(unitPrice);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ success: false, message: "unitPrice must be >= 0" });
      }
      purchase.unitPrice = price;
    }
    if (totalAmount !== undefined) {
      let total = Number(totalAmount);
      if (isNaN(total) || total < 0) {
        return res.status(400).json({ success: false, message: "totalAmount must be >= 0" });
      }
      total = Math.round(total * 100) / 100;
      purchase.totalAmount = total;
      if (purchase.amountPaid > total) {
        purchase.amountPaid = total;
      }
    } else if (quantity !== undefined || unitPrice !== undefined) {
      const recalc =
        Math.round(purchase.quantity * purchase.unitPrice * 100) / 100;
      purchase.totalAmount = recalc;
      if (purchase.amountPaid > recalc) {
        purchase.amountPaid = recalc;
      }
    }

    if (invoiceNumber !== undefined) {
      purchase.invoiceNumber = safeString(invoiceNumber, 60) || null;
    }
    if (orderedAt !== undefined) {
      purchase.orderedAt = orderedAt ? new Date(orderedAt) : purchase.orderedAt;
    }
    if (expectedAt !== undefined) {
      purchase.expectedAt = expectedAt ? new Date(expectedAt) : null;
    }
    if (notes !== undefined) {
      purchase.notes = safeString(notes, 1000) || "";
    }

    if (req.user?._id) purchase.updatedBy = req.user._id;
    await purchase.save();

    const populated = await RawPurchase.findById(purchase._id)
      .populate("material", "name category unit sizeKg")
      .populate("supplier", "name company phone email");

    return res.status(200).json({ success: true, data: populated });
  } catch (error) {
    handleError(res, error, "Failed to update purchase");
  }
};

const receivePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    let populated = null;

    await session.withTransaction(async () => {
      const purchase = await RawPurchase.findOne({
        _id: req.params.id,
        isActive: true,
        status: "Pending",
      })
        .populate("material")
        .session(session);

      if (!purchase) {
        const existing = await RawPurchase.findById(req.params.id).session(session);
        if (!existing || !existing.isActive) {
          const err = new Error("Purchase not found");
          err.status = 404;
          throw err;
        }
        const err = new Error(
          `Cannot receive a purchase in status "${existing.status}".`
        );
        err.status = 400;
        throw err;
      }

      if (!purchase.material?._id) {
        const err = new Error("Purchase has no linked material");
        err.status = 400;
        throw err;
      }

      purchase.status = "Received";
      purchase.receivedAt = new Date();
      purchase.updatedBy = req.user?._id || null;
      await purchase.save({ session });

      const materialId = purchase.material._id;
      const qty = Number(purchase.quantity);

      const result = await RawStock.updateOne(
        { _id: materialId, isActive: true },
        [
          {
            $set: {
              quantity: { $add: ["$quantity", qty] },
              lastReceivedAt: "$$NOW",
              movementLog: {
                $slice: [
                  {
                    $concatArrays: [
                      { $ifNull: ["$movementLog", []] },
                      [
                        {
                          type: "purchase-received",
                          quantity: qty,
                          unitAtTime: purchase.unit,
                          beforeQty: "$quantity",
                          afterQty: { $add: ["$quantity", qty] },
                          reason: "Purchase received",
                          notes: null,
                          refType: "Purchase",
                          refId: purchase._id,
                          refLabel: purchase.purchaseNumber || purchase._id.toString().slice(-8),
                          by: req.user?._id || null,
                          at: "$$NOW",
                        },
                      ],
                    ],
                  },
                  -MAX_MOVEMENT_LOG,
                ],
              },
            },
          },
        ],
        { session, updatePipeline: true }
      );

      if (result.modifiedCount !== 1) {
        const err = new Error(
          "Material not found or inactive — purchase was not received. Please try again."
        );
        err.status = 500;
        throw err;
      }
    });

    populated = await RawPurchase.findById(req.params.id)
      .populate("material", "name category unit sizeKg quantity")
      .populate("supplier", "name company phone email");

    return res.status(200).json({
      success: true,
      message: "Purchase received and stock updated",
      data: populated,
    });
  } catch (error) {
    if (error.status === 400 || error.status === 404 || error.status === 500) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    handleError(res, error, "Failed to receive purchase");
  } finally {
    await session.endSession();
  }
};


const cancelPurchase = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const purchase = await RawPurchase.findById(req.params.id);
    if (!purchase || !purchase.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (purchase.status === "Received") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a received purchase — reverse stock first if needed",
      });
    }
    if (purchase.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Purchase is already cancelled",
      });
    }

    purchase.status = "Cancelled";
    purchase.updatedBy = req.user?._id || null;
    await purchase.save();

    const populated = await RawPurchase.findById(purchase._id)
      .populate("material", "name category unit sizeKg")
      .populate("supplier", "name company phone email");

    return res.status(200).json({
      success: true,
      message: "Purchase cancelled",
      data: populated,
    });
  } catch (error) {
    handleError(res, error, "Failed to cancel purchase");
  }
};

const deletePurchase = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const purchase = await RawPurchase.findById(req.params.id);
    if (!purchase || !purchase.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (purchase.status === "Received") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete a received purchase",
      });
    }

    purchase.isActive = false;
    purchase.updatedBy = req.user?._id || null;
    await purchase.save();

    return res.status(200).json({
      success: true,
      message: "Purchase deleted",
    });
  } catch (error) {
    handleError(res, error, "Failed to delete purchase");
  }
};

const recordPurchasePayment = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const { amount, method, mode, paidAt, date, notes } = req.body;
    const paymentMethod = method || mode;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be a positive number",
      });
    }

    if (!paymentMethod || !VALID_PAYMENT_MODES.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: `method must be one of: ${VALID_PAYMENT_MODES.join(", ")}`,
      });
    }

    const purchase = await RawPurchase.findById(req.params.id);
    if (!purchase || !purchase.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (purchase.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot record payment on a cancelled purchase",
      });
    }

    const remaining = Math.round((purchase.totalAmount - purchase.amountPaid) * 100) / 100;
    if (numAmount > remaining + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Payment exceeds remaining balance. Remaining: ${remaining}`,
        remaining,
      });
    }

    if (!Array.isArray(purchase.payments)) purchase.payments = [];
    purchase.payments.push({
      amount: numAmount,
      method: paymentMethod,
      paidAt: (paidAt || date) ? new Date(paidAt || date) : new Date(),
      notes: safeString(notes, 500) || null,
      by: req.user?._id || null,
    });

    // amountPaid / paymentStatus recomputed by model pre-save from payments[]
    if (req.user?._id) purchase.updatedBy = req.user._id;
    await purchase.save();

    const populated = await RawPurchase.findById(purchase._id)
      .populate("material", "name category unit sizeKg")
      .populate("supplier", "name company phone email");

    return res.status(200).json({
      success: true,
      message: "Payment recorded",
      data: populated,
    });
  } catch (error) {
    handleError(res, error, "Failed to record payment");
  }
};

const deletePurchasePayment = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    if (!isValidId(req.params.paymentId)) {
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    const purchase = await RawPurchase.findById(req.params.id);
    if (!purchase || !purchase.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const beforeLen = (purchase.payments || []).length;
    purchase.payments = (purchase.payments || []).filter(
      (p) => String(p._id) !== String(req.params.paymentId)
    );
    if (purchase.payments.length === beforeLen) {
      return res.status(404).json({
        success: false,
        message: "Payment not found on this purchase",
      });
    }

    // amountPaid / paymentStatus recomputed by model pre-save from payments[]
    if (req.user?._id) purchase.updatedBy = req.user._id;
    await purchase.save();

    const populated = await RawPurchase.findById(purchase._id)
      .populate("material", "name category unit sizeKg")
      .populate("supplier", "name company phone email");

    return res.status(200).json({
      success: true,
      message: "Payment removed",
      data: populated,
    });
  } catch (error) {
    handleError(res, error, "Failed to delete payment");
  }
};

module.exports = {
  getAllRawStock,
  getRawStockById,
  createRawStock,
  updateRawStock,
  adjustRawStock,
  getRawStockMovements,
  seedDefaultMaterials,

  getAllPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  receivePurchase,
  cancelPurchase,
  deletePurchase,
  recordPurchasePayment,
  deletePurchasePayment,
};