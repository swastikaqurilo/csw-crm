const express = require("express");

const {
  createExpense,
  getExpenses,
  getExpense,
  updateExpense,
  markExpenseAsPaid,
  deleteExpense,
} = require("../controllers/expenseController");

const router = express.Router();

// GET
router.get("/", getExpenses);
router.get("/:id", getExpense);

// Mutations
router.post("/", createExpense);
router.put("/:id", updateExpense);
router.patch("/:id/pay", markExpenseAsPaid);
router.delete("/:id", deleteExpense);

module.exports = router;