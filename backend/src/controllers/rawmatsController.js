const mongoose = require("mongoose");
const { RawStock, RawPurchase } = require("../models/RawMaterial");
const Contact = require("../models/Contacts");

const MAX_LIMIT = 200;
const MAX_MOVEMENT_LOG = 200;
const MAX_QUANTITY = 1e8;

const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 500) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : "";
};

// ✅ NEW — normalize + validate a phone number string
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

/* -------- LIST -------- */
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

/* -------- GET ONE -------- */
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

/* -------- CREATE -------- */
const createRawStock = async (req, res) => {
  try {
    const {
      category,
      name,
      sizeKg,
      unit,
      reorderLevel = 0,
      criticalLevel = 0,
      notes,
    } = req.body;

    if (!["Steel", "Tape", "Reel"].includes(category)) {
      return res.status(400).json({
        success: false,
        message: "category must be Steel, Tape, or Reel",
      });
    }

    const cleanName = safeString(name, 80);
    if (!cleanName) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const allowedUnits = { Steel: "Kg", Tape: "Box", Reel: "Piece" };
    if (unit !== allowedUnits[category]) {
      return res.status(400).json({
        success: false,
        message: `${category} must use unit "${allowedUnits[category]}"`,
      });
    }

    const numReorder = Number(reorderLevel) || 0;
    const numCritical = Number(criticalLevel) || 0;
    if (numCritical > numReorder) {
      return res.status(400).json({
        success: false,
        message: "Critical level cannot be greater than reorder level",
      });
    }

    const payload = {
      category,
      name: cleanName,
      unit,
      reorderLevel: numReorder,
      criticalLevel: numCritical,
      notes: safeString(notes, 5000) || undefined,
      createdBy: req.user?._id || null,
    };

    if (category === "Reel") {
      const n = Number(sizeKg);
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({
          success: false,
          message: "Reel size (kg) must be greater than 0",
        });
      }
      payload.sizeKg = n;
      if (!/reel/i.test(cleanName)) {
        payload.name = `Reel ${n}kg`;
      }
    }

    const item = await RawStock.create(payload);
    return res.status(201).json({
      success: true,
      message: "Raw material added",
      data: item,
    });
  } catch (error) {
    handleError(res, error, "Failed to create raw stock");
  }
};

/* -------- UPDATE -------- */
const updateRawStock = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const item = await RawStock.findById(req.params.id);
    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const locked = ["category", "name", "sizeKg", "unit", "quantity", "movementLog"];
    const attempted = locked.filter((f) => req.body[f] !== undefined);
    if (attempted.length > 0) {
      return res.status(400).json({
        success: false,
        message: `These fields cannot be edited here: ${attempted.join(", ")}`,
      });
    }

    if (req.body.reorderLevel !== undefined) {
      const n = Number(req.body.reorderLevel);
      if (!Number.isFinite(n) || n < 0 || n > MAX_QUANTITY) {
        return res.status(400).json({ success: false, message: "Invalid reorderLevel" });
      }
      item.reorderLevel = n;
    }
    if (req.body.criticalLevel !== undefined) {
      const n = Number(req.body.criticalLevel);
      if (!Number.isFinite(n) || n < 0 || n > MAX_QUANTITY) {
        return res.status(400).json({ success: false, message: "Invalid criticalLevel" });
      }
      item.criticalLevel = n;
    }

    if (req.body.reservedQty !== undefined) {
      const n = Number(req.body.reservedQty);
      if (!Number.isFinite(n) || n < 0 || n > MAX_QUANTITY) {
        return res.status(400).json({ success: false, message: "Invalid reservedQty" });
      }
      if (n > Number(item.quantity || 0)) {
        return res.status(400).json({
          success: false,
          message: `Cannot reserve more than available (${item.quantity} ${item.unit})`,
        });
      }
      item.reservedQty = n;
    }

    if (req.body.warehouse !== undefined) {
      item.warehouse = safeString(req.body.warehouse, 100) || "Main";
    }
    if (req.body.notes !== undefined) {
      item.notes = safeString(req.body.notes, 5000) || undefined;
    }

    if (Number(item.criticalLevel) > Number(item.reorderLevel)) {
      return res.status(400).json({
        success: false,
        message: "Critical level cannot be greater than reorder level",
      });
    }

    if (req.user?._id) item.updatedBy = req.user._id;
    await item.save();

    return res.status(200).json({
      success: true,
      message: "Raw stock updated",
      data: item,
    });
  } catch (error) {
    handleError(res, error, "Failed to update raw stock");
  }
};

/* -------- ADJUST -------- */
const adjustRawStock = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const { type, quantity, reason, notes, allowReserved = false } = req.body;

    if (!["in", "out", "adjustment"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "type must be one of: in, out, adjustment",
      });
    }

    const numQty = Number(quantity);
    if (!Number.isFinite(numQty) || numQty < 0 || numQty > MAX_QUANTITY) {
      return res.status(400).json({
        success: false,
        message: `Quantity must be between 0 and ${MAX_QUANTITY}`,
      });
    }

    const item = await RawStock.findById(req.params.id);
    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const before = Number(item.quantity || 0);
    const reservedBefore = Number(item.reservedQty || 0);
    const freeBefore = Math.max(before - reservedBefore, 0);

    let after;
    let reservedAfter = reservedBefore;
    let usedFromReserved = 0;
    let overrideReserved = false;

    if (type === "in") {
      if (numQty <= 0) {
        return res.status(400).json({ success: false, message: "Quantity must be > 0" });
      }
      after = before + numQty;
    } else if (type === "out") {
      if (numQty <= 0) {
        return res.status(400).json({ success: false, message: "Quantity must be > 0" });
      }

      // Can't issue more than total stock
      if (numQty > before) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${before} ${item.unit}`,
        });
      }

      // Does this issue dip into reserved stock?
      if (numQty > freeBefore) {
        usedFromReserved = numQty - freeBefore;

        // Permission required
        if (!allowReserved) {
          return res.status(409).json({
            success: false,
            code: "RESERVED_CONFLICT",
            message: `This issue uses ${usedFromReserved} ${item.unit} from reserved stock. Continue?`,
            data: {
              totalQty: before,
              reservedQty: reservedBefore,
              freeQty: freeBefore,
              requested: numQty,
              usedFromReserved,
              unit: item.unit,
            },
          });
        }

        // Permission granted — reduce reserved by the overlap
        reservedAfter = Math.max(reservedBefore - usedFromReserved, 0);
        overrideReserved = true;
      }

      after = before - numQty;
    } else {
      // adjustment — set to absolute value
      after = numQty;
      // Keep reserved from exceeding new total
      if (reservedBefore > after) {
        reservedAfter = after;
      }
    }

    if (after < 0 || after > MAX_QUANTITY) {
      return res.status(400).json({
        success: false,
        message: "Resulting quantity is out of range",
      });
    }

    // Apply changes
    item.quantity = after;
    if (type === "out" && overrideReserved) {
      item.reservedQty = reservedAfter;
    } else if (type === "adjustment") {
      item.reservedQty = reservedAfter;
    }

    if (type === "in") item.lastReceivedAt = new Date();
    if (type === "out") item.lastIssuedAt = new Date();

    if (!Array.isArray(item.movementLog)) item.movementLog = [];
    item.movementLog.push({
      type,
      quantity: type === "adjustment" ? Math.abs(after - before) : numQty,
      unitAtTime: item.unit,
      beforeQty: before,
      afterQty: after,
      reason:
        safeString(reason, 200) ||
        (overrideReserved ? "Issued from reserved stock (override)" : null),
      notes: safeString(notes, 500) || null,
      refType: "Manual",
      refId: null,
      refLabel: overrideReserved
        ? `reserved-override:${usedFromReserved}${item.unit}`
        : null,
      by: req.user?._id || null,
      at: new Date(),
    });
    if (item.movementLog.length > MAX_MOVEMENT_LOG) {
      item.movementLog = item.movementLog.slice(-MAX_MOVEMENT_LOG);
    }

    if (req.user?._id) item.updatedBy = req.user._id;
    await item.save();

    return res.status(200).json({
      success: true,
      message: overrideReserved
        ? `Stock out recorded (used ${usedFromReserved} ${item.unit} from reserved)`
        : `Stock ${type} recorded`,
      data: item,
    });
  } catch (error) {
    handleError(res, error, "Failed to adjust stock");
  }
};

/* -------- MOVEMENTS -------- */
const getRawStockMovements = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const item = await RawStock.findById(req.params.id).select("movementLog name unit");
    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    const data = [...(item.movementLog || [])].reverse();
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    handleError(res, error, "Failed to fetch movements");
  }
};

/* -------- SEED DEFAULTS -------- */
const seedDefaultMaterials = async (req, res) => {
  try {
    const defaults = [
      { category: "Steel", name: "Steel", unit: "Kg" },
      { category: "Tape", name: "Tape", unit: "Box" },
      { category: "Reel", name: "Reel 2kg", unit: "Piece", sizeKg: 2 },
      { category: "Reel", name: "Reel 5kg", unit: "Piece", sizeKg: 5 },
      { category: "Reel", name: "Reel 8kg", unit: "Piece", sizeKg: 8 },
      { category: "Reel", name: "Reel 10kg", unit: "Piece", sizeKg: 10 },
    ];

    const results = { created: [], skipped: [] };

    for (const d of defaults) {
      const exists = await RawStock.findOne({ name: d.name, isActive: true });
      if (exists) {
        results.skipped.push(d.name);
        continue;
      }
      await RawStock.create({ ...d, createdBy: req.user?._id || null });
      results.created.push(d.name);
    }

    return res.status(200).json({
      success: true,
      message: `Created ${results.created.length}, skipped ${results.skipped.length}`,
      data: results,
    });
  } catch (error) {
    handleError(res, error, "Failed to seed defaults");
  }
};

/* ============================================================
   ██  RAW PURCHASES
============================================================ */

/* -------- LIST -------- */
const getAllPurchases = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      material,
      supplier,
      search,
      fromDate,
      toDate,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 50, 1), MAX_LIMIT);

    const query = { isActive: true };

    if (status && status !== "All") {
      if (!["Pending", "Received", "Cancelled"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
      }
      query.status = status;
    }
    if (material && isValidId(material)) query.material = material;
    if (supplier && isValidId(supplier)) query.supplier = supplier;

    if (fromDate || toDate) {
      query.orderedAt = {};
      if (fromDate) {
        const d = new Date(fromDate);
        if (!isNaN(d)) query.orderedAt.$gte = d;
      }
      if (toDate) {
        const d = new Date(toDate);
        if (!isNaN(d)) {
          d.setHours(23, 59, 59, 999);
          query.orderedAt.$lte = d;
        }
      }
    }

    // ✅ NEW — search now also covers supplierName and supplierPhone
    if (search && typeof search === "string" && search.trim()) {
      const safe = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { notes: { $regex: safe, $options: "i" } },
        { supplierName: { $regex: safe, $options: "i" } },
        { supplierPhone: { $regex: safe, $options: "i" } },
      ];
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [purchases, total] = await Promise.all([
      RawPurchase.find(query)
        .populate("material", "name category unit sizeKg")
        .populate("supplier", "name company phone email")
        .sort({ orderedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      RawPurchase.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: purchases.length,
      total,
      page: pageNumber,
      pages: Math.max(Math.ceil(total / limitNumber), 1),
      data: purchases,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch purchases");
  }
};

/* -------- GET ONE -------- */
const getPurchaseById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const purchase = await RawPurchase.findById(req.params.id)
      .populate("material", "name category unit sizeKg quantity")
      .populate("supplier", "name company phone email");
    if (!purchase || !purchase.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    return res.status(200).json({ success: true, data: purchase });
  } catch (error) {
    handleError(res, error, "Failed to fetch purchase");
  }
};

/* -------- UPDATE PURCHASE (Pending only) -------- */
const updatePurchase = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const purchase = await RawPurchase.findById(req.params.id);
    if (!purchase || !purchase.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (purchase.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot edit a purchase in status "${purchase.status}". Only Pending purchases can be edited.`,
      });
    }

    // Editable fields
    if (req.body.quantity !== undefined) {
      const n = Number(req.body.quantity);
      if (!Number.isFinite(n) || n <= 0 || n > MAX_QUANTITY) {
        return res.status(400).json({
          success: false,
          message: `Quantity must be between 0.001 and ${MAX_QUANTITY}`,
        });
      }
      purchase.quantity = n;
    }

    if (req.body.unitPrice !== undefined) {
      const n = Number(req.body.unitPrice);
      if (!Number.isFinite(n) || n < 0 || n > 1e9) {
        return res.status(400).json({ success: false, message: "Invalid unitPrice" });
      }
      purchase.unitPrice = n;
    }

    // Recompute total after quantity or price change
    purchase.totalAmount =
      Number(purchase.quantity || 0) * Number(purchase.unitPrice || 0);

    if (req.body.expectedAt !== undefined) {
      if (req.body.expectedAt === null || req.body.expectedAt === "") {
        purchase.expectedAt = null;
      } else {
        const d = new Date(req.body.expectedAt);
        if (isNaN(d.getTime())) {
          return res.status(400).json({ success: false, message: "Invalid expectedAt" });
        }
        purchase.expectedAt = d;
      }
    }

    if (req.body.orderedAt !== undefined) {
      const d = new Date(req.body.orderedAt);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid orderedAt" });
      }
      purchase.orderedAt = d;
    }

    if (req.body.supplier !== undefined) {
      if (req.body.supplier === null || req.body.supplier === "") {
        purchase.supplier = null;
      } else {
        if (!isValidId(req.body.supplier)) {
          return res.status(400).json({ success: false, message: "Invalid supplier ID" });
        }
        const supplierDoc = await Contact.findById(req.body.supplier);
        if (!supplierDoc) {
          return res.status(404).json({ success: false, message: "Supplier not found" });
        }
        purchase.supplier = supplierDoc._id;
      }
    }

    // ✅ NEW — allow editing supplierName while Pending
    if (req.body.supplierName !== undefined) {
      purchase.supplierName = safeString(req.body.supplierName, 100) || null;
    }

    // ✅ NEW — allow editing supplierPhone while Pending
    if (req.body.supplierPhone !== undefined) {
      const phone = normalizePhone(req.body.supplierPhone, 20);
      if (phone && phone.error) {
        return res.status(400).json({
          success: false,
          message: "Supplier phone must have at least 7 digits",
        });
      }
      purchase.supplierPhone = phone;
    }

    if (req.body.notes !== undefined) {
      purchase.notes = safeString(req.body.notes, 1000) || undefined;
    }

    purchase.updatedBy = req.user?._id || null;
    await purchase.save();

    const populated = await RawPurchase.findById(purchase._id)
      .populate("material", "name category unit sizeKg")
      .populate("supplier", "name company phone email");

    return res.status(200).json({
      success: true,
      message: "Purchase updated",
      data: populated,
    });
  } catch (error) {
    handleError(res, error, "Failed to update purchase");
  }
};

/* -------- CREATE (does NOT touch stock yet) -------- */
const createPurchase = async (req, res) => {
  try {
    const {
      material,
      supplier,
      supplierName,   // ✅ NEW
      supplierPhone,  // ✅ NEW
      quantity,
      unitPrice = 0,
      orderedAt,
      expectedAt,
      notes,
    } = req.body;

    if (!material || !isValidId(material)) {
      return res.status(400).json({ success: false, message: "Valid material ID is required" });
    }

    const materialDoc = await RawStock.findById(material);
    if (!materialDoc || !materialDoc.isActive) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    let supplierDoc = null;
    if (supplier) {
      if (!isValidId(supplier)) {
        return res.status(400).json({ success: false, message: "Invalid supplier ID" });
      }
      supplierDoc = await Contact.findById(supplier);
      if (!supplierDoc) {
        return res.status(404).json({ success: false, message: "Supplier not found" });
      }
    }

    // ✅ NEW — supplier text field validation
    const cleanSupplierName = safeString(supplierName, 100) || null;
    const cleanSupplierPhone = normalizePhone(supplierPhone, 20);
    if (cleanSupplierPhone && cleanSupplierPhone.error) {
      return res.status(400).json({
        success: false,
        message: "Supplier phone must have at least 7 digits",
      });
    }

    const numQty = Number(quantity);
    if (!Number.isFinite(numQty) || numQty <= 0 || numQty > MAX_QUANTITY) {
      return res.status(400).json({
        success: false,
        message: `Quantity must be between 0.001 and ${MAX_QUANTITY}`,
      });
    }

    const numPrice = Number(unitPrice) || 0;
    if (numPrice < 0) {
      return res.status(400).json({ success: false, message: "Unit price cannot be negative" });
    }

    let cleanOrdered = new Date();
    if (orderedAt) {
      const d = new Date(orderedAt);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid orderedAt" });
      }
      cleanOrdered = d;
    }

    let cleanExpected = null;
    if (expectedAt) {
      const d = new Date(expectedAt);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid expectedAt" });
      }
      cleanExpected = d;
    }

    const purchase = await RawPurchase.create({
      material,
      supplier: supplierDoc?._id || null,
      supplierName: cleanSupplierName,    // ✅ NEW
      supplierPhone: cleanSupplierPhone,  // ✅ NEW
      quantity: numQty,
      unit: materialDoc.unit,
      unitPrice: numPrice,
      totalAmount: numQty * numPrice,
      orderedAt: cleanOrdered,
      expectedAt: cleanExpected,
      status: "Pending",
      notes: safeString(notes, 1000) || undefined,
      createdBy: req.user?._id || null,
    });

    const populated = await RawPurchase.findById(purchase._id)
      .populate("material", "name category unit sizeKg")
      .populate("supplier", "name company phone email");

    return res.status(201).json({
      success: true,
      message: "Purchase order recorded (pending receipt)",
      data: populated,
    });
  } catch (error) {
    handleError(res, error, "Failed to create purchase");
  }
};

/* -------- RECEIVE (the ONLY path that increases stock) -------- */
const receivePurchase = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    // Step 1 — atomic status flip. Guards against double-receive.
    const purchase = await RawPurchase.findOneAndUpdate(
      { _id: req.params.id, isActive: true, status: "Pending" },
      {
        $set: {
          status: "Received",
          receivedAt: new Date(),
          updatedBy: req.user?._id || null,
        },
      },
      { new: true }
    ).populate("material");

    if (!purchase) {
      const existing = await RawPurchase.findById(req.params.id);
      if (!existing || !existing.isActive) {
        return res.status(404).json({ success: false, message: "Purchase not found" });
      }
      return res.status(400).json({
        success: false,
        message: `Cannot receive a purchase in status "${existing.status}".`,
      });
    }

    // Step 2 — atomic stock increment + movement log entry.
    const material = await RawStock.findByIdAndUpdate(
      purchase.material._id,
      [
        {
          $set: {
            quantity: { $add: ["$quantity", purchase.quantity] },
            lastReceivedAt: "$$NOW",
            movementLog: {
              $slice: [
                {
                  $concatArrays: [
                    { $ifNull: ["$movementLog", []] },
                    [
                      {
                        type: "purchase-received",
                        quantity: purchase.quantity,
                        unitAtTime: purchase.unit,
                        beforeQty: "$quantity",
                        afterQty: { $add: ["$quantity", purchase.quantity] },
                        reason: "Purchase received",
                        notes: null,
                        refType: "Purchase",
                        refId: purchase._id,
                        refLabel: purchase._id.toString().slice(-8),
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
      { new: true, updatePipeline: true }
    );

    // Step 3 — if stock update failed, roll back the status flip.
    if (!material) {
      await RawPurchase.findByIdAndUpdate(purchase._id, {
        $set: { status: "Pending", receivedAt: null },
      });
      return res.status(500).json({
        success: false,
        message: "Material not found — purchase was not received. Please try again.",
      });
    }

    const populated = await RawPurchase.findById(purchase._id)
      .populate("material", "name category unit sizeKg quantity")
      .populate("supplier", "name company phone email");

    return res.status(200).json({
      success: true,
      message: "Purchase received, stock updated",
      data: populated,
    });
  } catch (error) {
    handleError(res, error, "Failed to receive purchase");
  }
};

/* -------- CANCEL -------- */
const cancelPurchase = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const purchase = await RawPurchase.findOneAndUpdate(
      { _id: req.params.id, isActive: true, status: "Pending" },
      { $set: { status: "Cancelled", updatedBy: req.user?._id || null } },
      { new: true }
    );

    if (!purchase) {
      const existing = await RawPurchase.findById(req.params.id);
      if (!existing || !existing.isActive) {
        return res.status(404).json({ success: false, message: "Purchase not found" });
      }
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a purchase in status "${existing.status}".`,
      });
    }

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

/* -------- DELETE (soft, only non-received) -------- */
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
        message: "Received purchases cannot be deleted. Cancel and adjust stock instead.",
      });
    }
    purchase.isActive = false;
    purchase.updatedBy = req.user?._id || null;
    await purchase.save();
    return res.status(200).json({ success: true, message: "Purchase deleted" });
  } catch (error) {
    handleError(res, error, "Failed to delete purchase");
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
};