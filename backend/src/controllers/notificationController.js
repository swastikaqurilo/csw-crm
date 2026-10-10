const ProductStock = require("../models/ProductStock");
const Payment = require("../models/Payment");
const Order = require("../models/Order");
const { getGlobalSettings } = require("../utils/getSettings");

const MAX_ALERTS_PER_TYPE = 10;

const getNotifications = async (req, res) => {
  try {
    const settings = await getGlobalSettings();
    const threshold = Number(settings?.preferences?.lowStockThreshold ?? 10);

    const lowStockItems = await ProductStock.find({
      isActive: true,
      $expr: {
        $lte: [
          { $subtract: ["$quantity", { $ifNull: ["$reservedQty", 0] }] },
          threshold,
        ],
      },
    })
      .select("name size quantity reservedQty unit updatedAt")
      .sort({ quantity: 1 })
      .limit(MAX_ALERTS_PER_TYPE)
      .lean();

    const lowStockAlerts = lowStockItems.map((item) => {
      const free = Math.max(
        0,
        Number(item.quantity || 0) - Number(item.reservedQty || 0)
      );
      const out = free <= 0;
      return {
        id: `stock-${item._id}`,
        type: "stock",
        severity: out ? "critical" : "warning",
        title: out ? "Out of stock" : "Low stock",
        message: `${item.name || item.size} — ${free} ${item.unit || "units"} remaining`,
        href: "/products",
        meta: { size: item.size, quantity: item.quantity, free },
        createdAt: item.updatedAt || new Date(),
      };
    });

    const pendingPayments = await Payment.find({
      isActive: true,
      status: "Pending",
    })
      .select("paymentNumber amount currency paymentDate order")
      .populate("order", "orderNumber customerName")
      .sort({ paymentDate: -1 })
      .limit(MAX_ALERTS_PER_TYPE)
      .lean();

    const pendingAlerts = pendingPayments.map((p) => ({
      id: `payment-${p._id}`,
      type: "payment",
      severity: "warning",
      title: "Pending payment",
      message: `${p.paymentNumber} — ₹${Number(p.amount || 0).toLocaleString("en-IN")} for ${p.order?.orderNumber || "order"}`,
      href: "/payments",
      meta: { paymentNumber: p.paymentNumber, amount: p.amount },
      createdAt: p.paymentDate || new Date(),
    }));

    const pendingPaymentTotal = await Payment.aggregate([
      { $match: { isActive: true, status: "Pending" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const overdueOrders = await Order.find({
      isActive: true,
      paymentStatus: "Overdue",
    })
      .select("orderNumber customerName grandTotal amountPaid paymentStatus createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(MAX_ALERTS_PER_TYPE)
      .lean();

    const overdueAlerts = overdueOrders.map((o) => {
      const balance = Math.max(
        0,
        Number(o.grandTotal || 0) - Number(o.amountPaid || 0)
      );
      return {
        id: `overdue-${o._id}`,
        type: "overdue",
        severity: "critical",
        title: "Overdue order",
        message: `${o.orderNumber} — ₹${balance.toLocaleString("en-IN")} outstanding from ${o.customerName || "customer"}`,
        href: "/payments",
        meta: { orderNumber: o.orderNumber, balance },
        createdAt: o.updatedAt || new Date(),
      };
    });

    const allAlerts = [
      ...lowStockAlerts,
      ...overdueAlerts,
      ...pendingAlerts,
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const counts = {
      stock: lowStockAlerts.length,
      payment: pendingAlerts.length,
      overdue: overdueAlerts.length,
      total: allAlerts.length,
      critical: allAlerts.filter((a) => a.severity === "critical").length,
      warning: allAlerts.filter((a) => a.severity === "warning").length,
    };

    return res.status(200).json({
      success: true,
      data: {
        alerts: allAlerts,
        counts,
        summary: {
          pendingPaymentTotal: pendingPaymentTotal[0]?.total || 0,
          pendingPaymentCount: pendingPaymentTotal[0]?.count || 0,
          lowStockThreshold: threshold,
        },
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[getNotifications]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load notifications",
    });
  }
};

module.exports = { getNotifications };