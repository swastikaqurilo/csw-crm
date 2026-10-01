const mongoose = require('mongoose');
const { ALLOWED_UNITS, toKg } = require('../utils/units');

const PACKAGING_FORMS = ['None', 'Reel', 'Coil', 'Spool', 'Bobbin'];
const REEL_PACKAGING = ['Reel', 'Coil', 'Spool', 'Bobbin'];

const escapeRegex = (str) =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- movement entry subdocument ---------- */

const movementEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['in', 'out', 'adjustment', 'order-confirmed', 'order-cancelled', 'scrap', 'transfer'],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    unitAtTime: { type: String, required: true },
    beforeQty: { type: Number, required: true },
    afterQty: { type: Number, required: true },

    reason: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 500 },

    refType: {
      type: String,
      enum: ['Manual', 'Order', 'Purchase', 'Production', 'Scrap', 'Transfer'],
      default: 'Manual',
    },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    refLabel: { type: String, trim: true, maxlength: 60, default: null },

    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

/* ---------- family head lookup (used by the unit lock) ---------- */

async function findFamilyHead(doc) {
  if (!doc) return null;

  if (doc.inventoryType === 'Product') {
    if (!doc.product) return null;
    return Inventory.findOne({
      inventoryType: 'Product',
      product: doc.product,
      isActive: true,
    })
      .sort({ createdAt: 1 })
      .select('unit packaging reelSize scrapPerReel materialName');
  }

  if (!doc.materialName || typeof doc.materialName !== 'string') return null;
  if (!doc.materialName.trim()) return null;

  return Inventory.findOne({
    inventoryType: 'Raw Material',
    materialName: {
      $regex: `^${escapeRegex(doc.materialName.trim())}$`,
      $options: 'i',
    },
    isActive: true,
  })
    .sort({ createdAt: 1 })
    .select('unit packaging reelSize scrapPerReel materialName');
}

/* ---------- main inventory schema ---------- */

const inventorySchema = new mongoose.Schema(
  {
    inventoryType: {
      type: String,
      enum: {
        values: ['Product', 'Raw Material'],
        message: '{VALUE} is not a valid inventory type',
      },
      required: [true, 'Inventory type is required'],
      default: 'Product',
      immutable: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductStock',   // was 'Product'
      default: null,
      immutable: true,
    },

    materialName: {
      type: String,
      trim: true,
      default: null,
      maxlength: [150, 'Material name too long'],
      immutable: true,
    },

    unit: {
      type: String,
      enum: { values: ALLOWED_UNITS, message: '{VALUE} is not a valid unit' },
      required: [true, 'Unit is required'],
      immutable: true,
    },

    packaging: {
      type: String,
      enum: { values: PACKAGING_FORMS, message: '{VALUE} is not a valid packaging form' },
      default: 'None',
      immutable: true,
    },

    reelSize: {
      type: Number,
      min: [0, 'Reel size cannot be negative'],
      max: [100000, 'Reel size too large'],
      default: null,
    },

    scrapPerReel: {
      type: Number,
      min: [0, 'Scrap per reel cannot be negative'],
      max: [100000, 'Scrap per reel too large'],
      default: null,
    },

    warehouse: {
      type: String,
      default: 'Main',
      trim: true,
      maxlength: [100, 'Warehouse name too long'],
    },

    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      max: [1000000, 'Quantity too large'],
      default: 0,
    },

    reorderLevel: { type: Number, default: 0, min: 0, max: 1000000 },
    criticalLevel: { type: Number, default: 0, min: 0, max: 1000000 },

    ratePerKg: { type: Number, default: 0, min: 0, max: 10000000 },
    ratePerUnit: { type: Number, default: null, min: 0 },

    lastReceivedAt: { type: Date, default: null },
    lastIssuedAt: { type: Date, default: null },

    batchNumber: { type: String, trim: true, maxlength: 50 },
    location: { type: String, trim: true, maxlength: 150 },
    notes: { type: String, trim: true, maxlength: 5000 },

    movementLog: {
      type: [movementEntrySchema],
      default: [],
    },

    isActive: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

/* ---------- pre-validate: identity, cross-field, unit lock ---------- */

inventorySchema.pre('validate', async function () {
  if (this.inventoryType === 'Product') {
    if (!this.product) {
      this.invalidate('product', 'Product is required for Product inventory.');
    }
    this.materialName = null;
    this.packaging = 'None';
    this.reelSize = null;
    this.scrapPerReel = null;
  } else if (this.inventoryType === 'Raw Material') {
    if (!this.materialName || !this.materialName.trim()) {
      this.invalidate('materialName', 'Material name is required for Raw Material inventory.');
    }
    this.product = null;
  } else {
    this.invalidate('inventoryType', 'Inventory type must be Product or Raw Material.');
    return;
  }

  if (Number(this.criticalLevel) > Number(this.reorderLevel)) {
    this.invalidate('criticalLevel', 'Critical level cannot be greater than reorder level.');
  }

  if (this.inventoryType === 'Raw Material') {
    const usesReel = REEL_PACKAGING.includes(this.packaging);
    if (usesReel) {
      if (this.reelSize == null || Number(this.reelSize) <= 0) {
        this.invalidate('reelSize', `Reel size (Kg) is required when packaging is ${this.packaging}.`);
      }
    } else {
      this.reelSize = null;
      this.scrapPerReel = null;
    }
  }

  if (!this.isNew) return;

  const head = await findFamilyHead(this);
  if (!head) return;

  if (!this.unit) {
    this.unit = head.unit;
  } else if (this.unit !== head.unit) {
    this.invalidate(
      'unit',
      `Unit is locked to "${head.unit}" for this ${
        this.inventoryType === 'Product' ? 'product' : `material "${head.materialName}"`
      }. Use "${head.unit}" or create a separate material with a different name.`
    );
  }

  if (this.inventoryType === 'Raw Material') {
    if (!this.packaging || this.packaging === 'None') {
      this.packaging = head.packaging || 'None';
    } else if (this.packaging !== head.packaging) {
      this.invalidate(
        'packaging',
        `Packaging is locked to "${head.packaging}" for material "${head.materialName}".`
      );
    }
  }
});

/* ---------- pre-save: belt-and-braces on locked fields ---------- */

inventorySchema.pre('save', function () {
  if (!this.isNew) {
    const guarded = [
      'unit',
      'inventoryType',
      'product',
      'materialName',
      'packaging',
    ];
    for (const field of guarded) {
      if (this.isModified(field)) {
        throw new Error(
          `"${field}" is locked after creation and cannot be modified.`
        );
      }
    }
  }
});

/* ---------- virtuals ---------- */

inventorySchema.virtual('available').get(function () {
  return Math.max(Number(this.quantity || 0) - Number(this.reorderLevel || 0), 0);
});

inventorySchema.virtual('reelCount').get(function () {
  if (!REEL_PACKAGING.includes(this.packaging)) return 0;
  if (!this.reelSize) return 0;
  const kg = toKg(this.quantity, this.unit);
  if (kg == null) return 0;
  return kg / Number(this.reelSize);
});

inventorySchema.virtual('estimatedScrapKg').get(function () {
  if (!this.scrapPerReel) return 0;
  return this.reelCount * Number(this.scrapPerReel);
});

inventorySchema.virtual('stockValue').get(function () {
  const kg = toKg(this.quantity, this.unit);
  if (kg != null) return kg * Number(this.ratePerKg || 0);
  if (this.ratePerUnit != null) return Number(this.quantity || 0) * Number(this.ratePerUnit);
  return 0;
});

inventorySchema.virtual('isLowStock').get(function () {
  return Number(this.quantity || 0) <= Number(this.reorderLevel || 0);
});

inventorySchema.virtual('isCritical').get(function () {
  return (
    Number(this.criticalLevel || 0) > 0 &&
    Number(this.quantity || 0) <= Number(this.criticalLevel || 0)
  );
});

inventorySchema.virtual('isDeadStock').get(function () {
  const last = this.lastIssuedAt || this.lastReceivedAt;
  if (!last) return false;
  return (Date.now() - new Date(last).getTime()) / 86400000 >= 30;
});

inventorySchema.virtual('displayName').get(function () {
  if (this.inventoryType === 'Product') {
    return this.product?.name || 'Unknown Product';
  }
  return this.materialName || 'Unknown Material';
});

inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

/* ---------- indexes ---------- */

inventorySchema.index(
  { product: 1, warehouse: 1, inventoryType: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true, inventoryType: 'Product' },
  }
);

inventorySchema.index(
  { materialName: 1, warehouse: 1, batchNumber: 1, inventoryType: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true, inventoryType: 'Raw Material' },
  }
);

inventorySchema.index({ inventoryType: 1, materialName: 1, createdAt: 1 });
inventorySchema.index({ inventoryType: 1, product: 1, createdAt: 1 });

const Inventory = mongoose.model('Inventory', inventorySchema);
module.exports = Inventory;
