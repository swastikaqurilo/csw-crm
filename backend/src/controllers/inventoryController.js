const Inventory = require('../models/Inventory');
const Product = require('../models/Product'); 

const getAllInventory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      lowStock,
      warehouse,
      product,
    } = req.query;

    const query = { isActive: true };

    if (warehouse) query.warehouse = warehouse;
    if (product) query.product = product;
    if (lowStock === 'true') {

      query.$expr = { $lte: ['$quantity', '$reorderLevel'] };
    }

    if (search) {
      query.$or = [
        { batchNumber: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [inventory, total] = await Promise.all([
      Inventory.find(query)
        .populate('product', 'name code diameter grade tensileStrength unit') 
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Inventory.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: inventory.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: inventory,
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching inventory',
      error: error.message,
    });
  }
};

const getInventoryById = async (req, res) => {
  try {
    const inventory = await Inventory.findById(req.params.id).populate(
      'product',
      'name code diameter grade tensileStrength unit sellingPrice'
    );

    if (!inventory || !inventory.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Inventory record not found',
      });
    }

    res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error('Get inventory by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const createInventory = async (req, res) => {
  try {
    const { product, warehouse, quantity, reorderLevel, batchNumber, unit, location, notes } =
      req.body;

    const productExists = await Product.findById(product);
    if (!productExists) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const existing = await Inventory.findOne({
      product,
      warehouse: warehouse || 'Main',
      batchNumber: batchNumber || null,
      isActive: true,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Inventory record already exists for this product/warehouse/batch. Use stock adjustment instead.',
      });
    }

    const inventory = await Inventory.create({
      product,
      warehouse: warehouse || 'Main',
      quantity: quantity || 0,
      reorderLevel: reorderLevel || 0,
      batchNumber,
      unit: unit || productExists.unit || 'kg',
      location,
      notes,
    });

    const populated = await inventory.populate(
      'product',
      'name code diameter grade'
    );

    res.status(201).json({
      success: true,
      message: 'Inventory record created successfully',
      data: populated,
    });
  } catch (error) {
    console.error('Create inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating inventory',
      error: error.message,
    });
  }
};

const updateInventory = async (req, res) => {
  try {
    const inventory = await Inventory.findById(req.params.id);

    if (!inventory || !inventory.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Inventory record not found',
      });
    }

    const allowedUpdates = ['reorderLevel', 'location', 'notes', 'warehouse', 'batchNumber', 'unit'];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        inventory[field] = req.body[field];
      }
    });

    await inventory.save();

    const populated = await inventory.populate('product', 'name code diameter grade');

    res.status(200).json({
      success: true,
      message: 'Inventory updated successfully',
      data: populated,
    });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const adjustStock = async (req, res) => {
  try {
    const { type, quantity, reason, notes } = req.body; // type: 'in' | 'out' | 'adjustment'

    if (!['in', 'out', 'adjustment'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be one of: in, out, adjustment',
      });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive number',
      });
    }

    const inventory = await Inventory.findById(req.params.id);

    if (!inventory || !inventory.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Inventory record not found',
      });
    }

    let newQuantity = inventory.quantity;

    if (type === 'in') {
      newQuantity += quantity;
    } else if (type === 'out') {
      if (inventory.quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${inventory.quantity}`,
        });
      }
      newQuantity -= quantity;
    } else if (type === 'adjustment') {

      newQuantity = quantity;
    }

    inventory.quantity = newQuantity;

    if (notes || reason) {
      inventory.notes = `${inventory.notes || ''}\n[${new Date().toISOString()}] ${type.toUpperCase()}: ${quantity} | ${reason || ''} ${notes || ''}`.trim();
    }

    await inventory.save();

    const populated = await inventory.populate('product', 'name code diameter grade');

    res.status(200).json({
      success: true,
      message: `Stock ${type} successful`,
      data: populated,
    });
  } catch (error) {
    console.error('Adjust stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adjusting stock',
      error: error.message,
    });
  }
};

const deleteInventory = async (req, res) => {
  try {
    const inventory = await Inventory.findById(req.params.id);

    if (!inventory || !inventory.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Inventory record not found',
      });
    }

    inventory.isActive = false;

    await inventory.save();

    res.status(200).json({
      success: true,
      message: 'Inventory record deleted successfully',
    });
  } catch (error) {
    console.error('Delete inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const getLowStock = async (req, res) => {
  try {
    const lowStockItems = await Inventory.find({
      isActive: true,
      $expr: { $lte: ['$quantity', '$reorderLevel'] },
    }).populate('product', 'name code diameter grade unit');

    res.status(200).json({
      success: true,
      count: lowStockItems.length,
      data: lowStockItems,
    });
  } catch (error) {
    console.error('Low stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  getAllInventory,
  getInventoryById,
  createInventory,
  updateInventory,
  adjustStock,
  deleteInventory,
  getLowStock,
};