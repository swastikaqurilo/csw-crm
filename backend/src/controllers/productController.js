const mongoose = require("mongoose");
const ProductProduction = require("../models/Product");
const ProductStock = require("../models/ProductStock");
const { RawStock } = require("../models/RawMaterial");
const { computeConsumption, REEL_COMPOSITION } = require("../utils/reelComposition");
const { Worker } = require("../models/Worker");
const REEL_WEIGHTS = {
  "2kg": 2,
  "5kg": 5,
  "8kg": 8,
  "10kg": 10,
};

const MAX_LIMIT = 200;
const MAX_QTY = 1e7;
const MAX_MOVEMENT_LOG = 200;
const SIZES = ["2kg", "5kg", "8kg", "10kg"];

const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 500) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : "";
};

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

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

const findSteelStock = () =>
  RawStock.findOne({ category: "Steel", isActive: true }).sort({ createdAt: 1 });

const findTapeStock = () =>
  RawStock.findOne({ category: "Tape", isActive: true }).sort({ createdAt: 1 });

const findReelStock = (size) => {
  const kg = Number(String(size).replace("kg", ""));
  if (!Number.isFinite(kg) || kg <= 0) return null;

  return RawStock.findOne({
    category: "Reel",
    isActive: true,
    name: { $regex: new RegExp(`(^|\\D)${kg}\\s*kg(\\D|$)`, "i") },
  });
};

const verifyStockAvailable = async (
  { steelNeeded, reelsBySize, tapeNeeded = 0 },
  allowReserved = false
) => {
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
    if (!qty || qty <= 0) continue;
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

  if (tapeNeeded > 0) {
    const tape = await findTapeStock();
    if (!tape) {
      throw { status: 400, message: "No Tape raw material configured. Add one under Raw Materials first." };
    }
    const tapeFree = Math.max(Number(tape.quantity || 0) - Number(tape.reservedQty || 0), 0);
    if (tape.quantity < tapeNeeded) {
      throw {
        status: 400,
        message: `Not enough ${tape.name}. Need ${tapeNeeded} ${tape.unit}, have ${tape.quantity} ${tape.unit}.`,
      };
    }
    if (!allowReserved && tapeNeeded > tapeFree) {
      throw {
        status: 409,
        code: "RESERVED_CONFLICT",
        message: `This production uses ${tapeNeeded - tapeFree} ${tape.unit} from reserved ${tape.name}.`,
        data: {
          material: "tape",
          name: tape.name,
          unit: tape.unit,
          totalQty: tape.quantity,
          reservedQty: tape.reservedQty || 0,
          freeQty: tapeFree,
          requested: tapeNeeded,
          usedFromReserved: tapeNeeded - tapeFree,
        },
      };
    }
  }
};

const deductRawMaterials = async ({
  steelNeeded,
  reelsBySize,
  tapeNeeded = 0,
  productionId,
  userId,
  session = null,
}) => {
  const consumed = { steel: null, reels: [], tape: null, deductedAt: new Date() };

  const atomicOut = async (doc, qty, reason) => {
    const before = Number(doc.quantity || 0);
    const reservedBefore = Number(doc.reservedQty || 0);
    const freeBefore = Math.max(before - reservedBefore, 0);
    const usedFromReserved = Math.max(qty - freeBefore, 0);
    const after = before - qty;
    const reservedAfter = Math.max(reservedBefore - usedFromReserved, 0);

    if (qty > before) {
      throw { status: 400, message: `Not enough ${doc.name}. Need ${qty} ${doc.unit}, have ${before} ${doc.unit}.` };
    }

    const filter = { _id: doc._id, isActive: true, quantity: before, reservedQty: reservedBefore };
    const logEntry = {
      type: "out",
      quantity: qty,
      unitAtTime: doc.unit,
      beforeQty: before,
      afterQty: after,
      reason,
      refType: "Production",
      refId: productionId,
      refLabel: "Daily production",
      by: userId || null,
      at: new Date(),
    };

    const opts = session ? { session, updatePipeline: true } : { updatePipeline: true };

    const result = await RawStock.updateOne(
      filter,
      [{
        $set: {
          quantity: after,
          reservedQty: reservedAfter,
          lastIssuedAt: new Date(),
          updatedBy: userId || null,
          movementLog: {
            $slice: [
              { $concatArrays: [{ $ifNull: ["$movementLog", []] }, [logEntry]] },
              -MAX_MOVEMENT_LOG,
            ],
          },
        },
      }],
      opts
    );

    if (result.modifiedCount !== 1) {
      throw { status: 409, code: "STOCK_CHANGED", message: `Stock for ${doc.name} changed during production. Please retry.` };
    }

    return { before, after, usedFromReserved, unit: doc.unit, name: doc.name, rawStock: doc._id };
  };

  if (steelNeeded > 0) {
    let steel = await findSteelStock();
    if (!steel) throw { status: 400, message: "No Steel raw material configured. Add one under Raw Materials first." };
    if (session) {
      steel = await RawStock.findById(steel._id).session(session);
      if (!steel || !steel.isActive) throw { status: 400, message: "Steel stock not found" };
    }
    const free = Math.max(Number(steel.quantity || 0) - Number(steel.reservedQty || 0), 0);
    const usedFromReserved = Math.max(steelNeeded - free, 0);
    const info = await atomicOut(
      steel,
      steelNeeded,
      usedFromReserved > 0 ? `Production consumption (used ${usedFromReserved} from reserved)` : "Production consumption"
    );
    consumed.steel = {
      rawStock: info.rawStock,
      name: info.name,
      quantity: steelNeeded,
      reservedUsed: info.usedFromReserved,
      unit: info.unit,
    };
  }

  for (const [size, qty] of Object.entries(reelsBySize || {})) {
    if (!qty || qty <= 0) continue;
    let reel = await findReelStock(size);
    if (!reel) throw { status: 400, message: `No ${size} Reel raw material found. Add it under Raw Materials first.` };
    if (session) {
      const r = await RawStock.findById(reel._id).session(session);
      if (!r || !r.isActive) throw { status: 400, message: `Reel ${size} not found` };
      reel = r;
    }
    const usedFromReserved = Math.max(
      qty - Math.max(Number(reel.quantity || 0) - Number(reel.reservedQty || 0), 0),
      0
    );
    const info = await atomicOut(
      reel,
      qty,
      usedFromReserved > 0
        ? `Production consumption (${size} reel, used ${usedFromReserved} from reserved)`
        : `Production consumption (${size} reel)`
    );
    consumed.reels.push({
      rawStock: info.rawStock,
      name: info.name,
      size,
      spoolKg: REEL_COMPOSITION[size]?.spoolKg ?? null,
      quantity: qty,
      reservedUsed: info.usedFromReserved,
      unit: info.unit,
    });
  }

  if (tapeNeeded > 0) {
    let tape = await findTapeStock();
    if (!tape) throw { status: 400, message: "No Tape raw material configured. Add one under Raw Materials first." };
    if (session) {
      const tp = await RawStock.findById(tape._id).session(session);
      if (!tp || !tp.isActive) throw { status: 400, message: "Tape stock not found" };
      tape = tp;
    }
    const usedFromReserved = Math.max(
      tapeNeeded - Math.max(Number(tape.quantity || 0) - Number(tape.reservedQty || 0), 0),
      0
    );
    const info = await atomicOut(
      tape,
      tapeNeeded,
      usedFromReserved > 0 ? `Production consumption (used ${usedFromReserved} from reserved)` : "Production consumption (tape)"
    );
    consumed.tape = {
      rawStock: info.rawStock,
      name: info.name,
      quantity: tapeNeeded,
      reservedUsed: info.usedFromReserved,
      unit: info.unit,
    };
  }

  return consumed;
};

const refundRawMaterials = async ({ consumed, productionId, userId, tapeUsedBox = 0, session = null }) => {
  if (!consumed && !(tapeUsedBox > 0)) return;

  const atomicIn = async (doc, qty, reservedUsed, reason) => {
    const before = Number(doc.quantity || 0);
    const reservedBefore = Number(doc.reservedQty || 0);
    const after = before + qty;
    const reservedAfter = reservedBefore + (Number(reservedUsed) || 0);

    const filter = { _id: doc._id, isActive: true, quantity: before, reservedQty: reservedBefore };
    const logEntry = {
      type: "in",
      quantity: qty,
      unitAtTime: doc.unit,
      beforeQty: before,
      afterQty: after,
      reason,
      refType: "Production",
      refId: productionId,
      refLabel: "Production reversal",
      by: userId || null,
      at: new Date(),
    };

    const opts = session ? { session, updatePipeline: true } : { updatePipeline: true };

    const result = await RawStock.updateOne(
      filter,
      [{
        $set: {
          quantity: after,
          reservedQty: reservedAfter,
          updatedBy: userId || null,
          movementLog: {
            $slice: [
              { $concatArrays: [{ $ifNull: ["$movementLog", []] }, [logEntry]] },
              -MAX_MOVEMENT_LOG,
            ],
          },
        },
      }],
      opts
    );

    if (result.modifiedCount !== 1) {
      throw { status: 409, code: "STOCK_CHANGED", message: `Stock for ${doc.name} changed during production reversal. Please retry.` };
    }
  };

  if (consumed?.steel?.rawStock && consumed.steel.quantity > 0) {
    const steel = session
      ? await RawStock.findById(consumed.steel.rawStock).session(session)
      : await RawStock.findById(consumed.steel.rawStock);
    if (steel) {
      await atomicIn(
        steel,
        consumed.steel.quantity,
        consumed.steel.reservedUsed,
        consumed.steel.reservedUsed > 0
          ? `Production entry reversed (restored ${consumed.steel.reservedUsed} to reserved)`
          : "Production entry reversed"
      );
    }
  }

  for (const r of consumed?.reels || []) {
    if (!r.rawStock || r.quantity <= 0) continue;
    const reel = session
      ? await RawStock.findById(r.rawStock).session(session)
      : await RawStock.findById(r.rawStock);
    if (!reel) continue;
    await atomicIn(
      reel,
      r.quantity,
      r.reservedUsed,
      r.reservedUsed > 0
        ? `Production entry reversed (${r.size || "reel"}, restored ${r.reservedUsed} to reserved)`
        : `Production entry reversed (${r.size || "reel"})`
    );
  }

  const consumedTape = consumed?.tape;

  if (consumedTape?.rawStock && Number(consumedTape.quantity) > 0) {
    const tape = session
      ? await RawStock.findById(consumedTape.rawStock).session(session)
      : await RawStock.findById(consumedTape.rawStock);

    if (!tape || !tape.isActive) {
      throw { status: 409, code: "TAPE_STOCK_NOT_FOUND", message: "The original tape stock record could not be found." };
    }

    await atomicIn(
      tape,
      Number(consumedTape.quantity),
      Number(consumedTape.reservedUsed || 0),
      "Production entry reversed (tape)"
    );
  } else {
    const tapeQty = Number(tapeUsedBox || 0);

    if (tapeQty > 0) {
      let tape = await findTapeStock();
      if (tape && session) {
        tape = await RawStock.findById(tape._id).session(session);
      }
      if (!tape || !tape.isActive) {
        throw { status: 409, code: "TAPE_STOCK_NOT_FOUND", message: "Tape stock could not be found for this reversal." };
      }
      await atomicIn(tape, tapeQty, 0, "Production entry reversed (legacy tape)");
    }
  }
};

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

const applyProductionToStock = async ({ qtys, productionId, userId, session = null }) => {
  for (const size of SIZES) {
    const qty = Number(qtys[size] || 0);
    if (qty <= 0) continue;

    let doc = session
      ? await ProductStock.findOne({ size, isActive: true }).session(session)
      : await ProductStock.findOne({ size, isActive: true });
    if (!doc) {
      const created = await ProductStock.create(
        [{ size, name: `${size} Reel`, unit: "Reel", createdBy: userId || null }],
        session ? { session } : undefined
      );
      doc = Array.isArray(created) ? created[0] : created;
    }

    const before = Number(doc.quantity || 0);
    const after = before + qty;

    const filter = { _id: doc._id, isActive: true, quantity: before };
    const logEntry = {
      type: "production",
      quantity: qty,
      unitAtTime: doc.unit,
      beforeQty: before,
      afterQty: after,
      reason: `Production entry (${size})`,
      notes: null,
      refType: "Production",
      refId: productionId,
      refLabel: `PRD-${String(productionId).slice(-6)}`,
      by: userId || null,
      at: new Date(),
    };

    const opts = session ? { session, updatePipeline: true } : { updatePipeline: true };

    const result = await ProductStock.updateOne(
      filter,
      [{
        $set: {
          quantity: after,
          lastReceivedAt: new Date(),
          updatedBy: userId || null,
          movementLog: {
            $slice: [
              { $concatArrays: [{ $ifNull: ["$movementLog", []] }, [logEntry]] },
              -MAX_MOVEMENT_LOG,
            ],
          },
        },
      }],
      opts
    );

    if (result.modifiedCount !== 1) {
      throw { status: 409, code: "STOCK_CHANGED", message: `Finished-goods stock for ${size} changed during production. Please retry.` };
    }
  }
};

const revertProductionFromStock = async ({ qtys, productionId, userId, session = null }) => {
  for (const size of SIZES) {
    const qty = Number(qtys[size] || 0);
    if (qty <= 0) continue;

    const doc = session
      ? await ProductStock.findOne({ size, isActive: true }).session(session)
      : await ProductStock.findOne({ size, isActive: true });
    if (!doc) continue;

    const before = Number(doc.quantity || 0);
    const reservedBefore = Number(doc.reservedQty || 0);
    const freeBefore = Math.max(before - reservedBefore, 0);

    if (qty > freeBefore) {
      throw {
        status: 409,
        code: "INSUFFICIENT_STOCK_FOR_REVERSAL",
        message: `Cannot reverse ${qty} ${size} reels. ${freeBefore} are unreserved and ${reservedBefore} are reserved.`,
      };
    }

    const after = before - qty;

    const filter = { _id: doc._id, isActive: true, quantity: before };
    const logEntry = {
      type: "adjustment",
      quantity: qty,
      unitAtTime: doc.unit,
      beforeQty: before,
      afterQty: after,
      reason: `Production entry reversed (${size})`,
      notes: null,
      refType: "Production",
      refId: productionId,
      refLabel: `PRD-rev-${String(productionId).slice(-6)}`,
      by: userId || null,
      at: new Date(),
    };

    const opts = session ? { session, updatePipeline: true } : { updatePipeline: true };

    const result = await ProductStock.updateOne(
      filter,
      [{
        $set: {
          quantity: after,
          updatedBy: userId || null,
          movementLog: {
            $slice: [
              { $concatArrays: [{ $ifNull: ["$movementLog", []] }, [logEntry]] },
              -MAX_MOVEMENT_LOG,
            ],
          },
        },
      }],
      opts
    );

    if (result.modifiedCount !== 1) {
      throw { status: 409, code: "STOCK_CHANGED", message: `Finished-goods stock for ${size} changed during production reversal. Please retry.` };
    }
  }
};

// NEW: apply only the difference between old and new production quantities.
// This is what updateProduction uses instead of revert-all-then-apply-all.
const adjustProductionStockByDelta = async ({ oldQtys, newQtys, productionId, userId, session = null }) => {
  for (const size of SIZES) {
    const oldQty = Number(oldQtys[size] || 0);
    const newQty = Number(newQtys[size] || 0);
    const delta = newQty - oldQty;

    if (delta === 0) continue;

    let doc = session
      ? await ProductStock.findOne({ size, isActive: true }).session(session)
      : await ProductStock.findOne({ size, isActive: true });

    if (!doc) {
      if (delta < 0) continue;
      const created = await ProductStock.create(
        [{ size, name: `${size} Reel`, unit: "Reel", createdBy: userId || null }],
        session ? { session } : undefined
      );
      doc = Array.isArray(created) ? created[0] : created;
    }

    const before = Number(doc.quantity || 0);
    const reservedBefore = Number(doc.reservedQty || 0);
    const freeBefore = Math.max(before - reservedBefore, 0);
    const after = before + delta;

    if (delta < 0 && -delta > freeBefore) {
      throw {
        status: 409,
        code: "INSUFFICIENT_STOCK_FOR_REVERSAL",
        message:
          `Cannot reduce ${size} stock by ${-delta} reels — ` +
          `${freeBefore} are unreserved and ${reservedBefore} are reserved. ` +
          `Release the reservations first, or don't reduce this production entry.`,
      };
    }

    if (after < 0) {
      throw {
        status: 409,
        code: "INSUFFICIENT_STOCK_FOR_REVERSAL",
        message: `Cannot reduce ${size} stock to a negative quantity.`,
      };
    }

    const logEntry = {
      type: delta > 0 ? "production" : "adjustment",
      quantity: Math.abs(delta),
      unitAtTime: doc.unit,
      beforeQty: before,
      afterQty: after,
      reason:
        delta > 0
          ? `Production entry adjusted up (${size})`
          : `Production entry adjusted down (${size})`,
      notes: null,
      refType: "Production",
      refId: productionId,
      refLabel: `PRD-adj-${String(productionId).slice(-6)}`,
      by: userId || null,
      at: new Date(),
    };

    const opts = session ? { session, updatePipeline: true } : { updatePipeline: true };

    const result = await ProductStock.updateOne(
      { _id: doc._id, isActive: true, quantity: before },
      [{
        $set: {
          quantity: after,
          ...(delta > 0 ? { lastReceivedAt: new Date() } : { lastIssuedAt: new Date() }),
          updatedBy: userId || null,
          movementLog: {
            $slice: [
              { $concatArrays: [{ $ifNull: ["$movementLog", []] }, [logEntry]] },
              -MAX_MOVEMENT_LOG,
            ],
          },
        },
      }],
      opts
    );

    if (result.modifiedCount !== 1) {
      throw { status: 409, code: "STOCK_CHANGED", message: `Finished-goods stock for ${size} changed during edit. Please retry.` };
    }
  }
};

const buildQtys = (entry) => ({
  "2kg": Number(entry.qty2kg || 0),
  "5kg": Number(entry.qty5kg || 0),
  "8kg": Number(entry.qty8kg || 0),
  "10kg": Number(entry.qty10kg || 0),
});

const buildWorkerProduction = async (workers, dailyQtys) => {
  if (workers === undefined || workers === null) {
    return [];
  }

  if (!Array.isArray(workers)) {
    throw { status: 400, message: "workers must be an array" };
  }

  const seenWorkers = new Set();

  const assigned = { "2kg": 0, "5kg": 0, "8kg": 0, "10kg": 0 };

  const result = [];

  for (const item of workers) {
    const workerId =
      item?.worker !== undefined && item?.worker !== null
        ? String(item.worker).trim()
        : "";

    if (!workerId) {
      throw { status: 400, message: "Please select a worker for every worker production row." };
    }

    if (!isValidId(workerId)) {
      throw { status: 400, message: "Invalid worker ID." };
    }

    if (seenWorkers.has(workerId)) {
      throw { status: 400, message: "A worker cannot be added more than once in the same production entry." };
    }

    seenWorkers.add(workerId);

    const worker = await Worker.findOne({
      _id: workerId,
      status: "Active",
    }).select("_id name payType variablePay");

    if (!worker) {
      throw { status: 400, message: "Worker not found or worker is inactive." };
    }

    if (worker.payType !== "Variable") {
      throw {
        status: 400,
        message: `${worker.name} is a Fixed-pay worker and cannot be assigned to production.`,
      };
    }

    const production = item?.production || {};

    const cleanProduction = { "2kg": 0, "5kg": 0, "8kg": 0, "10kg": 0 };

    const rates = {
      "2kg": Number(worker.variablePay?.rate2kg) || 0,
      "5kg": Number(worker.variablePay?.rate5kg) || 0,
      "8kg": Number(worker.variablePay?.rate8kg) || 0,
      "10kg": Number(worker.variablePay?.rate10kg) || 0,
    };

    let totalReels = 0;
    let grossKg = 0;
    let totalEarnings = 0;

    for (const size of SIZES) {
      const qty = parseNum(production[size], `${size} worker production`);

      if (!Number.isInteger(qty)) {
        throw { status: 400, message: `${size} worker production must be a whole number.` };
      }

      assigned[size] += qty;

      if (assigned[size] > Number(dailyQtys[size] || 0)) {
        throw { status: 400, message: `Workers cannot be assigned more ${size} reels than today's production.` };
      }

      const weightKg = REEL_WEIGHTS[size] || 0;
      const rate = rates[size];
      const amount = qty * weightKg * rate;

      cleanProduction[size] = qty;
      totalReels += qty;
      grossKg += qty * weightKg;
      totalEarnings += amount;
    }

    result.push({
      worker: worker._id,
      production: cleanProduction,
      totalReels,
      grossKg,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
    });
  }

  return result;
};

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

    const qtyBefore = Number(doc.quantity || 0);
    const reservedBefore = Number(doc.reservedQty || 0);
    let reservedAfter = reservedBefore;
    let reorderLevel = doc.reorderLevel;
    let criticalLevel = doc.criticalLevel;
    let logEntry = null;

    if (req.body.reservedQty !== undefined) {
      const n = Number(req.body.reservedQty);
      if (!Number.isFinite(n) || n < 0 || n > MAX_QTY) {
        return res.status(400).json({ success: false, message: "Invalid reservedQty" });
      }
      if (n > qtyBefore) {
        return res.status(400).json({
          success: false,
          message: `Cannot reserve more than available (${qtyBefore} ${doc.unit})`,
        });
      }
      reservedAfter = n;
      logEntry = {
        type: "adjustment",
        quantity: Math.abs(n - reservedBefore),
        unitAtTime: doc.unit,
        beforeQty: qtyBefore,
        afterQty: qtyBefore,
        reason:
          n > reservedBefore
            ? `Reserved increased by ${n - reservedBefore}`
            : n < reservedBefore
            ? `Reserved released by ${reservedBefore - n}`
            : "Reserved updated (no change)",
        notes: safeString(req.body.notes, 500) || null,
        refType: "Manual",
        refId: null,
        refLabel: "reserved-change",
        by: req.user?._id || null,
        at: new Date(),
      };
    }

    if (req.body.reorderLevel !== undefined) {
      const r = Number(req.body.reorderLevel);
      if (!Number.isFinite(r) || r < 0 || r > MAX_QTY) {
        return res.status(400).json({ success: false, message: "Invalid reorderLevel" });
      }
      reorderLevel = r;
    }

    if (req.body.criticalLevel !== undefined) {
      const c = Number(req.body.criticalLevel);
      if (!Number.isFinite(c) || c < 0 || c > MAX_QTY) {
        return res.status(400).json({ success: false, message: "Invalid criticalLevel" });
      }
      criticalLevel = c;
    }

    if (Number(criticalLevel) > Number(reorderLevel)) {
      return res.status(400).json({
        success: false,
        message: "Critical level cannot be higher than reorder level",
      });
    }

    const setFields = {
      reservedQty: reservedAfter,
      reorderLevel,
      criticalLevel,
      updatedBy: req.user?._id || null,
    };

    const pipeline = [{ $set: setFields }];
    if (logEntry) {
      pipeline[0].$set.movementLog = {
        $slice: [
          {
            $concatArrays: [{ $ifNull: ["$movementLog", []] }, [logEntry]],
          },
          -MAX_MOVEMENT_LOG,
        ],
      };
    }

    const result = await ProductStock.updateOne(
      {
        _id: doc._id,
        isActive: true,
        quantity: qtyBefore,
        reservedQty: reservedBefore,
      },
      pipeline,
      { updatePipeline: true }
    );

    if (result.modifiedCount !== 1) {
      return res.status(409).json({
        success: false,
        code: "STOCK_CHANGED",
        message: "Stock changed while updating. Please retry.",
      });
    }

    const updated = await ProductStock.findById(doc._id);
    return res.status(200).json({
      success: true,
      message: "Stock settings updated",
      data: updated,
    });
  } catch (error) {
    handleError(res, error, "Failed to update stock settings");
  }
};

const adjustProductStock = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const { type, quantity, reason, notes, allowReserved = false } = req.body;

    if (!["in", "out", "adjustment"].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be one of: in, out, adjustment" });
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
      if (numQty <= 0) return res.status(400).json({ success: false, message: "Quantity must be > 0" });
      after = before + numQty;
    } else if (type === "out") {
      if (numQty <= 0) return res.status(400).json({ success: false, message: "Quantity must be > 0" });
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

    const logEntry = {
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
    };

    const setFields = {
      quantity: after,
      reservedQty: reservedAfter,
      updatedBy: req.user?._id || null,
      movementLog: {
        $slice: [
          {
            $concatArrays: [{ $ifNull: ["$movementLog", []] }, [logEntry]],
          },
          -MAX_MOVEMENT_LOG,
        ],
      },
    };
    if (type === "in") setFields.lastReceivedAt = new Date();
    if (type === "out") setFields.lastIssuedAt = new Date();

    const result = await ProductStock.updateOne(
      {
        _id: doc._id,
        isActive: true,
        quantity: before,
        reservedQty: reservedBefore,
      },
      [{ $set: setFields }],
      { updatePipeline: true }
    );

    if (result.modifiedCount !== 1) {
      return res.status(409).json({
        success: false,
        code: "STOCK_CHANGED",
        message: "Stock changed while adjusting. Please retry.",
      });
    }

    const updated = await ProductStock.findById(doc._id);
    return res.status(200).json({
      success: true,
      message: overrideReserved
        ? `Stock out recorded (used ${usedFromReserved} ${doc.unit} from reserved)`
        : `Stock ${type} recorded`,
      data: updated,
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

    const scrapKg = Number(req.body.quantity);
    if (!Number.isFinite(scrapKg) || scrapKg <= 0 || scrapKg > MAX_QTY) {
      return res.status(400).json({ success: false, message: "Scrap (kg) must be > 0" });
    }

    const doc = await ProductStock.findById(req.params.id);
    if (!doc || !doc.isActive) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const REEL_WEIGHT_KG = { "2kg": 2, "5kg": 5, "8kg": 8, "10kg": 10 };
    const reelWeight = REEL_WEIGHT_KG[doc.size];
    if (!reelWeight) {
      return res.status(400).json({ success: false, message: "Unknown reel size" });
    }

    const reelsToScrap = scrapKg / reelWeight;
    const before = Number(doc.quantity || 0);
    const reservedBefore = Number(doc.reservedQty || 0);

    if (reelsToScrap > before) {
      return res.status(400).json({
        success: false,
        message: `Cannot scrap ${scrapKg} kg — only ${before * reelWeight} kg available (${before} ${doc.unit})`,
      });
    }

    const after = before - reelsToScrap;
    const reservedAfter = Math.min(reservedBefore, after);

    const logEntry = {
      type: "scrap",
      quantity: scrapKg,
      unitAtTime: "Kg",
      beforeQty: before,
      afterQty: after,
      reason: safeString(req.body.reason, 200) || "Scrapped",
      notes: safeString(req.body.notes, 500) || null,
      refType: "Scrap",
      refId: null,
      refLabel: `${reelsToScrap} ${doc.unit}`,
      by: req.user?._id || null,
      at: new Date(),
    };

    const result = await ProductStock.updateOne(
      {
        _id: doc._id,
        isActive: true,
        quantity: before,
        reservedQty: reservedBefore,
      },
      [
        {
          $set: {
            quantity: after,
            reservedQty: reservedAfter,
            scrapQty: { $add: [{ $ifNull: ["$scrapQty", 0] }, scrapKg] },
            lastScrapAt: new Date(),
            updatedBy: req.user?._id || null,
            movementLog: {
              $slice: [
                {
                  $concatArrays: [{ $ifNull: ["$movementLog", []] }, [logEntry]],
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
        message: "Stock changed while recording scrap. Please retry.",
      });
    }

    const updated = await ProductStock.findById(doc._id);
    return res.status(200).json({
      success: true,
      message: `Scrapped ${scrapKg} kg (${reelsToScrap} ${doc.unit})`,
      data: updated,
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

const getAllProductions = async (req, res) => {
  try {
    const { page = 1, limit = 50, fromDate, toDate, search } = req.query;
    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 50, 1), MAX_LIMIT);

    const query = { isActive: true };

    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) { const d = new Date(fromDate); if (!isNaN(d)) query.date.$gte = startOfDay(d); }
      if (toDate) { const d = new Date(toDate); if (!isNaN(d)) query.date.$lte = endOfDay(d); }
    }
    if (search && typeof search === "string" && search.trim()) {
      const safe = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.notes = { $regex: safe, $options: "i" };
    }

    const skip = (pageNumber - 1) * limitNumber;
    const [entries, total] = await Promise.all([
      ProductProduction.find(query)
        .populate({
          path: "workers.worker",
          select: "name payType variablePay",
        })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNumber),

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

    const entry = await ProductProduction.findById(req.params.id)
      .populate({
        path: "workers.worker",
        select: "name payType variablePay",
      });

    if (!entry || !entry.isActive) return res.status(404).json({ success: false, message: "Entry not found" });
    return res.status(200).json({ success: true, data: entry });
  } catch (error) {
    handleError(res, error, "Failed to fetch entry");
  }
};

const createProduction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const {
      date,
      qty2kg,
      qty5kg,
      qty8kg,
      qty10kg,
      tapeUsedBox,
      scrapKg,
      notes,
      workers,
      allowReserved = false,
    } = req.body;

    if (!date) return res.status(400).json({ success: false, message: "Date is required" });
    const d = new Date(date);
    if (isNaN(d.getTime())) return res.status(400).json({ success: false, message: "Invalid date" });
    const cleanDate = startOfDay(d);

    let payload;
    try {
      payload = {
        date: cleanDate,
        qty2kg: parseNum(qty2kg, "2kg quantity"),
        qty5kg: parseNum(qty5kg, "5kg quantity"),
        qty8kg: parseNum(qty8kg, "8kg quantity"),
        qty10kg: parseNum(qty10kg, "10kg quantity"),
        tapeUsedBox: parseNum(tapeUsedBox, "tape used (boxes)"),
        scrapKg: parseNum(scrapKg, "scrap (kg)"),
        notes: safeString(notes, 1000) || undefined,
        createdBy: req.user?._id || null,
      };
    } catch (validationErr) {
      return res.status(validationErr.status || 400).json({ success: false, message: validationErr.message });
    }

    const dailyQtys = {
      "2kg": payload.qty2kg,
      "5kg": payload.qty5kg,
      "8kg": payload.qty8kg,
      "10kg": payload.qty10kg,
    };

    payload.workers = await buildWorkerProduction(workers, dailyQtys);

    const consumption = computeConsumption(payload);
    consumption.steelNeeded = Math.round((consumption.steelNeeded + Number(payload.scrapKg || 0)) * 1000) / 1000;

    consumption.reelsBySize = Object.fromEntries(
      Object.entries(consumption.reelsBySize || {}).filter(([, q]) => Number(q) > 0)
    );

    consumption.tapeNeeded = Number(payload.tapeUsedBox || 0);

    await verifyStockAvailable(consumption, allowReserved);

    let entry = null;

    await session.withTransaction(async () => {
      const existing = await ProductProduction.findOne({
        date: cleanDate,
        isActive: true,
      }).session(session);
      if (existing) {
        const err = new Error("An entry already exists for this date. Edit that entry instead.");
        err.status = 409;
        throw err;
      }

      const created = await ProductProduction.create([payload], { session });
      entry = created[0];

      const consumed = await deductRawMaterials({
        ...consumption,
        productionId: entry._id,
        userId: req.user?._id,
        session,
      });
      entry.consumed = consumed;
      await entry.save({ session });

      await applyProductionToStock({
        qtys: buildQtys(entry),
        productionId: entry._id,
        userId: req.user?._id,
        session,
      });
    });

    return res.status(201).json({
      success: true,
      message: "Production entry created",
      data: entry,
    });
  } catch (error) {
    handleError(res, error, "Failed to create production entry");
  } finally {
    await session.endSession();
  }
};

const updateProduction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const { allowReserved = false } = req.body;

    const existing = await ProductProduction.findById(req.params.id);
    if (!existing || !existing.isActive) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    const oldQtys = buildQtys(existing);
    const oldTape = Number(existing.tapeUsedBox || 0);
    const oldConsumed = existing.consumed
      ? (typeof existing.consumed.toObject === "function" ? existing.consumed.toObject() : existing.consumed)
      : null;

    let nextDate = existing.date;
    if (req.body.date !== undefined) {
      const d = new Date(req.body.date);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid date" });
      }
      nextDate = startOfDay(d);
      if (nextDate.getTime() !== existing.date.getTime()) {
        const clash = await ProductProduction.findOne({
          date: nextDate,
          isActive: true,
          _id: { $ne: existing._id },
        });
        if (clash) {
          return res.status(409).json({ success: false, message: "Another entry already exists for that date." });
        }
      }
    }

    let nextQtys = { ...oldQtys };
    let nextTape = oldTape;
    let nextScrap = Number(existing.scrapKg || 0);
    let nextNotes = existing.notes;
    let nextWorkers = existing.workers;

    try {
      if (req.body.qty2kg !== undefined) nextQtys["2kg"] = parseNum(req.body.qty2kg, "2kg quantity");
      if (req.body.qty5kg !== undefined) nextQtys["5kg"] = parseNum(req.body.qty5kg, "5kg quantity");
      if (req.body.qty8kg !== undefined) nextQtys["8kg"] = parseNum(req.body.qty8kg, "8kg quantity");
      if (req.body.qty10kg !== undefined) nextQtys["10kg"] = parseNum(req.body.qty10kg, "10kg quantity");
      if (req.body.tapeUsedBox !== undefined) nextTape = parseNum(req.body.tapeUsedBox, "tape used (boxes)");
      if (req.body.scrapKg !== undefined) nextScrap = parseNum(req.body.scrapKg, "scrap (kg)");
    } catch (validationErr) {
      return res.status(validationErr.status || 400).json({ success: false, message: validationErr.message });
    }

    if (req.body.notes !== undefined) {
      nextNotes = safeString(req.body.notes, 1000) || undefined;
    }

    if (req.body.workers !== undefined) {
      nextWorkers = await buildWorkerProduction(req.body.workers, nextQtys);
    }

    const newConsumption = computeConsumption({
      qty2kg: nextQtys["2kg"],
      qty5kg: nextQtys["5kg"],
      qty8kg: nextQtys["8kg"],
      qty10kg: nextQtys["10kg"],
    });
    newConsumption.steelNeeded = Math.round((newConsumption.steelNeeded + nextScrap) * 1000) / 1000;
    newConsumption.reelsBySize = Object.fromEntries(
      Object.entries(newConsumption.reelsBySize || {}).filter(([, q]) => Number(q) > 0)
    );
    newConsumption.tapeNeeded = nextTape;

    await verifyStockAvailable(newConsumption, allowReserved);

    let saved = null;

    await session.withTransaction(async () => {
      const entry = await ProductProduction.findById(req.params.id).session(session);
      if (!entry || !entry.isActive) {
        const err = new Error("Entry not found");
        err.status = 404;
        throw err;
      }

      await refundRawMaterials({
        consumed: oldConsumed,
        productionId: entry._id,
        userId: req.user?._id,
        tapeUsedBox: oldTape,
        session,
      });

      entry.date = nextDate;
      entry.qty2kg = nextQtys["2kg"];
      entry.qty5kg = nextQtys["5kg"];
      entry.qty8kg = nextQtys["8kg"];
      entry.qty10kg = nextQtys["10kg"];
      entry.tapeUsedBox = nextTape;
      entry.scrapKg = nextScrap;
      entry.notes = nextNotes;
      entry.workers = nextWorkers;

      const newConsumed = await deductRawMaterials({
        ...newConsumption,
        productionId: entry._id,
        userId: req.user?._id,
        session,
      });
      entry.consumed = newConsumed;

      await adjustProductionStockByDelta({
        oldQtys,
        newQtys: nextQtys,
        productionId: entry._id,
        userId: req.user?._id,
        session,
      });

      entry.updatedBy = req.user?._id || null;
      await entry.save({ session });
      saved = entry;
    });

    return res.status(200).json({
      success: true,
      message: "Production entry updated",
      data: saved,
    });
  } catch (error) {
    handleError(res, error, "Failed to update production entry");
  } finally {
    await session.endSession();
  }
};

const deleteProduction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    await session.withTransaction(async () => {
      const entry = await ProductProduction.findById(req.params.id).session(session);
      if (!entry || !entry.isActive) {
        const err = new Error("Entry not found");
        err.status = 404;
        throw err;
      }

      const consumedObj = entry.consumed
        ? (typeof entry.consumed.toObject === "function" ? entry.consumed.toObject() : entry.consumed)
        : null;

      await refundRawMaterials({
        consumed: consumedObj,
        productionId: entry._id,
        userId: req.user?._id,
        tapeUsedBox: entry.tapeUsedBox || 0,
        session,
      });

      await revertProductionFromStock({
        qtys: buildQtys(entry),
        productionId: entry._id,
        userId: req.user?._id,
        session,
      });

      entry.isActive = false;
      entry.updatedBy = req.user?._id || null;
      await entry.save({ session });
    });

    return res.status(200).json({ success: true, message: "Entry deleted" });
  } catch (error) {
    handleError(res, error, "Failed to delete entry");
  } finally {
    await session.endSession();
  }
};

const previewConsumption = async (req, res) => {
  try {
    const { qty2kg = 0, qty5kg = 0, qty8kg = 0, qty10kg = 0 } = req.query;
    const consumption = computeConsumption({ qty2kg, qty5kg, qty8kg, qty10kg });

    const steel = consumption.steelNeeded > 0 ? await findSteelStock() : null;
    const reels = [];
    for (const [size, qty] of Object.entries(consumption.reelsBySize)) {
      if (!qty || qty <= 0) continue;
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

const debugReels = async (req, res) => {
  try {
    const allReels = await RawStock.find({}).select("category name sizeKg unit quantity isActive");
    return res.status(200).json({ success: true, count: allReels.length, data: allReels });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllProductStock,
  updateProductReserved,
  adjustProductStock,
  recordProductScrap,
  getProductStockMovements,

  getAllProductions,
  getProductionById,
  createProduction,
  updateProduction,
  deleteProduction,
  previewConsumption,
  debugReels,
};