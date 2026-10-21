const express = require("express");

const {
  createExpense,
  getExpenses,
  getExpense,
  updateExpense,
  markExpenseAsPaid,
  deleteExpense,
} = require("../controllers/expenseController");
const idempotency = require("../middleware/idempotency");
const router = express.Router();

// GET
router.get("/", getExpenses);
router.get("/:id", getExpense);

router.post("/", idempotency(), createExpense);
router.put("/:id", idempotency(), updateExpense);
router.patch("/:id/pay", idempotency(), markExpenseAsPaid);
router.delete("/:id", idempotency(), deleteExpense);

module.exports = router;