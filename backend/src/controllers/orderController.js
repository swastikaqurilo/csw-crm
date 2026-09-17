const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Contact = require('../models/Contacts');

const generateOrderNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;

  const lastOrder = await Order.findOne({
    orderNumber: { $regex: `^${prefix}` },
  })
    .sort({ orderNumber: -1 })
    .select('orderNumber');

  let nextNumber = 1;
  if (lastOrder) {
    const lastNum = parseInt(lastOrder.orderNumber.split('-')[2], 10);
    nextNumber = lastNum + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
};

const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      contact,
      search,
      fromDate,
      toDate,
    } = req.query;

    const query = { isActive: true };

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (contact) query.contact = contact;

    if (fromDate || toDate) {
      query.orderDate = {};
      if (fromDate) query.orderDate.$gte = new Date(fromDate);
      if (toDate) query.orderDate.$lte = new Date(toDate);
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('contact', 'name company phone email')
        .populate('enquiry', 'enquiryNumber subject')
        .populate('items.product', 'name code diameter grade')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Order.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: orders,
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders',
      error: error.message,
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('contact', 'name company phone email address')
      .populate('enquiry', 'enquiryNumber subject')
      .populate('items.product', 'name code diameter grade unit sellingPrice');

    if (!order || !order.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const createOrder = async (req, res) => {
  try {
    const {
      enquiry,
      contact,
      items,
      discount = 0,
      taxPercent = 18,
      expectedDeliveryDate,
      shippingAddress,
      billingAddress,
      notes,
      status = 'Draft',
    } = req.body;

    const contactExists = await Contact.findById(contact);
    if (!contactExists) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must have at least one item',
      });
    }

    let subTotal = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`,
        });
      }

      const rate = item.rate !== undefined ? item.rate : product.sellingPrice || 0;
      const qty = item.quantity;
      const lineDiscount = item.discount || 0;
      const amount = qty * rate - lineDiscount;

      processedItems.push({
        product: item.product,
        quantity: qty,
        unit: item.unit || product.unit || 'kg',
        rate,
        discount: lineDiscount,
        amount,
      });

      subTotal += amount;
    }

    const taxAmount = ((subTotal - discount) * taxPercent) / 100;
    const grandTotal = subTotal - discount + taxAmount;

    const orderNumber = await generateOrderNumber();

    const order = await Order.create({
      orderNumber,
      enquiry,
      contact,
      items: processedItems,
      subTotal,
      discount,
      taxPercent,
      taxAmount,
      grandTotal,
      status,
      expectedDeliveryDate,
      shippingAddress,
      billingAddress,
      notes,
    });

    const populated = await Order.findById(order._id)
      .populate('contact', 'name company phone')
      .populate('items.product', 'name code diameter grade');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: populated,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating order',
      error: error.message,
    });
  }
};

const updateOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order || !order.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.status !== 'Draft' && req.body.items) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit items after order is confirmed. Create a new order or cancel this one.',
      });
    }

    const allowed = [
      'expectedDeliveryDate',
      'shippingAddress',
      'billingAddress',
      'notes',
      'discount',
      'taxPercent',
    ];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        order[field] = req.body[field];
      }
    });

    if (req.body.discount !== undefined || req.body.taxPercent !== undefined) {
      order.taxAmount = ((order.subTotal - order.discount) * order.taxPercent) / 100;
      order.grandTotal = order.subTotal - order.discount + order.taxAmount;
    }

    await order.save();

    const populated = await Order.findById(order._id)
      .populate('contact', 'name company')
      .populate('items.product', 'name code');

    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: populated,
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      'Draft',
      'Confirmed',
      'In Production',
      'Ready for Dispatch',
      'Dispatched',
      'Delivered',
      'Cancelled',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const order = await Order.findById(req.params.id).populate('items.product');

    if (!order || !order.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    if (status === 'Confirmed' && order.status === 'Draft') {
      for (const item of order.items) {
        const inventory = await Inventory.findOne({
          product: item.product._id,
          isActive: true,
        });

        if (!inventory) {
          return res.status(400).json({
            success: false,
            message: `No inventory found for product: ${item.product.name}`,
          });
        }

        if (inventory.quantity < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${item.product.name}. Available: ${inventory.quantity}`,
          });
        }

        inventory.quantity -= item.quantity;
        await inventory.save();
      }
    }

    if (status === 'Dispatched') {
      order.dispatchedDate = new Date();
    }
    if (status === 'Delivered') {
      order.deliveredDate = new Date();
    }

    order.status = status;
    await order.save();

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order,
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating status',
      error: error.message,
    });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order || !order.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (!['Draft', 'Cancelled'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only Draft or Cancelled orders can be deleted',
      });
    }

    order.isActive = false;
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
};