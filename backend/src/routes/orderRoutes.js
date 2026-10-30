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
const idempotency = require("../middleware/idempotency");

const router = express.Router();

router.get("/", getAllOrders);

router.post("/", idempotency({ required: true }), createOrder);
router.put("/:id", idempotency({ required: true }), updateOrder);
router.patch("/:id/status", idempotency({ required: true }), updateOrderStatus);
router.delete("/:id", idempotency({ required: true }), deleteOrder);
router.post("/:id/invoice", idempotency({ required: true }), generateInvoice);

router.get("/:id/invoice", getInvoice);

router.get("/:id", getOrderById);

module.exports = router;