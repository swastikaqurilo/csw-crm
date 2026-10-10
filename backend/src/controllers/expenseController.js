const mongoose = require("mongoose");
const Expense = require("../models/Expense");

const ALLOWED_TYPES = [
  "Factory Expense",
  "Miscellaneous",
];

const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Bank Transfer",
  "Cheque",
  "NEFT",
  "RTGS",
];

const isValidId = (value) => mongoose.isValidObjectId(value);

const safeString = (value, max = 1000) => {
  if (value === undefined || value === null) return "";

  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, max);
};

const parseDate = (value) => {
  if (!value) return new Date();

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};


/* =========================================================
   CREATE EXPENSE
========================================================= */

const createExpense = async (req, res) => {
  try {
    const {
      type,
      date,
      amount,
      paymentStatus,
      paymentMethod,
      transactionId,
      expenseType,
      vendor,
      invoiceNumber,
      expenseName,
      expenseCategory,
      description,
      notes,
    } = req.body;

    // Validate expense type
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense type",
      });
    }

    // Validate date
    const expenseDate = parseDate(date);

    if (!expenseDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense date",
      });
    }

    // Validate amount
    const finalAmount = Number(amount);

    if (!Number.isFinite(finalAmount)) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    if (finalAmount < 0 || finalAmount > 100000000) {
      return res.status(400).json({
        success: false,
        message: "Amount must be between 0 and 100000000",
      });
    }

    // Factory Expense validation
    if (type === "Factory Expense") {
      if (!safeString(expenseType, 100)) {
        return res.status(400).json({
          success: false,
          message: "Expense type is required for factory expenses",
        });
      }
    }

    // Miscellaneous validation
    if (type === "Miscellaneous") {
      if (!safeString(expenseName, 150)) {
        return res.status(400).json({
          success: false,
          message: "Expense name is required for miscellaneous expenses",
        });
      }
    }

    // Payment status
    const status =
      paymentStatus === "Paid"
        ? "Paid"
        : "Pending";

    let method = null;
    let cleanTransactionId = null;
    let paidAt = null;

    if (status === "Paid") {
      if (!PAYMENT_METHODS.includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: "Valid payment method is required",
        });
      }

      method = paymentMethod;

      if (
        ["UPI", "Bank Transfer", "NEFT", "RTGS", "Cheque"].includes(
          paymentMethod
        )
      ) {
        if (!safeString(transactionId, 100)) {
          return res.status(400).json({
            success: false,
            message: `Transaction/reference ID is required for ${paymentMethod}`,
          });
        }

        cleanTransactionId = safeString(transactionId, 100);
      }

      paidAt = new Date();
    }

    const payload = {
      type,
      date: expenseDate,
      amount: finalAmount,

      paymentStatus: status,
      paymentMethod: method,
      paidAt,
      transactionId: cleanTransactionId,

      expenseType:
        type === "Factory Expense"
          ? safeString(expenseType, 100)
          : null,

      vendor:
        type === "Factory Expense"
          ? safeString(vendor, 150)
          : null,

      invoiceNumber:
        type === "Factory Expense"
          ? safeString(invoiceNumber, 50)
          : null,

      expenseName:
        type === "Miscellaneous"
          ? safeString(expenseName, 150)
          : null,

      expenseCategory:
        type === "Miscellaneous"
          ? safeString(expenseCategory, 100)
          : null,

      description: safeString(description, 1000),

      notes: safeString(notes, 1000),
    };

    const expense = await Expense.create(payload);

    return res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: expense,
    });
  } catch (error) {
    console.error("[createExpense]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create expense",
      error: error.message,
    });
  }
};

/* =========================================================
   GET ALL EXPENSES
========================================================= */

const getExpenses = async (req, res) => {
  try {
    const {
      type,
      paymentStatus,
      fromDate,
      toDate,
      search,
    } = req.query;

    const filter = {
      isDeleted: false,
    };

    // Type filter
    if (type) {
      if (!ALLOWED_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid type filter",
        });
      }

      filter.type = type;
    }

    // Payment status filter
    if (paymentStatus) {
      if (!["Pending", "Paid"].includes(paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid paymentStatus filter",
        });
      }

      filter.paymentStatus = paymentStatus;
    }

    // Date filter
    if (fromDate || toDate) {
      filter.date = {};

      if (fromDate) {
        const start = new Date(fromDate);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid fromDate",
          });
        }

        filter.date.$gte = start;
      }

      if (toDate) {
        const end = new Date(toDate);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid toDate",
          });
        }

        end.setHours(23, 59, 59, 999);

        filter.date.$lte = end;
      }
    }

    // Search
    if (search?.trim()) {
      const searchRegex = new RegExp(
        search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      filter.$or = [
        { expenseType: searchRegex },
        { vendor: searchRegex },
        { invoiceNumber: searchRegex },
        { expenseName: searchRegex },
        { expenseCategory: searchRegex },
        { description: searchRegex },
      ];
    }

    const expenses = await Expense.find(filter).sort({
      date: -1,
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses,
    });
  } catch (error) {
    console.error("[getExpenses]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch expenses",
      error: error.message,
    });
  }
};

/* =========================================================
   GET SINGLE EXPENSE
========================================================= */

const getExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense = await Expense.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    console.error("[getExpense]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch expense",
      error: error.message,
    });
  }
};

/* =========================================================
   UPDATE EXPENSE
========================================================= */

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense = await Expense.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    // Don't allow Paid → Pending
    if (
      expense.paymentStatus === "Paid" &&
      req.body.paymentStatus === "Pending"
    ) {
      return res.status(400).json({
        success: false,
        message: "A paid expense cannot be changed back to pending",
      });
    }

    const {
      type,
      date,
      amount,
      expenseType,
      vendor,
      invoiceNumber,
      expenseName,
      expenseCategory,
      description,
      notes,
    } = req.body;

    // Type
    if (type !== undefined) {
      if (!ALLOWED_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid expense type",
        });
      }

      expense.type = type;
    }

    // Date
    if (date !== undefined) {
      const parsedDate = parseDate(date);

      if (!parsedDate) {
        return res.status(400).json({
          success: false,
          message: "Invalid date",
        });
      }

      expense.date = parsedDate;
    }

    // Amount
    if (amount !== undefined) {
      const parsedAmount = Number(amount);

      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid amount",
        });
      }

      expense.amount = parsedAmount;
    }

    if (expenseType !== undefined) {
      expense.expenseType = safeString(expenseType, 100);
    }

    if (vendor !== undefined) {
      expense.vendor = safeString(vendor, 150);
    }

    if (invoiceNumber !== undefined) {
      expense.invoiceNumber = safeString(invoiceNumber, 50);
    }

    if (expenseName !== undefined) {
      expense.expenseName = safeString(expenseName, 150);
    }

    if (expenseCategory !== undefined) {
      expense.expenseCategory = safeString(expenseCategory, 100);
    }

    if (description !== undefined) {
      expense.description = safeString(description, 1000);
    }

    if (notes !== undefined) {
      expense.notes = safeString(notes, 1000);
    }

    // Validate type-specific fields after update
    if (
      expense.type === "Factory Expense" &&
      !safeString(expense.expenseType, 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Expense type is required for factory expenses",
      });
    }

    if (
      expense.type === "Miscellaneous" &&
      !safeString(expense.expenseName, 150)
    ) {
      return res.status(400).json({
        success: false,
        message: "Expense name is required for miscellaneous expenses",
      });
    }

    // Clear fields that don't belong to the selected type
    if (expense.type === "Factory Expense") {
      expense.expenseName = null;
      expense.expenseCategory = null;
    }

    if (expense.type === "Miscellaneous") {
      expense.expenseType = null;
      expense.vendor = null;
      expense.invoiceNumber = null;
    }

    await expense.save();

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (error) {
    console.error("[updateExpense]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update expense",
      error: error.message,
    });
  }
};

/* =========================================================
   MARK EXPENSE AS PAID
========================================================= */

const markExpenseAsPaid = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const {
      paymentMethod,
      transactionId,
      paidAt,
    } = req.body;

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    const requiresReference = [
      "UPI",
      "Bank Transfer",
      "NEFT",
      "RTGS",
      "Cheque",
    ].includes(paymentMethod);

    if (
      requiresReference &&
      !safeString(transactionId, 100)
    ) {
      return res.status(400).json({
        success: false,
        message: `Transaction/reference ID is required for ${paymentMethod}`,
      });
    }

    const expense = await Expense.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (expense.paymentStatus === "Paid") {
      return res.status(400).json({
        success: false,
        message: "Expense is already marked as paid",
      });
    }

    const parsedPaidAt = paidAt
      ? new Date(paidAt)
      : new Date();

    if (Number.isNaN(parsedPaidAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment date",
      });
    }

    expense.paymentStatus = "Paid";
    expense.paymentMethod = paymentMethod;
    expense.transactionId = requiresReference
      ? safeString(transactionId, 100)
      : null;
    expense.paidAt = parsedPaidAt;

    await expense.save();

    return res.status(200).json({
      success: true,
      message: "Expense marked as paid",
      data: expense,
    });
  } catch (error) {
    console.error("[markExpenseAsPaid]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark expense as paid",
      error: error.message,
    });
  }
};


const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense = await Expense.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    if (expense.paymentStatus === "Paid") {
      return res.status(400).json({
        success: false,
        message: "Paid expenses cannot be deleted",
      });
    }

    expense.isDeleted = true;
    expense.deletedAt = new Date();

    await expense.save();

    return res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("[deleteExpense]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete expense",
      error: error.message,
    });
  }
};

module.exports = {
  createExpense,
  getExpenses,
  getExpense,
  updateExpense,
  markExpenseAsPaid,
  deleteExpense,
};