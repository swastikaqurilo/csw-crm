const express = require("express");

const {
  createExpense,
  getExpenses,
  getExpense,
  updateExpense,
  markExpenseAsPaid,
  deleteExpense,
} = require("../controllers/expenseController");

const { restrictTo } = require("../middleware/auth");

const router = express.Router();

// GET — any authenticated user
router.get("/", getExpenses);
router.get("/:id", getExpense);

// Mutations — Admin / Sales Manager only
router.post("/", restrictTo("Admin", "Sales Manager"), createExpense);
router.put("/:id", restrictTo("Admin", "Sales Manager"), updateExpense);
router.patch("/:id/pay", restrictTo("Admin", "Sales Manager"), markExpenseAsPaid);
router.delete("/:id", restrictTo("Admin", "Sales Manager"), deleteExpense);

module.exports = router;