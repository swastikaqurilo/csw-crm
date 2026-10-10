const mongoose = require("mongoose");
const Order = require("../models/Order");
const ProductStock = require("../models/ProductStock");
const Contact = require("../models/Contacts");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const { getNextSequence } = require("../models/Counter");

const MAX_LIMIT = 200;
const MAX_ITEMS = 100;
const MAX_QTY = 1_000_000;
const MAX_RATE = 100_000_000;
const MAX_AMOUNT = 1e12;
const MAX_MOVEMENT_LOG = 200;

const REEL_SIZES = ["2kg", "5kg", "8kg", "10kg"];

const VALID_STATUSES = [
  "Draft",
  "Confirmed",
  "In Production",
  "Ready for Dispatch",
  "Dispatched",
  "Delivered",
  "Cancelled",
];

const VALID_PAYMENT_STATUSES = ["Pending", "Partial", "Paid", "Overdue"];

const { getGlobalSettings } = require("../utils/getSettings");

const CONTACT_FIELDS =
  "name company role phone email address billingAddress shippingAddress " +
  "gstin state stateCode shippingName shippingCompany shippingGstin " +
  "shippingState shippingStateCode";

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const normalizePhone = (v) => {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
};

/* ---------- helpers ---------- */
const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 500) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : "";
};

const escapeRegex = (str) =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const handleError = (res, error, fallbackMessage) => {
  console.error(`[${fallbackMessage}]`, error);

  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join("; ") });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ success: false, message: `Invalid value for ${error.path}` });
  }
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate record, please retry" });
  }
  if (error.status) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: fallbackMessage });
};

const generateOrderNumber = async (session = null) => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`order-${year}`, session);

  let prefix = "ORD";
  try {
    const settings = await getGlobalSettings();
    if (settings?.numbering?.orderPrefix) prefix = settings.numbering.orderPrefix;
  } catch (_) { /* fallback */ }

  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
};

const generateInvoiceNumber = async (session = null) => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`invoice-${year}`, session);

  let prefix = "INV";
  try {
    const settings = await getGlobalSettings();
    if (settings?.invoice?.prefix) prefix = settings.invoice.prefix;
  } catch (_) {
  }

  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
};

const numberToWords = (number) => {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convertBelowThousand = (num) => {
    let result = "";
    if (num >= 100) { result += `${ones[Math.floor(num / 100)]} Hundred `; num %= 100; }
    if (num >= 20) { result += `${tens[Math.floor(num / 10)]} `; num %= 10; }
    if (num > 0) { result += `${ones[num]} `; }
    return result.trim();
  };

  if (!Number.isFinite(number)) return "";
  const value = Math.floor(number);
  if (value === 0) return "Zero";

  let num = value;
  let result = "";
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;

  if (crore) result += `${convertBelowThousand(crore)} Crore `;
  if (lakh) result += `${convertBelowThousand(lakh)} Lakh `;
  if (thousand) result += `${convertBelowThousand(thousand)} Thousand `;
  if (num) result += `${convertBelowThousand(num)} `;
  return result.trim();
};

const amountInWords = (amount) => {
  const rounded = Math.round(Number(amount || 0));
  return `Rupees ${numberToWords(rounded)} Only`;
};

const resolveStockId = (item) =>
  item.productStock?._id || item.productStock || null;

const deductOrderStock = async (
  order,
  user,
  allowReserved = false,
  session
) => {
  for (const item of order.items) {
    const stockId = resolveStockId(item);
    const qty = Number(item.quantity);
    const size = item.size;

    if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) {
      throw {
        status: 400,
        message: `Invalid quantity for ${size}.`,
      };
    }

    if (!stockId) {
      throw {
        status: 400,
        message: `Item ${size} has no stock reference.`,
      };
    }

    const stock = await ProductStock.findOne({
      _id: stockId,
      isActive: true,
    }).session(session);

    if (!stock) {
      throw {
        status: 404,
        message: `No active stock found for ${size} reel.`,
      };
    }

    const before = Number(stock.quantity || 0);
    const reservedBefore = Number(stock.reservedQty || 0);
    const freeBefore = before - reservedBefore;

    if (
      !Number.isFinite(before) ||
      !Number.isFinite(reservedBefore) ||
      before < 0 ||
      reservedBefore < 0 ||
      reservedBefore > before
    ) {
      throw {
        status: 409,
        message: `Invalid inventory reservation for ${size}. Correct the stock record before confirming this order.`,
      };
    }

    if (qty > before) {
      throw {
        status: 400,
        message: `Insufficient ${size} stock. Available: ${before} ${stock.unit}, required: ${qty}.`,
      };
    }

    const usedFromReserved = Math.max(qty - freeBefore, 0);

    if (usedFromReserved > 0 && !allowReserved) {
      throw {
        status: 409,
        code: "RESERVED_CONFLICT",
        message: `This order needs ${usedFromReserved} ${stock.unit} from reserved ${size} stock. Continue?`,
        data: {
          material: "product",
          size,
          name: stock.name,
          unit: stock.unit,
          totalQty: before,
          reservedQty: reservedBefore,
          freeQty: freeBefore,
          requested: qty,
          usedFromReserved,
        },
      };
    }

    const after = before - qty;
    const reservedAfter = reservedBefore - usedFromReserved;

    // Conditional update prevents silently overwriting a concurrent change.
    const result = await ProductStock.updateOne(
      {
        _id: stockId,
        isActive: true,
        quantity: before,
        reservedQty: reservedBefore,
      },
      [
        {
          $set: {
            quantity: after,
            reservedQty: reservedAfter,
            lastIssuedAt: "$$NOW",
            movementLog: {
              $slice: [
                {
                  $concatArrays: [
                    { $ifNull: ["$movementLog", []] },
                    [
                      {
                        type: "out",
                        quantity: qty,
                        unitAtTime: stock.unit,
                        beforeQty: before,
                        afterQty: after,
                        reason:
                          usedFromReserved > 0
                            ? `Order ${order.orderNumber} confirmed (used ${usedFromReserved} from reserved)`
                            : `Order ${order.orderNumber} confirmed`,
                        notes: null,
                        refType: "Dispatch",
                        refId: order._id,
                        refLabel: order.orderNumber,
                        by: user?._id || null,
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
      throw {
        status: 409,
        code: "STOCK_CHANGED",
        message: `Stock for ${size} changed while confirming this order. Please retry.`,
      };
    }

    item.reservedQtyUsed = usedFromReserved;
  }
};

// Consume a reservation owned by an order whose stockStatus is Reserved.
// This assumes the reservation workflow reserves each order item's full quantity.
const deductReservedOrderStock = async (order, user, session) => {
  for (const item of order.items) {
    const stockId = resolveStockId(item);
    const qty = Number(item.quantity);
    if (!stockId || !Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) {
      throw { status: 400, message: `Invalid reserved quantity for ${item.size}.` };
    }

    const stock = await ProductStock.findOne({ _id: stockId, isActive: true }).session(session);
    if (!stock) {
      throw { status: 404, message: `No active stock found for ${item.size} reel.` };
    }

    const before = Number(stock.quantity || 0);
    const reservedBefore = Number(stock.reservedQty || 0);
    if (
      !Number.isFinite(before) || !Number.isFinite(reservedBefore) ||
      before < qty || reservedBefore < qty || reservedBefore > before
    ) {
      throw {
        status: 409,
        code: "RESERVATION_INCONSISTENT",
        message: `The reserved stock for ${item.size} is insufficient or inconsistent. Verify this order's reservation before confirming it.`,
      };
    }

    const after = before - qty;
    const reservedAfter = reservedBefore - qty;
    const result = await ProductStock.updateOne(
      { _id: stockId, isActive: true, quantity: before, reservedQty: reservedBefore },
      [{
        $set: {
          quantity: after,
          reservedQty: reservedAfter,
          lastIssuedAt: "$$NOW",
          movementLog: {
            $slice: [
              {
                $concatArrays: [
                  { $ifNull: ["$movementLog", []] },
                  [{
                    type: "out",
                    quantity: qty,
                    unitAtTime: stock.unit,
                    beforeQty: before,
                    afterQty: after,
                    reason: `Reserved stock consumed for order ${order.orderNumber}`,
                    notes: null,
                    refType: "Dispatch",
                    refId: order._id,
                    refLabel: order.orderNumber,
                    by: user?._id || null,
                    at: "$$NOW",
                  }],
                ],
              },
              -MAX_MOVEMENT_LOG,
            ],
          },
        },
      }],
      {
        session,
        updatePipeline: true,
      }
    );

    if (result.modifiedCount !== 1) {
      throw {
        status: 409,
        code: "STOCK_CHANGED",
        message: `Reserved stock for ${item.size} changed while confirming this order. Please retry.`,
      };
    }
    item.reservedQtyUsed = qty;
  }
};


const restoreOrderStock = async (order, user, session) => {
  for (const item of order.items) {
    const stockId = resolveStockId(item);
    const qty = Number(item.quantity);

    if (!stockId || !Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) {
      throw {
        status: 400,
        message: `Invalid stock restoration data for ${item.size}.`,
      };
    }

    const stock = await ProductStock.findOne({
      _id: stockId,
      isActive: true,
    }).session(session);

    if (!stock) {
      throw {
        status: 409,
        message: `Cannot restore ${item.size}: active stock record not found.`,
      };
    }

    const before = Number(stock.quantity || 0);
    const reservedBefore = Number(stock.reservedQty || 0);

    // Restore only the portion that this order originally consumed
    // from reserved stock.
    const reservedQtyUsed = Number(item.reservedQtyUsed || 0);

    if (
      !Number.isFinite(before) ||
      before < 0 ||
      !Number.isFinite(reservedBefore) ||
      reservedBefore < 0 ||
      reservedBefore > before ||
      !Number.isFinite(reservedQtyUsed) ||
      reservedQtyUsed < 0 ||
      reservedQtyUsed > qty
    ) {
      throw {
        status: 409,
        code: "RESERVATION_INCONSISTENT",
        message: `Cannot safely restore ${item.size}: stock or reservation quantities are inconsistent.`,
      };
    }

    const after = before + qty;
    const reservedAfter = reservedBefore + reservedQtyUsed;

    if (
      !Number.isFinite(after) ||
      after > MAX_QTY ||
      reservedAfter > after
    ) {
      throw {
        status: 409,
        code: "RESERVATION_INCONSISTENT",
        message: `Restoring ${item.size} would create an invalid stock reservation.`,
      };
    }

    const result = await ProductStock.updateOne(
      {
        _id: stockId,
        isActive: true,
        quantity: before,
        reservedQty: reservedBefore,
      },
      [
        {
          $set: {
            quantity: after,
            reservedQty: reservedAfter,
            lastReceivedAt: "$$NOW",
            movementLog: {
              $slice: [
                {
                  $concatArrays: [
                    { $ifNull: ["$movementLog", []] },
                    [
                      {
                        type: "in",
                        quantity: qty,
                        unitAtTime: stock.unit,
                        beforeQty: before,
                        afterQty: after,
                        reason:
                          reservedQtyUsed > 0
                            ? `Cancelled order ${order.orderNumber}: restored ${qty} stock, including ${reservedQtyUsed} reserved`
                            : `Cancelled order ${order.orderNumber} stock restored`,
                        notes: null,
                        refType: "Manual",
                        refId: order._id,
                        refLabel: order.orderNumber,
                        by: user?._id || null,
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
      {
        session,
        updatePipeline: true,
      }
    );

    if (result.modifiedCount !== 1) {
      throw {
        status: 409,
        code: "STOCK_CHANGED",
        message: `Stock for ${item.size} changed during restoration. Please retry.`,
      };
    }
  }
};

const releaseOrderReservation = async (order, user, session) => {
  for (const item of order.items) {
    const stockId = resolveStockId(item);
    const qty = Number(item.quantity);
    if (!stockId || !Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) {
      throw {
        status: 400,
        message: `Invalid reservation release data for ${item.size}.`,
      };
    }

    const stock = await ProductStock.findOne({ _id: stockId, isActive: true }).session(session);
    if (!stock) {
      throw {
        status: 409,
        message: `Cannot release ${item.size} reservation: active stock record not found.`,
      };
    }

    const before = Number(stock.quantity || 0);
    const reservedBefore = Number(stock.reservedQty || 0);
    if (!Number.isFinite(before) || before < 0 || !Number.isFinite(reservedBefore) || reservedBefore < qty || reservedBefore > before) {
      throw {
        status: 409,
        code: "RESERVATION_INCONSISTENT",
        message: `Cannot safely release ${item.size} reservation. Verify the order reservation and stock record before retrying.`,
      };
    }

    const reservedAfter = reservedBefore - qty;
    const result = await ProductStock.updateOne(
      {
        _id: stockId,
        isActive: true,
        quantity: before,
        reservedQty: reservedBefore,
      },
      [
        {
          $set: {
            reservedQty: reservedAfter,
            movementLog: {
              $slice: [
                {
                  $concatArrays: [
                    { $ifNull: ["$movementLog", []] },
                    [
                      {
                        type: "adjustment",
                        quantity: qty,
                        unitAtTime: stock.unit,
                        beforeQty: before,
                        afterQty: before,
                        reason: `Reservation released for cancelled order ${order.orderNumber}`,
                        notes: null,
                        refType: "Manual",
                        refId: order._id,
                        refLabel: order.orderNumber,
                        by: user?._id || null,
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
      {
        session,
        updatePipeline: true,
      }
    );

    if (result.modifiedCount !== 1) {
      throw {
        status: 409,
        code: "STOCK_CHANGED",
        message: `Reservation for ${item.size} changed during cancellation. Please retry.`,
      };
    }
  }
};

const buildItems = async (rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw { status: 400, message: "Order must have at least one item" };
  }
  if (rawItems.length > MAX_ITEMS) {
    throw { status: 400, message: `Order cannot contain more than ${MAX_ITEMS} items` };
  }

  let subTotal = 0;
  const processed = [];

  for (const raw of rawItems) {
    const size = String(raw.size || "").trim();
    if (!REEL_SIZES.includes(size)) {
      throw { status: 400, message: `Invalid reel size: ${size}` };
    }

    const stock = await ProductStock.findOne({ size, isActive: true });
    if (!stock) {
      throw { status: 400, message: `Product stock for ${size} not found` };
    }

    const qty = Number(raw.quantity);
    const rate = Number(raw.rate ?? 0);
    const lineDiscount = Number(raw.discount ?? 0);

    if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) {
      throw { status: 400, message: `Quantity for ${size} must be between 0.01 and ${MAX_QTY}` };
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > MAX_RATE) {
      throw { status: 400, message: `Rate for ${size} must be between 0 and ${MAX_RATE}` };
    }
    if (!Number.isFinite(lineDiscount) || lineDiscount < 0 || lineDiscount > MAX_AMOUNT) {
      throw { status: 400, message: `Discount for ${size} must be a valid number` };
    }

    const amount = Math.max(0, qty * rate - lineDiscount);

    processed.push({
      productStock: stock._id,
      productName: stock.name,
      size,
      quantity: qty,
      unit: "Reel",
      rate,
      discount: lineDiscount,
      amount,
    });
    subTotal += amount;
  }
  return { items: processed, subTotal };
};

const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, paymentStatus, contact, search, fromDate, toDate } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);

    const query = { isActive: true };

    if (status && status !== "All") {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status filter" });
      }
      query.status = status;
    }
    if (paymentStatus && paymentStatus !== "All") {
      if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
        return res.status(400).json({ success: false, message: "Invalid paymentStatus filter" });
      }
      query.paymentStatus = paymentStatus;
    }
    if (contact) {
      if (!isValidId(contact)) {
        return res.status(400).json({ success: false, message: "Invalid contact ID" });
      }
      query.contact = contact;
    }
    if (search && typeof search === "string" && search.trim()) {
      const safe = escapeRegex(search.trim().slice(0, 100));
      query.$or = [
        { orderNumber: { $regex: safe, $options: "i" } },
        { customerName: { $regex: safe, $options: "i" } },
        { customerPhone: { $regex: safe, $options: "i" } },
        { notes: { $regex: safe, $options: "i" } },
      ];
    }
    if (fromDate || toDate) {
      query.orderDate = {};
      if (fromDate) {
        const d = parseDate(fromDate);
        if (!d) return res.status(400).json({ success: false, message: "Invalid fromDate" });
        query.orderDate.$gte = d;
      }
      if (toDate) {
        const d = parseDate(toDate);
        if (!d) return res.status(400).json({ success: false, message: "Invalid toDate" });
        query.orderDate.$lte = endOfDay(d);
      }
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("contact", CONTACT_FIELDS)
        .populate("enquiry", "enquiryNumber customerName company subject")
        .sort({ orderDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Order.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page: pageNumber,
      limit: limitNumber,
      pages: Math.max(Math.ceil(total / limitNumber), 1),
      data: orders,
    });
  } catch (error) {
    handleError(res, error, "Server error while fetching orders");
  }
};

const getOrderById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(req.params.id)
      .populate("contact", CONTACT_FIELDS)
      .populate("enquiry", "enquiryNumber customerName company phone email project location timeline");

    if (!order || !order.isActive) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    handleError(res, error, "Server error while fetching order");
  }
};

const createOrder = async (req, res) => {
  try {
    const {
      enquiry, contact, customerName, customerPhone,
      items, discount = 0, taxPercent = 18,
      expectedDeliveryDate, shippingAddress, billingAddress,
      notes, status = "Draft",
      allowReserved = false,
    } = req.body;

    if (
      typeof allowReserved !== "boolean" &&
      allowReserved !== "true" &&
      allowReserved !== "false"
    ) {
      return res.status(400).json({ success: false, message: "allowReserved must be a boolean" });
    }

    let contactDoc = null;
    let finalContactId = null;

    if (contact && isValidId(contact)) {
      contactDoc = await Contact.findById(contact);
      if (!contactDoc) {
        return res.status(404).json({ success: false, message: "Contact not found" });
      }
      finalContactId = contactDoc._id;
    } else if (customerName && customerPhone) {
      try {
        contactDoc = await Contact.create({
          name: String(customerName).trim().slice(0, 150),
          phone: normalizePhone(customerPhone),
          company: "",
          email: "",
        });
        finalContactId = contactDoc._id;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: err.message || "Failed to create new customer",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Either select a customer or provide a new customer's name and phone.",
      });
    }

    let cleanEnquiry = null;
    if (enquiry) {
      if (!isValidId(enquiry)) {
        return res.status(400).json({ success: false, message: "Invalid enquiry ID" });
      }
      cleanEnquiry = enquiry;
    }

    const orderDiscount = Number(discount || 0);
    if (!Number.isFinite(orderDiscount) || orderDiscount < 0 || orderDiscount > MAX_AMOUNT) {
      return res.status(400).json({ success: false, message: "Invalid discount" });
    }

    const numericTaxPercent = Number(taxPercent);
    if (!Number.isFinite(numericTaxPercent) || numericTaxPercent < 0 || numericTaxPercent > 100) {
      return res.status(400).json({ success: false, message: "Tax percent must be between 0 and 100" });
    }

    if (!["Draft", "Confirmed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "New orders can only be created as Draft or Confirmed.",
      });
    }

    let cleanExpectedDelivery;
    if (expectedDeliveryDate) {
      const d = parseDate(expectedDeliveryDate);
      if (!d) return res.status(400).json({ success: false, message: "Invalid expected delivery date" });
      cleanExpectedDelivery = d;
    }

    const { items: processedItems, subTotal } = await buildItems(items);

    const taxableAmount = Math.max(0, subTotal - orderDiscount);
    const taxAmount = round2((taxableAmount * numericTaxPercent) / 100);
    const grandTotal = round2(taxableAmount + taxAmount);

    const orderPayload = {
      enquiry: cleanEnquiry,
      contact: finalContactId,
      customerName:
        safeString(customerName, 150) ||
        (contactDoc.company
          ? `${contactDoc.company} — ${contactDoc.name}`
          : contactDoc.name),
      customerPhone:
        normalizePhone(customerPhone) || contactDoc.phone || "",
      items: processedItems,
      subTotal,
      discount: orderDiscount,
      taxPercent: numericTaxPercent,
      taxAmount,
      grandTotal,
      status,
      expectedDeliveryDate: cleanExpectedDelivery || null,
      shippingAddress: safeString(shippingAddress, 500) || "",
      billingAddress: safeString(billingAddress, 500) || "",
      notes: safeString(notes, 2000) || "",
      stockStatus: "Pending",
      createdBy: req.user?._id || null,
    };

    let order;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const orderNumber = await generateOrderNumber(session);
        [order] = await Order.create(
          [{ ...orderPayload, orderNumber }],
          { session }
        );

        if (order.status === "Confirmed") {
          await deductOrderStock(order, req.user, allowReserved === true || allowReserved === "true", session);
          order.stockStatus = "Deducted";
          order.stockDeductedAt = new Date();
          order.updatedBy = req.user?._id || null;
          await order.save({ session });
        }
      });
    } finally {
      await session.endSession();
    }

    const populated = await Order.findById(order._id)
      .populate("contact", CONTACT_FIELDS)
      .populate("enquiry", "enquiryNumber customerName company subject");

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: populated,
    });
  } catch (error) {
    if (error?.code === "RESERVED_CONFLICT") {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
        data: error.data,
      });
    }
    if (error?.code === "STOCK_CHANGED") {
      return res.status(409).json({ success: false, code: error.code, message: error.message });
    }
    if (error?.status) {
      return res.status(error.status).json({
        success: false,
        ...(error.code ? { code: error.code } : {}),
        message: error.message || "Failed to create order",
      });
    }
    handleError(res, error, "Server error while creating order");
  }
};

const updateOrder = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(req.params.id);
    if (!order || !order.isActive) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (req.body.items !== undefined && (order.status !== "Draft" || (order.stockStatus || "Pending") !== "Pending")) {
      return res.status(400).json({
        success: false,
        message: "Order items can only be edited while the order is Draft and has no stock reservation or deduction.",
      });
    }

    if (req.body.expectedDeliveryDate !== undefined) {
      if (req.body.expectedDeliveryDate === null || req.body.expectedDeliveryDate === "") {
        order.expectedDeliveryDate = null;
      } else {
        const d = parseDate(req.body.expectedDeliveryDate);
        if (!d) return res.status(400).json({ success: false, message: "Invalid expected delivery date" });
        order.expectedDeliveryDate = d;
      }
    }

    if (req.body.shippingAddress !== undefined) {
      order.shippingAddress = safeString(req.body.shippingAddress, 500) || "";
    }
    if (req.body.billingAddress !== undefined) {
      order.billingAddress = safeString(req.body.billingAddress, 500) || "";
    }
    if (req.body.notes !== undefined) {
      order.notes = safeString(req.body.notes, 2000) || "";
    }
    if (req.body.customerName !== undefined) {
      order.customerName = safeString(req.body.customerName, 150) || "";
    }
    if (req.body.customerPhone !== undefined) {
      order.customerPhone = safeString(req.body.customerPhone, 30) || "";
    }

    let totalsChanged = false;

    if (req.body.items !== undefined) {
      const { items: processedItems, subTotal } = await buildItems(req.body.items);
      order.items = processedItems;
      order.subTotal = subTotal;
      totalsChanged = true;
    }

    if (req.body.discount !== undefined) {
      const d = Number(req.body.discount);
      if (!Number.isFinite(d) || d < 0 || d > MAX_AMOUNT) {
        return res.status(400).json({ success: false, message: "Invalid discount" });
      }
      order.discount = d;
      totalsChanged = true;
    }

    if (req.body.taxPercent !== undefined) {
      const t = Number(req.body.taxPercent);
      if (!Number.isFinite(t) || t < 0 || t > 100) {
        return res.status(400).json({ success: false, message: "Tax percent must be between 0 and 100" });
      }
      order.taxPercent = t;
      totalsChanged = true;
    }

    if (totalsChanged) {
  const taxableAmount = Math.max(
    0,
    Number(order.subTotal || 0) - Number(order.discount || 0)
  );

  const taxAmount =
    (taxableAmount * Number(order.taxPercent || 0)) / 100;

  const grandTotal = round2(taxableAmount + taxAmount);
  const amountPaid = round2(Number(order.amountPaid || 0));

  if (amountPaid > grandTotal + 0.01) {
    return res.status(400).json({
      success: false,
      code: "ORDER_TOTAL_BELOW_PAID_AMOUNT",
      message:
        "The new order total cannot be lower than the amount already paid.",
    });
  }

  order.taxAmount = round2(taxAmount);
  order.grandTotal = grandTotal;

  if (amountPaid >= grandTotal) {
    order.paymentStatus = "Paid";
  } else if (order.paymentStatus === "Overdue") {
    order.paymentStatus = "Overdue";
  } else if (amountPaid > 0) {
    order.paymentStatus = "Partial";
  } else {
    order.paymentStatus = "Pending";
  }
}

    order.updatedBy = req.user?._id || null;
    await order.save();

    const populated = await Order.findById(order._id)
      .populate("contact", CONTACT_FIELDS)
      .populate("enquiry", "enquiryNumber customerName company subject");

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: populated,
    });
  } catch (error) {
    handleError(res, error, "Server error while updating order");
  }
};

const updateOrderStatus = async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID",
    });
  }

  const { status, allowReserved = false } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid order status",
    });
  }

  // Accept only actual booleans or their explicit string equivalents.
  if (
    typeof allowReserved !== "boolean" &&
    allowReserved !== "true" &&
    allowReserved !== "false"
  ) {
    return res.status(400).json({
      success: false,
      message: "allowReserved must be a boolean",
    });
  }

  const allowReservedStock = allowReserved === true || allowReserved === "true";
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({
        _id: req.params.id,
        isActive: true,
      }).session(session);

      if (!order) {
        throw {
          status: 404,
          message: "Order not found",
        };
      }

      const fromStatus = order.status;

      if (fromStatus === status) {
        return;
      }

      const allowedTransitions = {
        Draft: ["Confirmed", "Cancelled"],
        Confirmed: ["In Production", "Ready for Dispatch", "Cancelled"],
        "In Production": ["Ready for Dispatch", "Cancelled"],
        "Ready for Dispatch": ["Dispatched", "Cancelled"],
        Dispatched: ["Delivered"],
        Delivered: [],
        Cancelled: [],
      };

      if (!allowedTransitions[fromStatus]?.includes(status)) {
        throw {
          status: 400,
          code: "INVALID_STATUS_TRANSITION",
          message: `Cannot change order status from ${fromStatus} to ${status}.`,
        };
      }

      if (fromStatus === "Cancelled") {
        throw {
          status: 400,
          code: "ORDER_ALREADY_CANCELLED",
          message:
            "A cancelled order cannot be reactivated. Please create a new order instead.",
        };
      }

      const currentStockStatus = order.stockStatus || "Pending";

      const activePayments = await Payment.countDocuments({
        order: order._id,
        isActive: true,
      }).session(session);                                    // ← add .session()

      if (activePayments > 0) {
        throw {                                               // ← throw, not return
          status: 400,
          code: "ORDER_HAS_PAYMENTS",
          message: "This order has payment records. Delete or reverse those payments first.",
        };
      }

      if (status === "Confirmed" && currentStockStatus === "Pending") {
        await deductOrderStock(order, req.user, allowReservedStock, session);
        order.stockStatus = "Deducted";
        order.stockDeductedAt = new Date();
      } else if (status === "Confirmed" && currentStockStatus === "Reserved") {
        await deductReservedOrderStock(order, req.user, session);
        order.stockStatus = "Deducted";
        order.stockDeductedAt = new Date();
      }

      if (status === "Cancelled" && currentStockStatus === "Deducted") {
        await restoreOrderStock(order, req.user, session);
        order.stockStatus = "Restored";
        order.stockRestoredAt = new Date();
      } else if (status === "Cancelled" && currentStockStatus === "Reserved") {
        await releaseOrderReservation(order, req.user, session);
        order.stockStatus = "Restored";
        order.stockRestoredAt = new Date();
      }

      if (status === "Dispatched" && !order.dispatchedDate) {
        order.dispatchedDate = new Date();
      }

      if (status === "Delivered" && !order.deliveredDate) {
        order.deliveredDate = new Date();
      }

      if (status === "Cancelled" && !order.cancelledDate) {
        order.cancelledDate = new Date();
      }

      order.status = status;
      order.updatedBy = req.user?._id || null;

      await order.save({ session });
    });

    const populated = await Order.findOne({
      _id: req.params.id,
      isActive: true,
    })
      .populate("contact", CONTACT_FIELDS)
      .populate("enquiry", "enquiryNumber customerName company subject");

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: populated,
    });
  } catch (error) {
    if (error.code === "RESERVED_CONFLICT") {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
        data: error.data,
      });
    }

    if (error.code === "STOCK_CHANGED" || error.code === "RESERVATION_INCONSISTENT") {
      return res.status(409).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({
        success: false,
        ...(error.code ? { code: error.code } : {}),
        message: error.message,
      });
    }

    return handleError(
      res,
      error,
      "Server error while updating order status"
    );
  } finally {
    await session.endSession();
  }
};


const updatePayment = async (req, res) => {
  return res.status(400).json({
    success: false,
    code: "PAYMENT_RECORD_REQUIRED",
    message:
      "Manage payments through the Payments module. Order payment totals are calculated from payment records.",
  });
};

/* ======================================================
   DELETE ORDER
====================================================== */
const deleteOrder = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(req.params.id);
    if (!order || !order.isActive) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!["Draft", "Cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Only Draft or Cancelled orders can be deleted",
      });
    }

    if (["Reserved", "Deducted"].includes(order.stockStatus)) {
      return res.status(400).json({
        success: false,
        message: "This order still holds or reserves stock. Cancel it first so inventory is safely released, then delete.",
      });
    }

    order.isActive = false;
    order.updatedBy = req.user?._id || null;
    await order.save();

    return res.status(200).json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    handleError(res, error, "Server error");
  }
};

const generateInvoice = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(req.params.id).populate("contact", CONTACT_FIELDS);

    if (!order || !order.isActive) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (["Draft", "Cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot generate an invoice for a ${order.status} order.`,
      });
    }

    const existingInvoice = await Invoice.findOne({ order: order._id }).populate("order");
    if (existingInvoice) {
      return res.status(200).json({
        success: true,
        message: "Invoice already exists for this order",
        alreadyExists: true,
        data: existingInvoice,
      });
    }

    if (!order.items || order.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cannot generate invoice for an order without items" });
    }
    if (!order.contact) {
      return res.status(400).json({ success: false, message: "Cannot generate invoice because customer information is missing" });
    }

    const contact = order.contact;

    const settings = await getGlobalSettings();
    if (!settings?.seller?.name || !settings?.seller?.gstin) {
      return res.status(400).json({
        success: false,
        message:
          "Seller details are not configured. Please fill in Business Profile in Settings before generating an invoice.",
      });
    }

    const sellerCfg = settings.seller || {};
    const bankCfg = settings.bank || {};
    const invCfg = settings.invoice || {};

    const sellerAddressLine = [
      sellerCfg.address,
      sellerCfg.addressLine2,
      sellerCfg.city,
      sellerCfg.state,
      sellerCfg.pincode,
    ]
      .filter(Boolean)
      .join(", ");

    const sellerSnapshot = {
      name: sellerCfg.name,
      address: sellerAddressLine,
      gstin: sellerCfg.gstin,
      state: sellerCfg.state,
      stateCode: sellerCfg.stateCode,
      pan: sellerCfg.pan || "",
      phone: sellerCfg.phone || "",
      email: sellerCfg.email || "",
      cin: sellerCfg.cin || "",
      msme: sellerCfg.msme || "",
      logoUrl: sellerCfg.logoUrl || "",
      signatureUrl: sellerCfg.signatureUrl || "",
    };

    const bankSnapshot = {
      accountName: bankCfg.accountName || "",
      accountNumber: bankCfg.accountNumber || "",
      bankName: bankCfg.bankName || "",
      ifsc: bankCfg.ifsc || "",
      branch: bankCfg.branch || "",
      upiId: bankCfg.upiId || "",
    };

    const defaultHsn = invCfg.defaultHsn || "7217";

    const buyer = {
      name: contact.name || "",
      company: contact.company || "",
      address: order.billingAddress || contact.billingAddress || contact.address || "",
      gstin: contact.gstin || "",
      state: contact.state || "",
      stateCode: contact.stateCode || "",
      phone: contact.phone || "",
      email: contact.email || "",
    };

    const consignee = {
      name: contact.shippingName || contact.name || "",
      company: contact.shippingCompany || contact.company || "",
      address: order.shippingAddress || contact.shippingAddress || contact.address || "",
      gstin: contact.shippingGstin || contact.gstin || "",
      state: contact.shippingState || contact.state || "",
      stateCode: contact.shippingStateCode || contact.stateCode || "",
    };

    const subTotal = Number(order.subTotal || 0);
    const discount = Number(order.discount || 0);
    const taxableAmount = Math.max(0, subTotal - discount);
    const taxPercent = Number(order.taxPercent || invCfg.defaultGstRate || 0);

    const sellerCode = String(sellerCfg.stateCode || "").trim();
    const supplyCode = String(consignee.stateCode || buyer.stateCode || "").trim();
    const intraState = Boolean(sellerCode && supplyCode && sellerCode === supplyCode);
    const taxType = intraState ? "CGST_SGST" : "IGST";

    const igstPercent = intraState ? 0 : taxPercent;
    const igstAmount = intraState ? 0 : round2((taxableAmount * taxPercent) / 100);

    const cgstPercent = intraState ? taxPercent / 2 : 0;
    const cgstAmount = intraState ? round2((taxableAmount * cgstPercent) / 100) : 0;
    const sgstPercent = cgstPercent;
    const sgstAmount = cgstAmount;

    const totalTax = round2(igstAmount + cgstAmount + sgstAmount);

    const rawGrandTotal = round2(taxableAmount + totalTax);
    const roundOff = invCfg.roundOffEnabled
      ? round2(Math.round(rawGrandTotal) - rawGrandTotal)
      : 0;
    const grandTotal = round2(rawGrandTotal + roundOff);

    const invoiceItems = order.items.map((item) => ({
      product: item.productStock || item.product,
      description: item.productName || `Reel ${item.size}`,
      hsnSac: item.hsnSac || defaultHsn,   
      quantity: Number(item.quantity || 0),
      rate: Number(item.rate || 0),
      unit: item.unit || "Reel",
      amount: Number(item.amount || 0),
    }));

    let invoice = null;
    for (let attempt = 0; attempt < 3 && !invoice; attempt++) {
      const invoiceNumber = await generateInvoiceNumber();
      try {
        invoice = await Invoice.create({
          invoiceNumber,
          order: order._id,
          invoiceDate: new Date(),
          dueDate: invCfg.defaultDueDays
            ? new Date(Date.now() + invCfg.defaultDueDays * 86400000)
            : null,

          seller: sellerSnapshot,    
          bank: bankSnapshot,       
          buyer,
          consignee,

          items: invoiceItems,

          subTotal,
          discount,
          taxableAmount,

          taxType,
          taxPercent,
          igstPercent,
          igstAmount,
          cgstPercent,
          cgstAmount,
          sgstPercent,
          sgstAmount,
          totalTax,

          roundOff,                 
          grandTotal,
          amountInWords: amountInWords(grandTotal),
          taxAmountInWords: amountInWords(totalTax),

          termsAndConditions: invCfg.termsAndConditions || "",
          declaration: invCfg.declaration || "",
          footerNote: invCfg.footerNote || "",

          reference: order.orderNumber,
        });
      } catch (err) {
        if (err.code === 11000 && attempt < 2) continue;
        throw err;
      }
    }

    const populatedInvoice = await Invoice.findById(invoice._id).populate("order");

    return res.status(201).json({
      success: true,
      message: "Invoice generated successfully",
      alreadyExists: false,
      data: populatedInvoice,
    });
  } catch (error) {
    console.error("Generate invoice error:", error);

    if (error.code === 11000) {
      const existingInvoice = await Invoice.findOne({ order: req.params.id }).populate("order");
      if (existingInvoice) {
        return res.status(200).json({
          success: true,
          message: "Invoice already exists for this order",
          alreadyExists: true,
          data: existingInvoice,
        });
      }
      return res.status(409).json({
        success: false,
        message: "Invoice number collision. Resync the counter and try again.",
      });
    }

    handleError(res, error, "Failed to generate invoice");
  }
}

const getInvoice = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const invoice = await Invoice.findOne({ order: req.params.id }).populate("order");
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found for this order" });
    }
    return res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    handleError(res, error, "Failed to fetch invoice");
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  updatePayment,
  deleteOrder,
  generateInvoice,
  getInvoice,
};