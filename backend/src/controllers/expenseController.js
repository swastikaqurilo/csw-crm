const mongoose = require("mongoose");
const Expense = require("../models/Expense");
const Person = require("../models/Person");

/* ---------- helpers ---------- */
const ALLOWED_TYPES = [
  "Employee",
  "Factory People",
  "Factory Expense",
  "Miscellaneous",
];

const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 1000) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : "";
};

/* ================= CREATE ================= */
const createExpense = async (req, res) => {
  try {
    const {
      type,
      date,
      amount,
      paymentStatus,
      paymentMethod,
      transactionId,
      person,
      expenseType,
      vendor,
      invoiceNumber,
      expenseName,
      expenseCategory,
      description,
      notes,
    } = req.body;

    // 1. Type check (whitelist)
    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense type",
      });
    }

    // 2. Person ObjectId check
    if (person && !isValidId(person)) {
      return res.status(400).json({
        success: false,
        message: "Invalid person ID",
      });
    }

    // 3. Conditional required fields
    if (
      (type === "Employee" || type === "Factory People") &&
      !person
    ) {
      return res.status(400).json({
        success: false,
        message: "Person is required for employee or factory people expenses",
      });
    }

    if (type === "Factory Expense" && !expenseType?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Expense type is required for factory expenses",
      });
    }

    if (type === "Miscellaneous" && !expenseName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Expense name is required for miscellaneous expenses",
      });
    }

    // 4. Validate person
    let selectedPerson = null;
    if (person) {
      selectedPerson = await Person.findById(person);
      if (!selectedPerson) {
        return res.status(404).json({
          success: false,
          message: "Person not found",
        });
      }

      if (type === "Employee" && selectedPerson.type !== "Employee") {
        return res.status(400).json({
          success: false,
          message: "Selected person is not an employee",
        });
      }

      if (
        type === "Factory People" &&
        selectedPerson.type !== "Factory People"
      ) {
        return res.status(400).json({
          success: false,
          message: "Selected person is not factory people",
        });
      }
    }

    // 5. Amount logic
    let finalAmount = Number(amount);

    if (type === "Factory People") {
      finalAmount = Number(selectedPerson.dailyWage);
      if (!finalAmount && finalAmount !== 0) {
        return res.status(400).json({
          success: false,
          message: "Daily wage is not set for this person",
        });
      }
    } else if (type === "Factory Expense" || type === "Miscellaneous") {
      if (typeof finalAmount !== "number" || !Number.isFinite(finalAmount)) {
        return res.status(400).json({
          success: false,
          message: "Valid amount is required",
        });
      }
      if (finalAmount < 0) {
        return res.status(400).json({
          success: false,
          message: "Amount cannot be negative",
        });
      }
    }

    // 6. Payment method + UPI rule
    const status = paymentStatus === "Paid" ? "Paid" : "Pending";
    const method = status === "Paid" ? paymentMethod : null;

    if (status === "Paid" && !["Cash", "UPI"].includes(method)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    if (status === "Paid" && method === "UPI" && !transactionId?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required for UPI payments",
      });
    }

    // 7. Explicit whitelist — nothing from req.body goes in raw
    const payload = {
      type,
      date: date ? new Date(date) : new Date(),
      amount: finalAmount,
      paymentStatus: status,
      paymentMethod: method,
      paidAt: status === "Paid" ? new Date() : null,
      transactionId:
        status === "Paid" && method === "UPI"
          ? safeString(transactionId, 100)
          : null,
      person:
        type === "Employee" || type === "Factory People"
          ? person
          : null,
      expenseType:
        type === "Factory Expense" ? safeString(expenseType, 100) : null,
      vendor: type === "Factory Expense" ? safeString(vendor, 150) : null,
      invoiceNumber:
        type === "Factory Expense" ? safeString(invoiceNumber, 50) : null,
      expenseName:
        type === "Miscellaneous" ? safeString(expenseName, 150) : null,
      expenseCategory:
        type === "Miscellaneous" ? safeString(expenseCategory, 100) : null,
      description: safeString(description, 1000),
      notes: safeString(notes, 1000),
    };

    const expense = await Expense.create(payload);

    const populatedExpense = await Expense.findById(
      expense._id
    ).populate("person", "name phone type role dailyWage salary");

    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: populatedExpense,
    });
  } catch (error) {
    console.error("[createExpense]", error);
    res.status(500).json({
      success: false,
      message: "Failed to create expense",
    });
  }
};

/* ================= LIST ================= */
const getExpenses = async (req, res) => {
  try {
    const { type, paymentStatus, person, fromDate, toDate } = req.query;

    const filter = {};

    if (type) {
      if (!ALLOWED_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid type filter",
        });
      }
      filter.type = type;
    }

    if (paymentStatus) {
      if (!["Pending", "Paid"].includes(paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid paymentStatus filter",
        });
      }
      filter.paymentStatus = paymentStatus;
    }

    if (person) {
      if (!isValidId(person)) {
        return res.status(400).json({
          success: false,
          message: "Invalid person ID",
        });
      }
      filter.person = person;
    }

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) {
        const d = new Date(fromDate);
        if (isNaN(d.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid fromDate",
          });
        }
        filter.date.$gte = d;
      }
      if (toDate) {
        const d = new Date(toDate);
        if (isNaN(d.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid toDate",
          });
        }
        d.setHours(23, 59, 59, 999);
        filter.date.$lte = d;
      }
    }

    const expenses = await Expense.find(filter)
      .populate("person", "name phone type role dailyWage salary")
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses,
    });
  } catch (error) {
    console.error("[getExpenses]", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch expenses",
    });
  }
};

/* ================= GET ONE ================= */
const getExpense = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense = await Expense.findById(req.params.id).populate(
      "person",
      "name phone type role dailyWage salary"
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.status(200).json({ success: true, data: expense });
  } catch (error) {
    console.error("[getExpense]", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch expense",
    });
  }
};

/* ================= UPDATE ================= */
const updateExpense = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    // Guard: don't revert a Paid expense
    if (
      expense.paymentStatus === "Paid" &&
      req.body.paymentStatus === "Pending"
    ) {
      return res.status(400).json({
        success: false,
        message: "A paid expense cannot be changed back to pending",
      });
    }

    // Whitelist editable fields only
    const editable = [
      "date",
      "amount",
      "expenseType",
      "vendor",
      "invoiceNumber",
      "expenseName",
      "expenseCategory",
      "description",
      "notes",
    ];

    for (const key of editable) {
      if (req.body[key] !== undefined) {
        if (key === "amount") {
          const n = Number(req.body.amount);
          if (!Number.isFinite(n) || n < 0) {
            return res.status(400).json({
              success: false,
              message: "Invalid amount",
            });
          }
          expense.amount = n;
        } else if (key === "date") {
          const d = new Date(req.body.date);
          if (isNaN(d.getTime())) {
            return res.status(400).json({
              success: false,
              message: "Invalid date",
            });
          }
          expense.date = d;
        } else {
          expense[key] = safeString(req.body[key], 1000);
        }
      }
    }

    await expense.save(); // 👈 runs schema validators

    const updatedExpense = await Expense.findById(expense._id).populate(
      "person",
      "name phone type role dailyWage salary"
    );

    res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: updatedExpense,
    });
  } catch (error) {
    console.error("[updateExpense]", error);
    res.status(500).json({
      success: false,
      message: "Failed to update expense",
    });
  }
};

/* ================= MARK PAID ================= */
const markExpenseAsPaid = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const { paymentMethod, transactionId, paidAt } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }
    if (!["Cash", "UPI"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }
    if (paymentMethod === "UPI" && !transactionId?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required for UPI payments",
      });
    }

    const expense = await Expense.findById(req.params.id);
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

    expense.paymentStatus = "Paid";
    expense.paymentMethod = paymentMethod;
    expense.transactionId =
      paymentMethod === "UPI" ? safeString(transactionId, 100) : null;
    expense.paidAt = paidAt ? new Date(paidAt) : new Date();

    await expense.save();

    const updatedExpense = await Expense.findById(expense._id).populate(
      "person",
      "name phone type role dailyWage salary"
    );

    res.status(200).json({
      success: true,
      message: "Expense marked as paid",
      data: updatedExpense,
    });
  } catch (error) {
    console.error("[markExpenseAsPaid]", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark expense as paid",
    });
  }
};

/* ================= DELETE ================= */
const deleteExpense = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      });
    }

    const expense = await Expense.findById(req.params.id);
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

    await expense.deleteOne();

    res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("[deleteExpense]", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete expense",
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