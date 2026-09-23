const Expense = require("../models/Expense");
const Person = require("../models/Person");

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

    // Employee / Factory People must have a person
    if (
      (type === "Employee" || type === "Factory People") &&
      !person
    ) {
      return res.status(400).json({
        success: false,
        message: "Person is required for employee or factory people expenses",
      });
    }

    // Factory Expense fields
    if (type === "Factory Expense" && !expenseType) {
      return res.status(400).json({
        success: false,
        message: "Expense type is required for factory expenses",
      });
    }

    // Miscellaneous fields
    if (type === "Miscellaneous" && !expenseName) {
      return res.status(400).json({
        success: false,
        message: "Expense name is required for miscellaneous expenses",
      });
    }

    // Validate person
    let selectedPerson = null;

    if (person) {
      selectedPerson = await Person.findById(person);

      if (!selectedPerson) {
        return res.status(404).json({
          success: false,
          message: "Person not found",
        });
      }

      // Make sure the selected person's type matches the expense type
      if (
        type === "Employee" &&
        selectedPerson.type !== "Employee"
      ) {
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

    // For Factory People, use their daily wage
    let finalAmount = amount;

    if (type === "Factory People") {
      finalAmount = selectedPerson.dailyWage;

      if (
        finalAmount === null ||
        finalAmount === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "Daily wage is not set for this person",
        });
      }
    }

    // UPI requires transaction ID
    if (
      paymentStatus === "Paid" &&
      paymentMethod === "UPI" &&
      !transactionId
    ) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required for UPI payments",
      });
    }

    const expense = await Expense.create({
      type,
      date,
      amount: finalAmount,
      paymentStatus: paymentStatus || "Pending",
      paymentMethod:
        paymentStatus === "Paid" ? paymentMethod : null,
      paidAt:
        paymentStatus === "Paid"
          ? new Date()
          : null,
      transactionId:
        paymentStatus === "Paid"
          ? transactionId
          : null,
      person:
        type === "Employee" || type === "Factory People"
          ? person
          : null,
      expenseType:
        type === "Factory Expense"
          ? expenseType
          : null,
      vendor:
        type === "Factory Expense"
          ? vendor
          : null,
      invoiceNumber:
        type === "Factory Expense"
          ? invoiceNumber
          : null,
      expenseName:
        type === "Miscellaneous"
          ? expenseName
          : null,
      expenseCategory:
        type === "Miscellaneous"
          ? expenseCategory
          : null,
      description,
      notes,
    });

    const populatedExpense = await Expense.findById(
      expense._id
    ).populate("person", "name phone type role dailyWage salary");

    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: populatedExpense,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create expense",
      error: error.message,
    });
  }
};

const getExpenses = async (req, res) => {
  try {
    const {
      type,
      paymentStatus,
      person,
      fromDate,
      toDate,
    } = req.query;

    const filter = {};

    if (type) {
      filter.type = type;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (person) {
      filter.person = person;
    }

    if (fromDate || toDate) {
      filter.date = {};

      if (fromDate) {
        filter.date.$gte = new Date(fromDate);
      }

      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);

        filter.date.$lte = endDate;
      }
    }

    const expenses = await Expense.find(filter)
      .populate(
        "person",
        "name phone type role dailyWage salary"
      )
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch expenses",
      error: error.message,
    });
  }
};

const getExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(
      req.params.id
    ).populate(
      "person",
      "name phone type role dailyWage salary"
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch expense",
      error: error.message,
    });
  }
};

const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(
      req.params.id
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    // Don't allow changing a paid expense casually
    if (
      expense.paymentStatus === "Paid" &&
      req.body.paymentStatus === "Pending"
    ) {
      return res.status(400).json({
        success: false,
        message: "A paid expense cannot be changed back to pending",
      });
    }

    Object.assign(expense, req.body);

    await expense.save();

    const updatedExpense = await Expense.findById(
      expense._id
    ).populate(
      "person",
      "name phone type role dailyWage salary"
    );

    res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: updatedExpense,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update expense",
      error: error.message,
    });
  }
};

const markExpenseAsPaid = async (req, res) => {
  try {
    const { paymentMethod, transactionId, paidAt } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    if (
      !["Cash", "UPI"].includes(paymentMethod)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    if (
      paymentMethod === "UPI" &&
      !transactionId
    ) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required for UPI payments",
      });
    }

    const expense = await Expense.findById(
      req.params.id
    );

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
      paymentMethod === "UPI"
        ? transactionId
        : null;
    expense.paidAt = paidAt
      ? new Date(paidAt)
      : new Date();

    await expense.save();

    const updatedExpense = await Expense.findById(
      expense._id
    ).populate(
      "person",
      "name phone type role dailyWage salary"
    );

    res.status(200).json({
      success: true,
      message: "Expense marked as paid",
      data: updatedExpense,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to mark expense as paid",
      error: error.message,
    });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(
      req.params.id
    );

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

    await Expense.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
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