const express = require("express");

const {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentsByOrder,
  getPaymentSummary,
} = require("../controllers/paymentController");
const idempotency = require("../middleware/idempotency");

const router = express.Router();

router.get("/summary", getPaymentSummary);
router.get("/order/:orderId", getPaymentsByOrder);
router.get("/", getAllPayments);
router.get("/:id", getPaymentById);

router.post("/", idempotency(), createPayment);
router.patch("/:id", idempotency(), updatePayment);
router.delete("/:id", idempotency(), deletePayment);

module.exports = router;