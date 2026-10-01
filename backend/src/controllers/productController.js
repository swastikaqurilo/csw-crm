const mongoose = require("mongoose");
const ProductProduction = require("../models/Product");
const ProductStock = require("../models/ProductStock");
const { RawStock } = require("../models/RawMaterial");
const { computeConsumption, REEL_COMPOSITION } = require("../utils/reelComposition");

const MAX_LIMIT = 200;
const MAX_QTY = 1e7;
const MAX_RATE = 1e7;
const MAX_MOVEMENT_LOG = 200;
const SIZES = ["2kg", "5kg", "8kg", "10kg"];

const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 500) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : "";
};

const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

const handleError = (res, error, fallback) => {
  console.error(`[${fallback}]`, error);
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ success: false, message: errors[0]?.message || "Validation failed", errors });
  }
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: "An entry already exists for that date." });
  }
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      ...(error.code && { code: error.code }),
      ...(error.data && { data: error.data }),
    });
  }
  return res.status(500).json({ success: false, message: fallback });
};

const parseNum = (v, field, max = MAX_QTY) => {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    throw { status: 400, message: `${field} must be between 0 and ${max}` };
  }
  return n;
};

/* ============================================================
   RAW MATERIAL HELPERS
============================================================ */
const findSteelStock = () =>
  RawStock.findOne({ category: "Steel", isActive: true }).sort({ createdAt: 1 });

const findReelStock = (size) =>
  RawStock.findOne({ category: "Reel", name: `Reel ${size}`, isActive: true });

const verifyStockAvailable = async ({ steelNeeded, reelsBySize }, allowReserved = false) => {
  if (steelNeeded > 0) {
    const steel = await findSteelStock();
    if (!steel) {
      throw { status: 400, message: "No Steel raw material configured. Add one under Raw Materials first." };
    }
    const steelFree = Math.max(Number(steel.quantity || 0) - Number(steel.reservedQty || 0), 0);
    if (steel.quantity < steelNeeded) {
      throw {
        status: 400,
        message: `Not enough ${steel.name}. Need ${steelNeeded} ${steel.unit}, have ${steel.quantity} ${steel.unit}.`,
      };
    }
    if (!allowReserved && steelNeeded > steelFree) {
      throw {
        status: 409,
        code: "RESERVED_CONFLICT",
        message: `This production uses ${steelNeeded - steelFree} ${steel.unit} from reserved ${steel.name}.`,
        data: {
          material: "steel",
          name: steel.name,
          unit: steel.unit,
          totalQty: steel.quantity,
          reservedQty: steel.reservedQty || 0,
          freeQty: steelFree,
          requested: steelNeeded,
          usedFromReserved: steelNeeded - steelFree,
        },
      };
    }
  }

  for (const [size, qty] of Object.entries(reelsBySize)) {
    const reel = await findReelStock(size);
    if (!reel) {
      throw { status: 400, message: `No ${size} Reel raw material found. Add it under Raw Materials first.` };
    }
    const reelFree = Math.max(Number(reel.quantity || 0) - Number(reel.reservedQty || 0), 0);
    if (reel.quantity < qty) {
      throw {
        status: 400,
        message: `Not enough ${reel.name}. Need ${qty} ${reel.unit}, have ${reel.quantity} ${reel.unit}.`,
      };
    }
    if (!allowReserved && qty > reelFree) {
      throw {
        status: 409,
        code: "RESERVED_CONFLICT",
        message: `This production uses ${qty - reelFree} ${reel.unit} from reserved ${reel.name}.`,
        data: {
          material: "reel",
          size,
          name: reel.name,
          unit: reel.unit,
          totalQty: reel.quantity,
          reservedQty: reel.reservedQty || 0,
          freeQty: reelFree,
          requested: qty,
          usedFromReserved: qty - reelFree,
        },
      };
    }
  }
};

const deductRawMaterials = async ({ steelNeeded, reelsBySize, productionId, userId }) => {
  const consumed = { steel: null, reels: [], deductedAt: new Date() };

  if (steelNeeded > 0) {
    const steel = await findSteelStock();
    const before = steel.quantity;
    const reservedBefore = Number(steel.reservedQty || 0);
    const freeBefore = Math.max(before - reservedBefore, 0);
    const usedFromReserved = Math.max(steelNeeded - freeBefore, 0);

    steel.quantity = before - steelNeeded;
    if (usedFromReserved > 0) {
      steel.reservedQty = Math.max(reservedBefore - usedFromReserved, 0);
    }
    steel.lastIssuedAt = new Date();
    steel.movementLog.push({
      type: "out",
      quantity: steelNeeded,
      unitAtTime: steel.unit,
      beforeQty: before,
      afterQty: steel.quantity,
      reason: usedFromReserved > 0
        ? `Production consumption (used ${usedFromReserved} from reserved)`
        : "Production consumption",
      refType: "Production",
      refId: productionId,
      refLabel: "Daily production",
      by: userId || null,
    });
    steel.updatedBy = userId || null;
    await steel.save();

    consumed.steel = {
      rawStock: steel._id,
      name: steel.name,
      quantity: steelNeeded,
      reservedUsed: usedFromReserved,
      unit: steel.unit,
    };
  }

  for (const [size, qty] of Object.entries(reelsBySize)) {
    const reel = await findReelStock(size);
    if (!reel) throw { status: 500, message: `Reel ${size} not found during deduction.` };

    const before = reel.quantity;
    const reservedBefore = Number(reel.reservedQty || 0);
    const freeBefore = Math.max(before - reservedBefore, 0);
    const usedFromReserved = Math.max(qty - freeBefore, 0);

    reel.quantity = before - qty;
    if (usedFromReserved > 0) {
      reel.reservedQty = Math.max(reservedBefore - usedFromReserved, 0);
    }
    reel.lastIssuedAt = new Date();
    reel.movementLog.push({
      type: "out",
      quantity: qty,
      unitAtTime: reel.unit,
      beforeQty: before,
      afterQty: reel.quantity,
      reason: usedFromReserved > 0
        ? `Production consumption (${size} reel, used ${usedFromReserved} from reserved)`
        : `Production consumption (${size} reel)`,
      refType: "Production",
      refId: productionId,
      refLabel: "Daily production",
      by: userId || null,
    });
    reel.updatedBy = userId || null;
    await reel.save();

    consumed.reels.push({
      rawStock: reel._id,
      name: reel.name,
      size,
      spoolKg: REEL_COMPOSITION[size]?.spoolKg ?? null,
      quantity: qty,
      reservedUsed: usedFromReserved,
      unit: reel.unit,
    });
  }

  return consumed;
};

const refundRawMaterials = async ({ consumed, productionId, userId }) => {
  if (!consumed) return;

  if (consumed.steel?.rawStock && consumed.steel.quantity > 0) {
    const steel = await RawStock.findById(consumed.steel.rawStock);
    if (steel) {
      const before = steel.quantity;
      steel.quantity = before + consumed.steel.quantity;
      if (consumed.steel.reservedUsed > 0) {
        steel.reservedQty = Number(steel.reservedQty || 0) + consumed.steel.reservedUsed;
      }
      steel.movementLog.push({
        type: "in",
        quantity: consumed.steel.quantity,
        unitAtTime: steel.unit,
        beforeQty: before,
        afterQty: steel.quantity,
        reason: consumed.steel.reservedUsed > 0
          ? `Production entry reversed (restored ${consumed.steel.reservedUsed} to reserved)`
          : "Production entry reversed",
        refType: "Production",
        refId: productionId,
        refLabel: "Production reversal",
        by: userId || null,
      });
      steel.updatedBy = userId || null;
      await steel.save();
    }
  }

  for (const r of consumed.reels || []) {
    if (!r.rawStock || r.quantity <= 0) continue;
    const reel = await RawStock.findById(r.rawStock);
    if (!reel) continue;
    const before = reel.quantity;
    reel.quantity = before + r.quantity;
    if (r.reservedUsed > 0) {
      reel.reservedQty = Number(reel.reservedQty || 0) + r.reservedUsed;
    }
    reel.movementLog.push({
      type: "in",
      quantity: r.quantity,
      unitAtTime: reel.unit,
      beforeQty: before,
      afterQty: reel.quantity,
      reason: r.reservedUsed > 0
        ? `Production entry reversed (${r.size || r.spoolKg + "kg"} spool, restored ${r.reservedUsed} to reserved)`
        : `Production entry reversed (${r.size || r.spoolKg + "kg"} spool)`,
      refType: "Production",
      refId: productionId,
      refLabel: "Production reversal",
      by: userId || null,
    });
    reel.updatedBy = userId || null;
    await reel.save();
  }
};

/* ============================================================
   PRODUCT STOCK HELPERS
============================================================ */
const ensureProductStock = async (size, userId) => {
  let doc = await ProductStock.findOne({ size, isActive: true });
  if (!doc) {
    doc = await ProductStock.create({
      size,
      name: `${size} Reel`,
      unit: "Reel",
      createdBy: userId || null,
    });
  }
  return doc;
};

const pushProductMovement = (doc, entry) => {
  if (!Array.isArray(doc.movementLog)) doc.movementLog = [];
  doc.movementLog.push(entry);
  if (doc.movementLog.length > MAX_MOVEMENT_LOG) {
    doc.movementLog = doc.movementLog.slice(-MAX_MOVEMENT_LOG);
  }
};

const applyProductionToStock = async ({ qtys, productionId, userId }) => {
  for (const size of SIZES) {
    const qty = Number(qtys[size] || 0);
    if (qty <= 0) continue;

    const doc = await ensureProductStock(size, userId);
    const before = Number(doc.quantity || 0);
    doc.quantity = before + qty;
    doc.lastReceivedAt = new Date();

    pushProductMovement(doc, {
      type: "production",
      quantity: qty,
      unitAtTime: doc.unit,
      beforeQty: before,
      afterQty: doc.quantity,
      reason: `Production entry (${size})`,
      notes: null,
      refType: "Production",
      refId: productionId,
      refLabel: `PRD-${String(productionId).slice(-6)}`,
      by: userId || null,
      at: new Date(),
    });

    doc.updatedBy = userId || null;
    await doc.save();
  }
};

const revertProductionFromStock = async ({ qtys, productionId, userId }) => {
  for (const size of SIZES) {
    const qty = Number(qtys[size] || 0);
    if (qty <= 0) continue;

    const doc = await ProductStock.findOne({ size, isActive: true });
    if (!doc) continue;

    const before = Number(doc.quantity || 0);
    doc.quantity = Math.max(before - qty, 0);

    pushProductMovement(doc, {
      type: "adjustment",
      quantity: qty,
      unitAtTime: doc.unit,
      beforeQty: before,
      afterQty: doc.quantity,
      reason: `Production entry reversed (${size})`,
      notes: null,
      refType: "Production",
      refId: productionId,
      refLabel: `PRD-rev-${String(productionId).slice(-6)}`,
      by: userId || null,
      at: new Date(),
    });

    doc.updatedBy = userId || null;
    await doc.save();
  }
};

const buildQtys = (entry) => ({
  "2kg":  Number(entry.qty2kg || 0),
  "5kg":  Number(entry.qty5kg || 0),
  "8kg":  Number(entry.qty8kg || 0),
  "10kg": Number(entry.qty10kg || 0),
});

/* ============================================================
   PRODUCT STOCK — ENDPOINTS
============================================================ */
const getAllProductStock = async (req, res) => {
  try {
    for (const size of SIZES) {
      await ensureProductStock(size, req.user?._id);
    }

    const docs = await ProductStock.find({ isActive: true });
    const order = { "2kg": 1, "5kg": 2, "8kg": 3, "10kg": 4 };
    docs.sort((a, b) => (order[a.size] || 99) - (order[b.size] || 99));

    return res.status(200).json({
      success: true,
      count: docs.length,
      data: docs,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch product stock");
  }
};

const updateProductReserved = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const doc = await ProductStock.findById(req.params.id);
    if (!doc || !doc.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const n = Number(req.body.reservedQty);
    if (!Number.isFinite(n) || n < 0 || n > MAX_QTY) {
      return res.status(400).json({ success: false, message: "Invalid reservedQty" });
    }
    if (n > Number(doc.quantity || 0)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reserve more than available (${doc.quantity} ${doc.unit})`,
      });
    }

    const before = Number(doc.reservedQty || 0);
    doc.reservedQty = n;

    pushProductMovement(doc, {
      type: "adjustment",
      quantity: Math.abs(n - before),
      unitAtTime: doc.unit,
      beforeQty: Number(doc.quantity || 0),
      afterQty: Number(doc.quantity || 0),
      reason:
        n > before
          ? `Reserved increased by ${n - before}`
          : n < before
          ? `Reserved released by ${before - n}`
          : "Reserved updated (no change)",
      notes: safeString(req.body.notes, 500) || null,
      refType: "Manual",
      refId: null,
      refLabel: "reserved-change",
      by: req.user?._id || null,
      at: new Date(),
    });

    doc.updatedBy = req.user?._id || null;
    await doc.save();

    return res.status(200).json({
      success: true,
      message: "Reserved quantity updated",
      data: doc,
    });
  } catch (error) {
    handleError(res, error, "Failed to update reserved");
  }
};

const adjustProductStock = async (req, res) => {
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
    if (!Number.isFinite(numQty) || numQty < 0 || numQty > MAX_QTY) {
      return res.status(400).json({ success: false, message: "Invalid quantity" });
    }

    const doc = await ProductStock.findById(req.params.id);
    if (!doc || !doc.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const before = Number(doc.quantity || 0);
    const reservedBefore = Number(doc.reservedQty || 0);
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
      if (numQty > before) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${before} ${doc.unit}`,
        });
      }

      if (numQty > freeBefore) {
        usedFromReserved = numQty - freeBefore;

        if (!allowReserved) {
          return res.status(409).json({
            success: false,
            code: "RESERVED_CONFLICT",
            message: `This dispatch uses ${usedFromReserved} ${doc.unit} from reserved stock. Continue?`,
            data: {
              material: "product",
              size: doc.size,
              name: doc.name,
              unit: doc.unit,
              totalQty: before,
              reservedQty: reservedBefore,
              freeQty: freeBefore,
              requested: numQty,
              usedFromReserved,
            },
          });
        }

        reservedAfter = Math.max(reservedBefore - usedFromReserved, 0);
        overrideReserved = true;
      }

      after = before - numQty;
    } else {
      after = numQty;
      if (reservedBefore > after) reservedAfter = after;
    }

    if (after < 0 || after > MAX_QTY) {
      return res.status(400).json({ success: false, message: "Resulting quantity out of range" });
    }

    doc.quantity = after;
    if (type === "out" && overrideReserved) doc.reservedQty = reservedAfter;
    else if (type === "adjustment") doc.reservedQty = reservedAfter;

    if (type === "in") doc.lastReceivedAt = new Date();
    if (type === "out") doc.lastIssuedAt = new Date();

    pushProductMovement(doc, {
      type,
      quantity: type === "adjustment" ? Math.abs(after - before) : numQty,
      unitAtTime: doc.unit,
      beforeQty: before,
      afterQty: after,
      reason:
        safeString(reason, 200) ||
        (overrideReserved ? "Dispatched from reserved stock (override)" : null),
      notes: safeString(notes, 500) || null,
      refType: "Manual",
      refId: null,
      refLabel: overrideReserved ? `reserved-override:${usedFromReserved}${doc.unit}` : null,
      by: req.user?._id || null,
      at: new Date(),
    });

    doc.updatedBy = req.user?._id || null;
    await doc.save();

    return res.status(200).json({
      success: true,
      message: overrideReserved
        ? `Stock out recorded (used ${usedFromReserved} ${doc.unit} from reserved)`
        : `Stock ${type} recorded`,
      data: doc,
    });
  } catch (error) {
    handleError(res, error, "Failed to adjust product stock");
  }
};

const recordProductScrap = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const scrapKg = Number(req.body.quantity);   // ✅ input is kg
    if (!Number.isFinite(scrapKg) || scrapKg <= 0 || scrapKg > MAX_QTY) {
      return res.status(400).json({ success: false, message: "Scrap (kg) must be > 0" });
    }

    const doc = await ProductStock.findById(req.params.id);
    if (!doc || !doc.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    // Reel weight per size
    const REEL_WEIGHT_KG = { "2kg": 2, "5kg": 5, "8kg": 8, "10kg": 10 };
    const reelWeight = REEL_WEIGHT_KG[doc.size];
    if (!reelWeight) {
      return res.status(400).json({ success: false, message: "Unknown reel size" });
    }

    const reelsToScrap = scrapKg / reelWeight;
    const before = Number(doc.quantity || 0);

    if (reelsToScrap > before) {
      return res.status(400).json({
        success: false,
        message: `Cannot scrap ${scrapKg} kg — only ${before * reelWeight} kg available (${before} ${doc.unit})`,
      });
    }

    doc.quantity = before - reelsToScrap;
    doc.scrapQty = Number(doc.scrapQty || 0) + scrapKg;   // ✅ track in kg
    doc.lastScrapAt = new Date();

    pushProductMovement(doc, {
      type: "scrap",
      quantity: scrapKg,
      unitAtTime: "Kg",
      beforeQty: before,
      afterQty: doc.quantity,
      reason: safeString(req.body.reason, 200) || "Scrapped",
      notes: safeString(req.body.notes, 500) || null,
      refType: "Scrap",
      refId: null,
      refLabel: `${reelsToScrap} ${doc.unit}`,
      by: req.user?._id || null,
      at: new Date(),
    });

    doc.updatedBy = req.user?._id || null;
    await doc.save();

    return res.status(200).json({
      success: true,
      message: `Scrapped ${scrapKg} kg (${reelsToScrap} ${doc.unit})`,
      data: doc,
    });
  } catch (error) {
    handleError(res, error, "Failed to record scrap");
  }
};

const getProductStockMovements = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const doc = await ProductStock.findById(req.params.id).select("movementLog name size unit");
    if (!doc || !doc.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    const data = [...(doc.movementLog || [])].reverse();
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    handleError(res, error, "Failed to fetch movements");
  }
};

/* ============================================================
   PRODUCTION ENTRIES — ENDPOINTS
============================================================ */
const getAllProductions = async (req, res) => {
  try {
    const { page = 1, limit = 50, fromDate, toDate, search } = req.query;
    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 50, 1), MAX_LIMIT);

    const query = { isActive: true };

    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) { const d = new Date(fromDate); if (!isNaN(d)) query.date.$gte = startOfDay(d); }
      if (toDate)   { const d = new Date(toDate);   if (!isNaN(d)) query.date.$lte = endOfDay(d); }
    }
    if (search && typeof search === "string" && search.trim()) {
      const safe = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.notes = { $regex: safe, $options: "i" };
    }

    const skip = (pageNumber - 1) * limitNumber;
    const [entries, total] = await Promise.all([
      ProductProduction.find(query).sort({ date: -1 }).skip(skip).limit(limitNumber),
      ProductProduction.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: entries.length,
      total,
      page: pageNumber,
      pages: Math.max(Math.ceil(total / limitNumber), 1),
      data: entries,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch production entries");
  }
};

const getProductionById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const entry = await ProductProduction.findById(req.params.id);
    if (!entry || !entry.isActive) return res.status(404).json({ success: false, message: "Entry not found" });
    return res.status(200).json({ success: true, data: entry });
  } catch (error) {
    handleError(res, error, "Failed to fetch entry");
  }
};

const createProduction = async (req, res) => {
  try {
    const {
      date, qty2kg, qty5kg, qty8kg, qty10kg,
      rate2kg, rate5kg, rate8kg, rate10kg,
      tapeUsedBox, scrapKg,
      notes, allowReserved = false,
    } = req.body;

    if (!date) return res.status(400).json({ success: false, message: "Date is required" });
    const d = new Date(date);
    if (isNaN(d.getTime())) return res.status(400).json({ success: false, message: "Invalid date" });
    const cleanDate = startOfDay(d);

    const existing = await ProductProduction.findOne({ date: cleanDate, isActive: true });
    if (existing) {
      return res.status(409).json({ success: false, message: "An entry already exists for this date. Edit that entry instead." });
    }

    let payload;
    try {
      payload = {
        date: cleanDate,
        qty2kg: parseNum(qty2kg, "2kg quantity"),
        qty5kg: parseNum(qty5kg, "5kg quantity"),
        qty8kg: parseNum(qty8kg, "8kg quantity"),
        qty10kg: parseNum(qty10kg, "10kg quantity"),
        rate2kg: parseNum(rate2kg, "2kg rate", MAX_RATE),
        rate5kg: parseNum(rate5kg, "5kg rate", MAX_RATE),
        rate8kg: parseNum(rate8kg, "8kg rate", MAX_RATE),
        rate10kg: parseNum(rate10kg, "10kg rate", MAX_RATE),
        tapeUsedBox: parseNum(tapeUsedBox, "tape used (boxes)"),  
        scrapKg: parseNum(scrapKg, "scrap (kg)"), 
        notes: safeString(notes, 1000) || undefined,
        createdBy: req.user?._id || null,
      };
    } catch (validationErr) {
      return res.status(validationErr.status || 400).json({ success: false, message: validationErr.message });
    }

    const consumption = computeConsumption(payload);
    consumption.steelNeeded = Math.round(
      (consumption.steelNeeded + Number(payload.scrapKg || 0)) * 1000
    ) / 1000;

    await verifyStockAvailable(consumption, allowReserved);

    const entry = await ProductProduction.create(payload);

    try {
      const consumed = await deductRawMaterials({
        ...consumption,
        productionId: entry._id,
        userId: req.user?._id,
      });
      entry.consumed = consumed;
      await entry.save();

      await applyProductionToStock({
        qtys: buildQtys(entry),
        productionId: entry._id,
        userId: req.user?._id,
      });
    } catch (err) {
      await ProductProduction.findByIdAndDelete(entry._id);
      throw err;
    }

    return res.status(201).json({ success: true, message: "Production entry created", data: entry });
  } catch (error) {
    handleError(res, error, "Failed to create production entry");
  }
};

const updateProduction = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID" });

    const entry = await ProductProduction.findById(req.params.id);
    if (!entry || !entry.isActive) return res.status(404).json({ success: false, message: "Entry not found" });

    const { allowReserved = false } = req.body;
    const oldQtys = buildQtys(entry);
    const oldConsumed = entry.consumed ? entry.consumed.toObject() : null;

    if (req.body.date !== undefined) {
      const d = new Date(req.body.date);
      if (isNaN(d.getTime())) return res.status(400).json({ success: false, message: "Invalid date" });
      const cleanDate = startOfDay(d);
      if (cleanDate.getTime() !== entry.date.getTime()) {
        const clash = await ProductProduction.findOne({ date: cleanDate, isActive: true, _id: { $ne: entry._id } });
        if (clash) return res.status(409).json({ success: false, message: "Another entry already exists for that date." });
        entry.date = cleanDate;
      }
    }

    try {
      if (req.body.qty2kg !== undefined) entry.qty2kg = parseNum(req.body.qty2kg, "2kg quantity");
      if (req.body.qty5kg !== undefined) entry.qty5kg = parseNum(req.body.qty5kg, "5kg quantity");
      if (req.body.qty8kg !== undefined) entry.qty8kg = parseNum(req.body.qty8kg, "8kg quantity");
      if (req.body.qty10kg !== undefined) entry.qty10kg = parseNum(req.body.qty10kg, "10kg quantity");
      if (req.body.rate2kg !== undefined) entry.rate2kg = parseNum(req.body.rate2kg, "2kg rate", MAX_RATE);
      if (req.body.rate5kg !== undefined) entry.rate5kg = parseNum(req.body.rate5kg, "5kg rate", MAX_RATE);
      if (req.body.rate8kg !== undefined) entry.rate8kg = parseNum(req.body.rate8kg, "8kg rate", MAX_RATE);
      if (req.body.rate10kg !== undefined) entry.rate10kg = parseNum(req.body.rate10kg, "10kg rate", MAX_RATE);
      if (req.body.tapeUsedBox !== undefined) entry.tapeUsedBox = parseNum(req.body.tapeUsedBox, "tape used (boxes)");
      if (req.body.scrapKg !== undefined) entry.scrapKg = parseNum(req.body.scrapKg, "scrap (kg)");
    } catch (validationErr) {
      return res.status(validationErr.status || 400).json({ success: false, message: validationErr.message });
    }

    if (req.body.notes !== undefined) entry.notes = safeString(req.body.notes, 1000) || undefined;

    const newConsumption = computeConsumption({
      qty2kg: entry.qty2kg,
      qty5kg: entry.qty5kg,
      qty8kg: entry.qty8kg,
      qty10kg: entry.qty10kg,
    });

    newConsumption.steelNeeded = Math.round(
      (newConsumption.steelNeeded + Number(entry.scrapKg || 0)) * 1000
    ) / 1000;

    await refundRawMaterials({ consumed: oldConsumed, productionId: entry._id, userId: req.user?._id });

    await revertProductionFromStock({
      qtys: oldQtys,
      productionId: entry._id,
      userId: req.user?._id,
    });

    try {
      await verifyStockAvailable(newConsumption, allowReserved);
      const newConsumed = await deductRawMaterials({
        ...newConsumption,
        productionId: entry._id,
        userId: req.user?._id,
      });
      entry.consumed = newConsumed;

      await applyProductionToStock({
        qtys: buildQtys(entry),
        productionId: entry._id,
        userId: req.user?._id,
      });
    } catch (err) {
      if (oldConsumed) {
        const reelsBySize = (oldConsumed.reels || []).reduce((acc, r) => {
          const size =
            r.size ||
            (String(r.name || "").match(/(\d+(?:\.\d+)?)kg/) || [])[0] ||
            null;
          if (size) acc[size] = (acc[size] || 0) + r.quantity;
          return acc;
        }, {});

        await deductRawMaterials({
          steelNeeded: oldConsumed.steel?.quantity || 0,
          reelsBySize,
          productionId: entry._id,
          userId: req.user?._id,
        });

        await applyProductionToStock({
          qtys: oldQtys,
          productionId: entry._id,
          userId: req.user?._id,
        });
      }
      throw err;
    }

    entry.updatedBy = req.user?._id || null;
    await entry.save();

    return res.status(200).json({ success: true, message: "Production entry updated", data: entry });
  } catch (error) {
    handleError(res, error, "Failed to update production entry");
  }
};

const deleteProduction = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID" });
    const entry = await ProductProduction.findById(req.params.id);
    if (!entry || !entry.isActive) return res.status(404).json({ success: false, message: "Entry not found" });

    if (entry.consumed) {
      await refundRawMaterials({
        consumed: entry.consumed.toObject(),
        productionId: entry._id,
        userId: req.user?._id,
      });
    }

    await revertProductionFromStock({
      qtys: buildQtys(entry),
      productionId: entry._id,
      userId: req.user?._id,
    });

    entry.isActive = false;
    entry.updatedBy = req.user?._id || null;
    await entry.save();

    return res.status(200).json({ success: true, message: "Entry deleted" });
  } catch (error) {
    handleError(res, error, "Failed to delete entry");
  }
};

const getRecentRates = async (req, res) => {
  try {
    const latest = await ProductProduction.findOne({ isActive: true }).sort({ date: -1 });
    if (!latest) {
      return res.status(200).json({ success: true, data: { rate2kg: 0, rate5kg: 0, rate8kg: 0, rate10kg: 0 } });
    }
    return res.status(200).json({
      success: true,
      data: { rate2kg: latest.rate2kg || 0, rate5kg: latest.rate5kg || 0, rate8kg: latest.rate8kg || 0, rate10kg: latest.rate10kg || 0 },
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch recent rates");
  }
};

const previewConsumption = async (req, res) => {
  try {
    const { qty2kg = 0, qty5kg = 0, qty8kg = 0, qty10kg = 0 } = req.query;
    const consumption = computeConsumption({ qty2kg, qty5kg, qty8kg, qty10kg });

    const steel = consumption.steelNeeded > 0 ? await findSteelStock() : null;
    const reels = [];
    for (const [size, qty] of Object.entries(consumption.reelsBySize)) {
      const reel = await findReelStock(size);
      reels.push({
        size,
        needed: qty,
        unit: reel?.unit || "Piece",
        name: reel?.name || `Reel ${size}`,
        available: reel?.quantity ?? 0,
        ok: reel ? reel.quantity >= qty : false,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        steel: {
          needed: consumption.steelNeeded,
          unit: steel?.unit || "Kg",
          name: steel?.name || "Steel",
          available: steel?.quantity ?? 0,
          ok: steel ? steel.quantity >= consumption.steelNeeded : false,
        },
        reels,
      },
    });
  } catch (error) {
    handleError(res, error, "Failed to preview consumption");
  }
};

module.exports = {
  // Product Stock
  getAllProductStock,
  updateProductReserved,
  adjustProductStock,
  recordProductScrap,
  getProductStockMovements,

  // Production Entries
  getAllProductions,
  getProductionById,
  createProduction,
  updateProduction,
  deleteProduction,
  getRecentRates,
  previewConsumption,
};