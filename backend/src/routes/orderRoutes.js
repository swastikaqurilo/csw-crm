const express = require("express");

const {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  generateInvoice,
  getInvoice,
} = require("../controllers/orderController");

const router = express.Router();

router.get("/", getAllOrders);

router.post("/", createOrder);

router.put("/:id", updateOrder);

router.patch("/:id/status", updateOrderStatus);

router.delete("/:id", deleteOrder);

/*
 * Invoice routes
 */
router.post("/:id/invoice", generateInvoice);
router.get("/:id/invoice", getInvoice);

router.get("/:id", getOrderById);

module.exports = router;