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

const router = express.Router();

router.get("/summary", getPaymentSummary);
router.get("/order/:orderId", getPaymentsByOrder);
router.get("/", getAllPayments);
router.post("/", createPayment);
router.get("/:id", getPaymentById);
router.patch("/:id", updatePayment);
router.delete("/:id", deletePayment);

module.exports = router;
