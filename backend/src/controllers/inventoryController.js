const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const { ALLOWED_UNITS, toKg } = require('../utils/units');

/* =========================================================
   CONSTANTS
========================================================= */

const MAX_NOTES_LENGTH = 5000;
const MAX_LIMIT = 200;
const MAX_QUANTITY = 1e6;
const MAX_RATE = 1e7;
const MAX_REEL_SIZE = 1e5;
const MAX_MOVEMENT_LOG = 200;
const PACKAGING_FORMS = ['None', 'Reel', 'Coil', 'Spool', 'Bobbin'];
const REEL_PACKAGING = ['Reel', 'Coil', 'Spool', 'Bobbin'];


/* =========================================================
   HELPERS
========================================================= */

const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 500) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t) return '';
  return t.slice(0, max);
};

const escapeRegex = (str) =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseNumeric = (raw, { min = 0, max = MAX_QUANTITY, field }) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return { ok: false, message: `${field} must be a number` };
  }
  if (n < min || n > max) {
    return {
      ok: false,
      message: `${field} must be between ${min.toLocaleString()} and ${max.toLocaleString()}`,
    };
  }
  return { ok: true, value: n };
};

const respondValidationError = (res, error) => {
  const errors = Object.values(error.errors || {}).map((e) => ({
    field: e.path,
    message: e.message,
  }));
  return res.status(400).json({
    success: false,
    message: errors[0]?.message || 'Validation failed',
    errors,
  });
};

/* =========================================================
   GET ALL INVENTORY
========================================================= */

const getAllInventory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      lowStock,
      criticalStock,
      deadStock,
      warehouse,
      product,
      inventoryType,
      materialName,
    } = req.query;

    const query = { isActive: true };
    const andConditions = [];

    if (inventoryType) {
      if (!['Product', 'Raw Material'].includes(inventoryType)) {
        return res.status(400).json({
          success: false,
          message: 'inventoryType must be either Product or Raw Material',
        });
      }
      query.inventoryType = inventoryType;
    }

    if (warehouse) query.warehouse = safeString(warehouse, 100);

    if (product) {
      if (!isValidId(product))
        return res.status(400).json({ success: false, message: 'Invalid product ID' });
      query.product = product;
    }

    if (materialName) {
      query.materialName = {
        $regex: `^${escapeRegex(String(materialName).trim().slice(0, 150))}$`,
        $options: 'i',
      };
    }

    if (lowStock === 'true') {
      andConditions.push({ $expr: { $lte: ['$quantity', '$reorderLevel'] } });
    }

    if (criticalStock === 'true') {
      andConditions.push({
        $expr: {
          $and: [
            { $gt: ['$criticalLevel', 0] },
            { $lte: ['$quantity', '$criticalLevel'] },
          ],
        },
      });
    }

    if (deadStock === 'true') {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      andConditions.push({
        $or: [
          { lastIssuedAt: { $lt: cutoff } },
          { lastIssuedAt: null, lastReceivedAt: { $lt: cutoff } },
        ],
      });
    }

    if (search && typeof search === 'string' && search.trim()) {
      const safe = escapeRegex(search.trim().slice(0, 100));
      const searchOr = [
        { batchNumber: { $regex: safe, $options: 'i' } },
        { location: { $regex: safe, $options: 'i' } },
        { notes: { $regex: safe, $options: 'i' } },
        { materialName: { $regex: safe, $options: 'i' } },
      ];
      andConditions.push({ $or: searchOr });
    }

    if (andConditions.length > 0) query.$and = andConditions;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);
    const skip = (pageNumber - 1) * limitNumber;

    const [inventory, total] = await Promise.all([
      Inventory.find(query)
        .populate('product', 'name productCode code diameter grade unit')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Inventory.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: inventory.length,
      total,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
      data: inventory,
    });
  } catch (error) {
    console.error('[getAllInventory]', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory',
    });
  }
};

/* =========================================================
   GET INVENTORY FAMILIES
   Distinct materials/products with their locked unit.
   Used by the frontend to populate "create inventory" dropdowns.
========================================================= */

const getInventoryFamilies = async (req, res) => {
  try {
    const { inventoryType, search } = req.query;

    const match = { isActive: true };
    if (inventoryType) {
      if (!['Product', 'Raw Material'].includes(inventoryType)) {
        return res.status(400).json({
          success: false,
          message: 'inventoryType must be either Product or Raw Material',
        });
      }
      match.inventoryType = inventoryType;
    }
    if (search && search.trim()) {
      match.materialName = {
        $regex: escapeRegex(search.trim().slice(0, 100)),
        $options: 'i',
      };
    }

    // Group by identity, keep the OLDEST record — that's the family head
    // that defined the locked unit + packaging.
    const families = await Inventory.aggregate([
      { $match: match },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id:
            match.inventoryType === 'Product'
              ? '$product'
              : { $toLower: '$materialName' },
          inventoryType: { $first: '$inventoryType' },
          product: { $first: '$product' },
          materialName: { $first: '$materialName' },
          unit: { $first: '$unit' },
          packaging: { $first: '$packaging' },
          reelSize: { $first: '$reelSize' },
          scrapPerReel: { $first: '$scrapPerReel' },
          recordCount: { $sum: 1 },
        },
      },
      { $sort: { materialName: 1 } },
    ]);

    // Populate product names for Product-type families
    const productIds = families
      .filter((f) => f.inventoryType === 'Product' && f.product)
      .map((f) => f.product);

    let productMap = {};
    if (productIds.length > 0) {
      const products = await Product.find({ _id: { $in: productIds } }).select(
        'name productCode code unit'
      );
      productMap = Object.fromEntries(products.map((p) => [String(p._id), p]));
    }

    const data = families.map((f) => {
      if (f.inventoryType === 'Product') {
        const p = productMap[String(f.product)];
        return {
          inventoryType: 'Product',
          product: f.product,
          name: p?.name || 'Unknown Product',
          productCode: p?.productCode || p?.code || null,
          unit: f.unit,
          packaging: 'None',
          reelSize: null,
          scrapPerReel: null,
          recordCount: f.recordCount,
        };
      }
      return {
        inventoryType: 'Raw Material',
        product: null,
        materialName: f.materialName,
        name: f.materialName,
        unit: f.unit,
        packaging: f.packaging,
        reelSize: f.reelSize,
        scrapPerReel: f.scrapPerReel,
        recordCount: f.recordCount,
      };
    });

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('[getInventoryFamilies]', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* =========================================================
   GET INVENTORY BY ID
========================================================= */

const getInventoryById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid inventory ID' });
    }

    const inventory = await Inventory.findById(req.params.id).populate(
      'product',
      'name productCode code diameter grade unit'
    );

    if (!inventory || !inventory.isActive) {
      return res.status(404).json({ success: false, message: 'Inventory record not found' });
    }

    res.status(200).json({ success: true, data: inventory });
  } catch (error) {
    console.error('[getInventoryById]', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* =========================================================
   CREATE INVENTORY
   Unit and packaging are chosen by the FIRST record for a given
   product/material. Every subsequent record inherits or is rejected.
   Enforcement lives in the model's pre-validate hook.
========================================================= */

const createInventory = async (req, res) => {
  try {
    const {
      inventoryType = 'Product',
      product,
      materialName,
      warehouse = 'Main',
      quantity = 0,
      unit,
      packaging = 'None',
      reelSize,
      scrapPerReel,
      reorderLevel = 0,
      criticalLevel = 0,
      ratePerKg = 0,
      ratePerUnit,
      batchNumber,
      location,
      notes,
    } = req.body;

    /* ---------- identity ---------- */
    if (!['Product', 'Raw Material'].includes(inventoryType)) {
      return res.status(400).json({
        success: false,
        message: 'inventoryType must be either Product or Raw Material',
      });
    }

    /* ---------- numeric validation ---------- */
    const qtyCheck = parseNumeric(quantity, { field: 'Quantity', max: MAX_QUANTITY });
    if (!qtyCheck.ok) return res.status(400).json({ success: false, message: qtyCheck.message });

    const reorderCheck = parseNumeric(reorderLevel, { field: 'Reorder level', max: MAX_QUANTITY });
    if (!reorderCheck.ok) return res.status(400).json({ success: false, message: reorderCheck.message });

    const criticalCheck = parseNumeric(criticalLevel, { field: 'Critical level', max: MAX_QUANTITY });
    if (!criticalCheck.ok) return res.status(400).json({ success: false, message: criticalCheck.message });

    if (criticalCheck.value > reorderCheck.value) {
      return res.status(400).json({
        success: false,
        message: 'Critical level cannot be greater than reorder level',
      });
    }

    const rateKgCheck = parseNumeric(ratePerKg, { field: 'Rate per Kg (₹)', max: MAX_RATE });
    if (!rateKgCheck.ok) return res.status(400).json({ success: false, message: rateKgCheck.message });

    if (ratePerUnit !== undefined && ratePerUnit !== null) {
      const rpu = parseNumeric(ratePerUnit, { field: 'Rate per unit (₹)', max: MAX_RATE });
      if (!rpu.ok) return res.status(400).json({ success: false, message: rpu.message });
    }

    /* ---------- strings ---------- */
    const cleanWarehouse = safeString(warehouse, 100) || 'Main';
    const cleanBatch = safeString(batchNumber, 50) || undefined;
    const cleanLocation = safeString(location, 150) || undefined;
    const cleanNotes = safeString(notes, MAX_NOTES_LENGTH) || undefined;

    /* ---------- unit enum check (before hitting the lock) ---------- */
    if (unit !== undefined && unit !== null && !ALLOWED_UNITS.includes(unit)) {
      return res.status(400).json({
        success: false,
        message: `Unit must be one of: ${ALLOWED_UNITS.join(', ')}`,
      });
    }

    if (!PACKAGING_FORMS.includes(packaging)) {
      return res.status(400).json({
        success: false,
        message: `Packaging must be one of: ${PACKAGING_FORMS.join(', ')}`,
      });
    }

    /* =========================================================
       PRODUCT
    ========================================================= */
    if (inventoryType === 'Product') {
      if (!product || !isValidId(product)) {
        return res.status(400).json({
          success: false,
          message: 'Valid product ID is required for Product inventory',
        });
      }

      const productDoc = await Product.findById(product);
      if (!productDoc) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      // Inherit the unit from Product master when the client doesn't pass one.
      // The model's lock hook will also enforce consistency against siblings.
      const resolvedUnit = unit || productDoc.unit || 'Ton';

      const duplicate = await Inventory.findOne({
        inventoryType: 'Product',
        product,
        warehouse: cleanWarehouse,
        isActive: true,
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            'Inventory record already exists for this product and warehouse. Use stock adjustment instead.',
        });
      }

      const inventory = await Inventory.create({
        inventoryType: 'Product',
        product,
        materialName: null,
        packaging: 'None',
        reelSize: null,
        scrapPerReel: null,
        unit: resolvedUnit,
        warehouse: cleanWarehouse,
        quantity: qtyCheck.value,
        reorderLevel: reorderCheck.value,
        criticalLevel: criticalCheck.value,
        ratePerKg: rateKgCheck.value,
        ratePerUnit:
          ratePerUnit === undefined || ratePerUnit === null
            ? null
            : Number(ratePerUnit),
        batchNumber: cleanBatch,
        location: cleanLocation,
        notes: cleanNotes,
        createdBy: req.user?._id,
      });

      const populated = await inventory.populate(
        'product',
        'name productCode code diameter grade unit'
      );

      return res.status(201).json({
        success: true,
        message: 'Product inventory created successfully',
        data: populated,
      });
    }

    /* =========================================================
       RAW MATERIAL
    ========================================================= */
    const cleanMaterialName = safeString(materialName, 150);
    if (!cleanMaterialName) {
      return res.status(400).json({
        success: false,
        message: 'Material name is required for Raw Material inventory',
      });
    }

    const usesReel = REEL_PACKAGING.includes(packaging);

    let numericReelSize = null;
    let numericScrapPerReel = null;

    if (usesReel) {
      const reelCheck = parseNumeric(reelSize, {
        field: 'Reel size (Kg)',
        min: 0.001,
        max: MAX_REEL_SIZE,
      });
      if (!reelCheck.ok) return res.status(400).json({ success: false, message: reelCheck.message });
      numericReelSize = reelCheck.value;

      if (scrapPerReel !== undefined && scrapPerReel !== null && scrapPerReel !== '') {
        const scrapCheck = parseNumeric(scrapPerReel, {
          field: 'Scrap per reel (Kg)',
          min: 0,
          max: MAX_REEL_SIZE,
        });
        if (!scrapCheck.ok) return res.status(400).json({ success: false, message: scrapCheck.message });
        numericScrapPerReel = scrapCheck.value;
      }
    }

    // Duplicate detection: same name + warehouse + batch (case-insensitive).
    const duplicateQuery = {
      inventoryType: 'Raw Material',
      materialName: {
        $regex: `^${escapeRegex(cleanMaterialName)}$`,
        $options: 'i',
      },
      warehouse: cleanWarehouse,
      isActive: true,
    };
    if (cleanBatch) {
      duplicateQuery.batchNumber = cleanBatch;
    } else {
      duplicateQuery.$or = [
        { batchNumber: { $exists: false } },
        { batchNumber: null },
        { batchNumber: '' },
      ];
    }

    const duplicate = await Inventory.findOne(duplicateQuery);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          'Inventory record already exists for this material, warehouse, and batch. Use stock adjustment instead.',
      });
    }

    // The model will look up the family head and enforce matching unit,
    // packaging, reelSize, and scrapPerReel. If `unit` is omitted here and a
    // family exists, the model inherits it. If no family exists and `unit` is
    // omitted, the model's `required` check fires with a clear error.
    const inventory = await Inventory.create({
      inventoryType: 'Raw Material',
      product: null,
      materialName: cleanMaterialName,
      packaging,
      reelSize: numericReelSize,
      scrapPerReel: numericScrapPerReel,
      unit,
      warehouse: cleanWarehouse,
      quantity: qtyCheck.value,
      reorderLevel: reorderCheck.value,
      criticalLevel: criticalCheck.value,
      ratePerKg: rateKgCheck.value,
      ratePerUnit:
        ratePerUnit === undefined || ratePerUnit === null
          ? null
          : Number(ratePerUnit),
      batchNumber: cleanBatch,
      location: cleanLocation,
      notes: cleanNotes,
      createdBy: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Raw material inventory created successfully',
      data: inventory,
    });
  } catch (error) {
    console.error('[createInventory]', error);

    if (error.name === 'ValidationError') return respondValidationError(res, error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate inventory record for this product/material, warehouse, and batch.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while creating inventory',
    });
  }
};

/* =========================================================
   UPDATE INVENTORY
   Unit, packaging, reel size, and identity fields are locked
   after creation. Any attempt to change them is rejected here,
   and again by the model (belt and braces).
========================================================= */

const updateInventory = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid inventory ID' });
    }

    const inventory = await Inventory.findById(req.params.id);
    if (!inventory || !inventory.isActive) {
      return res.status(404).json({ success: false, message: 'Inventory record not found' });
    }

    /* ---------- locked fields: hard reject ---------- */
    const LOCKED_FIELDS = [
      'unit',
      'inventoryType',
      'product',
      'materialName',
      'packaging',
    ];
    const attempted = LOCKED_FIELDS.filter((f) => req.body[f] !== undefined);
    if (attempted.length > 0) {
      return res.status(400).json({
        success: false,
        message: `These fields are locked after creation and cannot be changed: ${attempted.join(', ')}`,
        lockedFields: attempted,
      });
    }

    /* ---------- editable fields ---------- */
    const allowed = [
      'reorderLevel',
      'criticalLevel',
      'ratePerKg',
      'ratePerUnit',
      'location',
      'notes',
      'warehouse',
      'batchNumber',
      'reelSize',        // ← add
      'scrapPerReel',
    ];

    for (const field of allowed) {
      if (req.body[field] === undefined) continue;

      if (field === 'reorderLevel' || field === 'criticalLevel') {
        const check = parseNumeric(req.body[field], { field, max: MAX_QUANTITY });
        if (!check.ok) return res.status(400).json({ success: false, message: check.message });
        inventory[field] = check.value;
      } else if (field === 'ratePerKg') {
        const check = parseNumeric(req.body[field], { field: 'ratePerKg', max: MAX_RATE });
        if (!check.ok) return res.status(400).json({ success: false, message: check.message });
        inventory.ratePerKg = check.value;
      } else if (field === 'ratePerUnit') {
        if (req.body.ratePerUnit === null) {
          inventory.ratePerUnit = null;
          continue;
        }
        const check = parseNumeric(req.body.ratePerUnit, { field: 'ratePerUnit', max: MAX_RATE });
        if (!check.ok) return res.status(400).json({ success: false, message: check.message });
        inventory.ratePerUnit = check.value;
      } else if (field === 'warehouse') {
        const v = safeString(req.body.warehouse, 100);
        if (!v) return res.status(400).json({ success: false, message: 'Warehouse cannot be empty' });
        inventory.warehouse = v;
      } else if (field === 'batchNumber') {
        inventory.batchNumber = safeString(req.body.batchNumber, 50) || undefined;
      } else if (field === 'location') {
        inventory.location = safeString(req.body.location, 150) || undefined;
      } else if (field === 'notes') {
        inventory.notes = safeString(req.body.notes, MAX_NOTES_LENGTH) || undefined;
      }
    }

if (inventory.inventoryType === 'Raw Material') {
  if (req.body.reelSize !== undefined) {
    const n = Number(req.body.reelSize);
    if (!Number.isFinite(n) || n < 0 || n > 1e5) {
      return res.status(400).json({ success: false, message: 'Reel size must be between 0 and 100,000' });
    }
    inventory.reelSize = n > 0 ? n : null;
  }
  if (req.body.scrapPerReel !== undefined) {
    const n = Number(req.body.scrapPerReel);
    if (!Number.isFinite(n) || n < 0 || n > 1e5) {
      return res.status(400).json({ success: false, message: 'Scrap per reel must be between 0 and 100,000' });
    }
    inventory.scrapPerReel = n > 0 ? n : null;
  }
}

    if (Number(inventory.criticalLevel) > Number(inventory.reorderLevel)) {
      return res.status(400).json({
        success: false,
        message: 'Critical level cannot be greater than reorder level',
      });
    }

    if (req.user?._id) inventory.updatedBy = req.user._id;

    await inventory.save();

    const populated = await inventory.populate(
      'product',
      'name productCode code diameter grade unit'
    );

    res.status(200).json({
      success: true,
      message: 'Inventory updated successfully',
      data: populated,
    });
  } catch (error) {
    console.error('[updateInventory]', error);

    if (error.name === 'ValidationError') return respondValidationError(res, error);

    if (error.message?.includes('locked')) {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const adjustStock = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid inventory ID" });
    }

    const { type, quantity, reason, notes, refType, refId } = req.body;

    if (!["in", "out", "adjustment", "transfer", "scrap"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be one of: in, out, adjustment, transfer, scrap",
      });
    }

    const qtyCheck = parseNumeric(quantity, {
      field: "Quantity",
      min: 0.0001,
      max: MAX_QUANTITY,
    });
    if (!qtyCheck.ok) return res.status(400).json({ success: false, message: qtyCheck.message });
    const numericQuantity = qtyCheck.value;

    const inventory = await Inventory.findById(req.params.id);
    if (!inventory || !inventory.isActive) {
      return res.status(404).json({ success: false, message: "Inventory record not found" });
    }

    const before = Number(inventory.quantity || 0);
    let after = before;

    switch (type) {
      case "in":
        after = before + numericQuantity;
        inventory.lastReceivedAt = new Date();
        break;

      case "out":
      case "scrap":
      case "transfer":
        if (before < numericQuantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock. Available: ${before} ${inventory.unit}`,
          });
        }
        after = before - numericQuantity;
        inventory.lastIssuedAt = new Date();
        break;

      case "adjustment":
        // For adjustments, `quantity` is the NEW absolute level.
        after = numericQuantity;
        break;
    }

    if (after < 0) {
      return res.status(400).json({
        success: false,
        message: "Resulting quantity cannot be negative",
      });
    }
    if (after > MAX_QUANTITY) {
      return res.status(400).json({
        success: false,
        message: `Resulting quantity exceeds maximum (${MAX_QUANTITY.toLocaleString()})`,
      });
    }

    inventory.quantity = after;
    if (req.user?._id) inventory.updatedBy = req.user._id;

    const movementQuantity =
      type === "adjustment" ? Math.abs(after - before) : numericQuantity;

    // Append to embedded log. Bounded at 200 entries.
    if (!Array.isArray(inventory.movementLog)) inventory.movementLog = [];
    inventory.movementLog.push({
      type,
      quantity: movementQuantity,
      unitAtTime: inventory.unit,
      beforeQty: before,
      afterQty: after,
      reason: safeString(reason, 200) || null,
      notes: safeString(notes, 500) || null,
      refType: refType || "Manual",
      refId: refId && isValidId(refId) ? refId : null,
      refLabel: null,
      by: req.user?._id || null,
      at: new Date(),
    });
    if (inventory.movementLog.length > MAX_MOVEMENT_LOG) {
      inventory.movementLog = inventory.movementLog.slice(-MAX_MOVEMENT_LOG);
    }

    await inventory.save();

    const populated = await inventory.populate(
      "product",
      "name productCode code diameter grade unit"
    );

    res.status(200).json({
      success: true,
      message: `Stock ${type} recorded successfully`,
      data: populated,
    });
  } catch (error) {
    console.error("[adjustStock]", error);

    if (error.name === "ValidationError") return respondValidationError(res, error);

    res.status(500).json({
      success: false,
      message: "Server error while adjusting stock",
    });
  }
};

/* =========================================================
   DELETE INVENTORY (soft delete)
========================================================= */

const deleteInventory = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid inventory ID' });
    }

    const update = { isActive: false };
    if (req.user?._id) update.updatedBy = req.user._id;

    const inventory = await Inventory.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });

    if (!inventory) {
      return res.status(404).json({ success: false, message: 'Inventory record not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Inventory record deleted successfully',
    });
  } catch (error) {
    console.error('[deleteInventory]', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* =========================================================
   GET LOW STOCK
========================================================= */

const getLowStock = async (req, res) => {
  try {
    const { inventoryType } = req.query;

    const query = {
      isActive: true,
      $expr: { $lte: ['$quantity', '$reorderLevel'] },
    };

    if (inventoryType) {
      if (!['Product', 'Raw Material'].includes(inventoryType)) {
        return res.status(400).json({
          success: false,
          message: 'inventoryType must be either Product or Raw Material',
        });
      }
      query.inventoryType = inventoryType;
    }

    const lowStockItems = await Inventory.find(query)
      .populate('product', 'name productCode code diameter grade unit')
      .sort({ quantity: 1 })
      .limit(MAX_LIMIT);

    res.status(200).json({
      success: true,
      count: lowStockItems.length,
      data: lowStockItems,
    });
  } catch (error) {
    console.error('[getLowStock]', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* =========================================================
   GET CRITICAL STOCK
========================================================= */

const getCriticalStock = async (req, res) => {
  try {
    const { inventoryType } = req.query;

    const query = {
      isActive: true,
      criticalLevel: { $gt: 0 },
      $expr: { $lte: ['$quantity', '$criticalLevel'] },
    };

    if (inventoryType) {
      if (!['Product', 'Raw Material'].includes(inventoryType)) {
        return res.status(400).json({
          success: false,
          message: 'inventoryType must be either Product or Raw Material',
        });
      }
      query.inventoryType = inventoryType;
    }

    const criticalItems = await Inventory.find(query)
      .populate('product', 'name productCode code diameter grade unit')
      .sort({ quantity: 1 })
      .limit(MAX_LIMIT);

    res.status(200).json({
      success: true,
      count: criticalItems.length,
      data: criticalItems,
    });
  } catch (error) {
    console.error('[getCriticalStock]', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* =========================================================
   GET DEAD STOCK
========================================================= */

const getDeadStock = async (req, res) => {
  try {
    const { inventoryType, days = 30 } = req.query;

    const daysNumber = Math.min(Math.max(Number(days) || 30, 1), 3650);
    const cutoff = new Date(Date.now() - daysNumber * 24 * 60 * 60 * 1000);

    const query = {
      isActive: true,
      $or: [
        { lastIssuedAt: { $lt: cutoff } },
        { lastIssuedAt: null, lastReceivedAt: { $lt: cutoff } },
      ],
    };

    if (inventoryType) {
      if (!['Product', 'Raw Material'].includes(inventoryType)) {
        return res.status(400).json({
          success: false,
          message: 'inventoryType must be either Product or Raw Material',
        });
      }
      query.inventoryType = inventoryType;
    }

    const deadStockItems = await Inventory.find(query)
      .populate('product', 'name productCode code diameter grade unit')
      .sort({ lastIssuedAt: 1 })
      .limit(MAX_LIMIT);

    res.status(200).json({
      success: true,
      count: deadStockItems.length,
      days: daysNumber,
      data: deadStockItems,
    });
  } catch (error) {
    console.error('[getDeadStock]', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* =========================================================
   GET INVENTORY SUMMARY
   Units:
     totalWeight   → Ton (mass units only, converted via toKg)
     scrapWeight   → Kg (estimate, NOT subtracted from stock)
     value         → ₹
========================================================= */

const getInventorySummary = async (req, res) => {
  try {
    const [rawMaterials, products] = await Promise.all([
      Inventory.find({ isActive: true, inventoryType: 'Raw Material' }),
      Inventory.find({ isActive: true, inventoryType: 'Product' }).populate(
        'product',
        'name productCode code unit'
      ),
    ]);

    const all = [...rawMaterials, ...products];

    /** Sum mass-based quantities as Ton. Non-mass units are excluded. */
    const sumTons = (list) =>
      list.reduce((sum, it) => {
        const kg = toKg(it.quantity, it.unit);
        return sum + (kg == null ? 0 : kg / 1000);
      }, 0);

    /** Total ₹ value across all records, using the correct rate for each. */
    const sumValue = (list) =>
      list.reduce((sum, it) => sum + Number(it.stockValue || 0), 0);

    /** Kg of estimated scrap that the current raw stock will produce. */
    const rawScrapKg = rawMaterials.reduce(
      (sum, it) => sum + Number(it.estimatedScrapKg || 0),
      0
    );

    const lowStockCount = all.filter(
      (it) => Number(it.quantity || 0) <= Number(it.reorderLevel || 0)
    ).length;

    const criticalStockCount = all.filter(
      (it) =>
        Number(it.criticalLevel || 0) > 0 &&
        Number(it.quantity || 0) <= Number(it.criticalLevel || 0)
    ).length;

    res.status(200).json({
      success: true,
      data: {
        rawMaterial: {
          totalWeight: sumTons(rawMaterials), // Ton
          scrapWeight: rawScrapKg,            // Kg (estimate, informational)
          value: sumValue(rawMaterials),      // ₹
          count: rawMaterials.length,
        },
        product: {
          totalWeight: sumTons(products),     // Ton
          value: sumValue(products),          // ₹
          count: products.length,
        },
        reserve: {
          totalReserve: all.reduce(
            (sum, it) => sum + Number(it.criticalLevel || 0),
            0
          ),
          itemsBelowReserve: all.filter(
            (it) => Number(it.quantity || 0) <= Number(it.criticalLevel || 0)
          ).length,
        },
        alerts: {
          lowStockCount,
          criticalStockCount,
        },
      },
    });
  } catch (error) {
    console.error('[getInventorySummary]', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* =========================================================
   GET MOVEMENTS (per inventory record)
========================================================= */

/* =========================================================
   GET MOVEMENTS (embedded log, newest first)
========================================================= */

const getInventoryMovements = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid inventory ID" });
    }

    const inventory = await Inventory.findById(req.params.id)
      .select("movementLog unit materialName product quantity")
      .populate("product", "name productCode");

    if (!inventory || !inventory.isActive) {
      return res.status(404).json({ success: false, message: "Inventory record not found" });
    }

    // Reverse so newest is first
    const data = [...(inventory.movementLog || [])].reverse();

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("[getInventoryMovements]", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getAllInventory,
  getInventoryFamilies,
  getInventoryById,
  createInventory,
  updateInventory,
  adjustStock,
  deleteInventory,
  getLowStock,
  getCriticalStock,
  getDeadStock,
  getInventorySummary,
  getInventoryMovements,   // was: getMovements
};