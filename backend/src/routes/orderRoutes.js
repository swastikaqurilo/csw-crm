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

router.post("/", idempotency(), createOrder);
router.put("/:id", idempotency(), updateOrder);
router.patch("/:id/status", idempotency(), updateOrderStatus);
router.delete("/:id", idempotency(), deleteOrder);
router.post("/:id/invoice", idempotency(), generateInvoice);

router.get("/:id/invoice", getInvoice);

router.get("/:id", getOrderById);

module.exports = router;