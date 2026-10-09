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
      minStockLevel,
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
    if (!["kg", "pcs", "rolls", "meters"].includes(unit)) {
      return res.status(400).json({
        success: false,
        message: "unit must be kg, pcs, rolls, or meters",
      });
    }

    const qty = quantity !== undefined ? Number(quantity) : 0;
    if (isNaN(qty) || qty < 0 || qty > MAX_QUANTITY) {
      return res.status(400).json({
        success: false,
        message: `quantity must be 0–${MAX_QUANTITY}`,
      });
    }

    const minLevel =
      minStockLevel !== undefined ? Number(minStockLevel) : 0;
    if (isNaN(minLevel) || minLevel < 0) {
      return res.status(400).json({
        success: false,
        message: "minStockLevel must be >= 0",
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
      name: name.trim().slice(0, 200),
      category,
      unit,
      sizeKg: size,
      quantity: qty,
      reservedQty: 0,
      minStockLevel: minLevel,
      notes: safeString(notes, 1000) || "",
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
              refType: null,
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
      minStockLevel,
      notes,
      isActive,
    } = req.body;

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, message: "name cannot be empty" });
      }
      item.name = name.trim().slice(0, 200);
    }
    if (category !== undefined) {
      if (!["Steel", "Tape", "Reel"].includes(category)) {
        return res.status(400).json({
          success: false,
          message: "category must be Steel, Tape, or Reel",
        });
      }
      item.category = category;
    }
    if (unit !== undefined) {
      if (!["kg", "pcs", "rolls", "meters"].includes(unit)) {
        return res.status(400).json({
          success: false,
          message: "unit must be kg, pcs, rolls, or meters",
        });
      }
      item.unit = unit;
    }
    if (sizeKg !== undefined) {
      if (sizeKg === null || sizeKg === "") {
        item.sizeKg = null;
      } else {
        const size = Number(sizeKg);
        if (isNaN(size) || size < 0) {
          return res.status(400).json({
            success: false,
            message: "sizeKg must be a non-negative number",
          });
        }
        item.sizeKg = size;
      }
    }
    if (minStockLevel !== undefined) {
      const minLevel = Number(minStockLevel);
      if (isNaN(minLevel) || minLevel < 0) {
        return res.status(400).json({
          success: false,
          message: "minStockLevel must be >= 0",
        });
      }
      item.minStockLevel = minLevel;
    }
    if (notes !== undefined) {
      item.notes = safeString(notes, 1000) || "";
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
      refType: null,
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
      { name: "Steel Wire 0.5mm", category: "Steel", unit: "kg", sizeKg: 0.5, minStockLevel: 50 },
      { name: "Steel Wire 0.7mm", category: "Steel", unit: "kg", sizeKg: 0.7, minStockLevel: 50 },
      { name: "Steel Wire 1.0mm", category: "Steel", unit: "kg", sizeKg: 1.0, minStockLevel: 30 },
      { name: "Binding Tape", category: "Tape", unit: "rolls", sizeKg: null, minStockLevel: 20 },
      { name: "Wooden Reel", category: "Reel", unit: "pcs", sizeKg: null, minStockLevel: 10 },
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
      if (!["Pending", "Received", "Cancelled", "Partial"].includes(status)) {
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
      purchaseDate,
      expectedDate,
      notes,
      paymentMode,
      paidAmount,
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
    if (!sup || !sup.isActive) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
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

    const paid = paidAmount !== undefined ? Number(paidAmount) : 0;
    if (isNaN(paid) || paid < 0) {
      return res.status(400).json({ success: false, message: "paidAmount must be >= 0" });
    }

    const purchaseUnit = unit || mat.unit;
    if (!["kg", "pcs", "rolls", "meters"].includes(purchaseUnit)) {
      return res.status(400).json({
        success: false,
        message: "unit must be kg, pcs, rolls, or meters",
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
      paidAmount: Math.min(paid, total),
      invoiceNumber: safeString(invoiceNumber, 100) || null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      notes: safeString(notes, 1000) || "",
      paymentMode: paymentMode || null,
      status: "Pending",
      isActive: true,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
      payments: paid > 0
        ? [
            {
              amount: Math.min(paid, total),
              mode: paymentMode || "Cash",
              date: new Date(),
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
      purchaseDate,
      expectedDate,
      notes,
      paymentMode,
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
      if (purchase.paidAmount > total) {
        purchase.paidAmount = total;
      }
    } else if (quantity !== undefined || unitPrice !== undefined) {
      const recalc =
        Math.round(purchase.quantity * purchase.unitPrice * 100) / 100;
      purchase.totalAmount = recalc;
      if (purchase.paidAmount > recalc) {
        purchase.paidAmount = recalc;
      }
    }

    if (invoiceNumber !== undefined) {
      purchase.invoiceNumber = safeString(invoiceNumber, 100) || null;
    }
    if (purchaseDate !== undefined) {
      purchase.purchaseDate = purchaseDate ? new Date(purchaseDate) : purchase.purchaseDate;
    }
    if (expectedDate !== undefined) {
      purchase.expectedDate = expectedDate ? new Date(expectedDate) : null;
    }
    if (notes !== undefined) {
      purchase.notes = safeString(notes, 1000) || "";
    }
    if (paymentMode !== undefined) {
      if (paymentMode && !VALID_PAYMENT_MODES.includes(paymentMode)) {
        return res.status(400).json({
          success: false,
          message: `paymentMode must be one of: ${VALID_PAYMENT_MODES.join(", ")}`,
        });
      }
      purchase.paymentMode = paymentMode || null;
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

    const { amount, mode, date, notes } = req.body;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be a positive number",
      });
    }

    if (!mode || !VALID_PAYMENT_MODES.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: `mode must be one of: ${VALID_PAYMENT_MODES.join(", ")}`,
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

    const remaining = Math.round((purchase.totalAmount - purchase.paidAmount) * 100) / 100;
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
      mode,
      date: date ? new Date(date) : new Date(),
      notes: safeString(notes, 500) || null,
      by: req.user?._id || null,
    });

    purchase.paidAmount =
      Math.round((purchase.paidAmount + numAmount) * 100) / 100;
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

    const { paymentIndex } = req.body;
    const idx = Number(paymentIndex);
    if (isNaN(idx) || idx < 0 || !Number.isInteger(idx)) {
      return res.status(400).json({
        success: false,
        message: "paymentIndex must be a non-negative integer",
      });
    }

    const purchase = await RawPurchase.findById(req.params.id);
    if (!purchase || !purchase.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (!Array.isArray(purchase.payments) || idx >= purchase.payments.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment index",
      });
    }

    const removed = purchase.payments[idx];
    purchase.payments.splice(idx, 1);
    purchase.paidAmount =
      Math.round((purchase.paidAmount - removed.amount) * 100) / 100;
    if (purchase.paidAmount < 0) purchase.paidAmount = 0;

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
