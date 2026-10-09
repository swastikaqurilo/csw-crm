const mongoose = require("mongoose");
const Salary = require("../models/Salary");
const { Worker, Attendance } = require("../models/Worker");
const ProductProduction = require("../models/Product");

const isValidId = (value) => mongoose.isValidObjectId(value);

const safeString = (value, max = 1000) => {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, max);
};

const calculateNetSalary = (basicSalary, allowances = 0, deductions = 0) => {
  const basic = Number(basicSalary) || 0;
  const allowance = Number(allowances) || 0;
  const deduction = Number(deductions) || 0;

  return Math.max(0, basic + allowance - deduction);
};

const calculatePaymentStatus = (netSalary, paidAmount, advanceAmount = 0) => {
  const totalPaid = Number(paidAmount || 0) + Number(advanceAmount || 0);

  if (totalPaid <= 0) return "Pending";
  if (totalPaid >= netSalary) return "Paid";
  return "Partial";
};

const createSalary = async (req, res) => {
  try {
    const {
      worker,
      periodStart,
      periodEnd,
      basicSalary,
      allowances = 0,
      deductions = 0,
      notes = "",
    } = req.body;

    if (!isValidId(worker)) {
      return res.status(400).json({
        success: false,
        message: "Valid worker is required",
      });
    }

    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Salary period start and end dates are required",
      });
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary period dates",
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "Period start date cannot be after period end date",
      });
    }

    const selectedWorker = await Worker.findById(worker);

    if (!selectedWorker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    if (selectedWorker.payType !== "Fixed") {
      return res.status(400).json({
        success: false,
        message: "Salary records can only be created for Fixed-pay workers",
      });
    }

    const basic = Number(basicSalary);

    if (!Number.isFinite(basic) || basic < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid basic salary is required",
      });
    }

    const allowance = Number(allowances) || 0;
    const deduction = Number(deductions) || 0;

    if (allowance < 0 || deduction < 0) {
      return res.status(400).json({
        success: false,
        message: "Allowances and deductions cannot be negative",
      });
    }

    const netSalary = calculateNetSalary(basic, allowance, deduction);

    const existingSalary = await Salary.findOne({
      worker,
      periodStart: start,
      periodEnd: end,
      isDeleted: false,
    });

    if (existingSalary) {
      return res.status(409).json({
        success: false,
        message: "Salary record already exists for this worker and period",
      });
    }

    const salary = await Salary.create({
      worker,
      payType: selectedWorker.payType,
      periodStart: start,
      periodEnd: end,
      basicSalary: basic,
      allowances: allowance,
      deductions: deduction,
      netSalary,
      paidAmount: 0,
      paymentStatus: "Pending",
      notes: safeString(notes),
    });

    const populatedSalary = await Salary.findById(salary._id).populate(
      "worker",
      "workerId name phone role department payType fixedPay"
    );

    return res.status(201).json({
      success: true,
      message: "Salary record created successfully",
      data: populatedSalary,
    });
  } catch (error) {
    console.error("[createSalary]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create salary record",
      error: error.message,
    });
  }
};

const getSalaries = async (req, res) => {
  try {
    const {
      worker,
      paymentStatus,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
      search = "",
    } = req.query;

    const filter = { isDeleted: false };

    if (worker) {
      if (!isValidId(worker)) {
        return res.status(400).json({
          success: false,
          message: "Invalid worker ID",
        });
      }

      filter.worker = worker;
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    if (fromDate || toDate) {
      filter.periodStart = {};

      if (fromDate) {
        const start = new Date(fromDate);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid fromDate",
          });
        }

        filter.periodStart.$gte = start;
      }

      if (toDate) {
        const end = new Date(toDate);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid toDate",
          });
        }

        filter.periodStart.$lte = end;
      }
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    if (search && String(search).trim()) {
      const workerIds = await Worker.find({
        name: {
          $regex: safeString(search, 100),
          $options: "i",
        },
      }).select("_id");

      const ids = workerIds.map((item) => item._id);

      if (filter.worker) {
        const requested = filter.worker;
        const match = ids.some((id) => String(id) === String(requested));

        // If the requested worker isn't in the search result, no matches.
        if (!match) {
          return res.status(200).json({
            success: true,
            salaries: [],
            pagination: {
              page: pageNumber,
              limit: limitNumber,
              total: 0,
              totalPages: 0,
            },
          });
        }
      } else {
        filter.worker = { $in: ids };
      }
    }

    const [salaries, total] = await Promise.all([
      Salary.find(filter)
        .populate(
          "worker",
          "workerId name phone role department payType fixedPay"
        )
        .sort({ periodStart: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),

      Salary.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      salaries,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber) || 1,
      },
    });
  } catch (error) {
    console.error("[getSalaries]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch salaries",
      error: error.message,
    });
  }
};

const getSalary = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary ID",
      });
    }

    const salary = await Salary.findOne({
      _id: id,
      isDeleted: false,
    }).populate(
      "worker",
      "workerId name phone role department payType fixedPay"
    );

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    return res.status(200).json({
      success: true,
      salary,
    });
  } catch (error) {
    console.error("[getSalary]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch salary",
      error: error.message,
    });
  }
};

const updateSalary = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary ID",
      });
    }

    const salary = await Salary.findById(id);

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    const {
      periodStart,
      periodEnd,
      basicSalary,
      allowances,
      deductions,
      notes,
    } = req.body;

    const start = periodStart ? new Date(periodStart) : salary.periodStart;
    const end = periodEnd ? new Date(periodEnd) : salary.periodEnd;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary period dates",
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "Period start date cannot be after period end date",
      });
    }

    const basic =
      basicSalary !== undefined ? Number(basicSalary) : salary.basicSalary;
    const allowance =
      allowances !== undefined ? Number(allowances) : salary.allowances;
    const deduction =
      deductions !== undefined ? Number(deductions) : salary.deductions;

    if (!Number.isFinite(basic) || basic < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid basic salary",
      });
    }

    if (
      !Number.isFinite(allowance) ||
      allowance < 0 ||
      !Number.isFinite(deduction) ||
      deduction < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Allowances and deductions cannot be negative",
      });
    }

    const netSalary = calculateNetSalary(basic, allowance, deduction);

    if (netSalary < salary.paidAmount) {
      return res.status(400).json({
        success: false,
        message: "Net salary cannot be lower than the amount already paid",
      });
    }

    salary.periodStart = start;
    salary.periodEnd = end;
    salary.basicSalary = basic;
    salary.allowances = allowance;
    salary.deductions = deduction;
    salary.netSalary = netSalary;

    if (notes !== undefined) {
      salary.notes = safeString(notes);
    }

    salary.paymentStatus = calculatePaymentStatus(
      netSalary,
      salary.paidAmount,
      salary.advanceAmount
    );

    await salary.save();

    const populatedSalary = await Salary.findById(salary._id).populate(
      "worker",
      "workerId name phone role department payType fixedPay"
    );

    return res.status(200).json({
      success: true,
      message: "Salary updated successfully",
      salary: populatedSalary,
    });
  } catch (error) {
    console.error("[updateSalary]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update salary",
      error: error.message,
    });
  }
};

const recordSalaryPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      amount,
      paymentDate = new Date(),
      paymentMode,
      transactionId = "",
      notes = "",
    } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary ID",
      });
    }

    const salary = await Salary.findById(id);

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than zero",
      });
    }

    const remainingAmount =
      Number(salary.netSalary || 0) -
      Number(salary.paidAmount || 0) -
      Number(salary.advanceAmount || 0);

    if (paymentAmount > remainingAmount + 0.001) {
      return res.status(400).json({
        success: false,
        message: `Payment cannot exceed remaining salary of ₹${remainingAmount}`,
      });
    }

    const validModes = [
      "Cash",
      "UPI",
      "Bank Transfer",
      "Cheque",
      "NEFT",
      "RTGS",
      "Other",
    ];

    if (!validModes.includes(paymentMode)) {
      return res.status(400).json({
        success: false,
        message: "Valid payment mode is required",
      });
    }

    const cleanTransactionId = safeString(transactionId, 150);

    if (
      ["UPI", "Bank Transfer", "NEFT", "RTGS", "Cheque"].includes(
        paymentMode
      ) &&
      !cleanTransactionId
    ) {
      return res.status(400).json({
        success: false,
        message: `Transaction/reference ID is required for ${paymentMode}`,
      });
    }

    const parsedPaymentDate = new Date(paymentDate);

    if (Number.isNaN(parsedPaymentDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment date",
      });
    }

    salary.payments.push({
      amount: paymentAmount,
      paymentDate: parsedPaymentDate,
      paymentMode,
      transactionId: cleanTransactionId,
      notes: safeString(notes, 500),
    });

    salary.paidAmount += paymentAmount;

    salary.paymentStatus = calculatePaymentStatus(
      salary.netSalary,
      salary.paidAmount,
      salary.advanceAmount
    );

    salary.lastPaymentDate = parsedPaymentDate;

    await salary.save();

    const populatedSalary = await Salary.findById(salary._id).populate(
      "worker",
      "workerId name phone role department payType fixedPay"
    );

    return res.status(200).json({
      success: true,
      message: "Salary payment recorded successfully",
      salary: populatedSalary,
      payment: salary.payments[salary.payments.length - 1],
    });
  } catch (error) {
    console.error("[recordSalaryPayment]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to record salary payment",
      error: error.message,
    });
  }
};

const recordSalaryAdvance = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      amount,
      date = new Date(),
      paymentMode = "Cash",
      transactionId = "",
      notes = "",
    } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary ID",
      });
    }

    const salary = await Salary.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    const advanceAmount = Number(amount);

    if (!Number.isFinite(advanceAmount) || advanceAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Advance amount must be greater than zero",
      });
    }

    const remaining =
      Number(salary.netSalary || 0) -
      Number(salary.paidAmount || 0) -
      Number(salary.advanceAmount || 0);

    if (advanceAmount > remaining + 0.001) {
      return res.status(400).json({
        success: false,
        message: `Advance cannot exceed the remaining balance of ₹${remaining}`,
      });
    }

    const validModes = [
      "Cash",
      "UPI",
      "Bank Transfer",
      "Cheque",
      "NEFT",
      "RTGS",
      "Other",
    ];

    if (!validModes.includes(paymentMode)) {
      return res.status(400).json({
        success: false,
        message: "Valid payment mode is required",
      });
    }

    const cleanTransactionId = safeString(transactionId, 150);

    if (
      ["UPI", "Bank Transfer", "NEFT", "RTGS", "Cheque"].includes(paymentMode) &&
      !cleanTransactionId
    ) {
      return res.status(400).json({
        success: false,
        message: `Transaction/reference ID is required for ${paymentMode}`,
      });
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid advance date",
      });
    }

    salary.advances.push({
      amount: advanceAmount,
      date: parsedDate,
      paymentMode,
      transactionId: cleanTransactionId,
      notes: safeString(notes, 500),
      givenBy: req.user?._id || null,
    });

    salary.advanceAmount = Number(salary.advanceAmount || 0) + advanceAmount;

    salary.paymentStatus = calculatePaymentStatus(
      salary.netSalary,
      salary.paidAmount,
      salary.advanceAmount
    );

    await salary.save();

    const populated = await Salary.findById(salary._id).populate(
      "worker",
      "workerId name phone role department payType fixedPay variablePay"
    );

    return res.status(201).json({
      success: true,
      message: "Advance recorded successfully",
      salary: populated,
      advance: salary.advances[salary.advances.length - 1],
    });
  } catch (error) {
    console.error("[recordSalaryAdvance]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record advance",
      error: error.message,
    });
  }
};

const deleteSalaryAdvance = async (req, res) => {
  try {
    const { id, advanceId } = req.params;
    if (!isValidId(id) || !isValidId(advanceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID",
      });
    }

    const salary = await Salary.findOne({ _id: id, isDeleted: false });
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    const adv = salary.advances.id(advanceId);
    if (!adv) {
      return res.status(404).json({
        success: false,
        message: "Advance not found",
      });
    }

    if (Number(salary.paidAmount) > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete advance — regular salary payments already exist",
      });
    }

    const removed = Number(adv.amount) || 0;
    adv.deleteOne();

    salary.advanceAmount = Math.max(Number(salary.advanceAmount || 0) - removed, 0);
    salary.paymentStatus = calculatePaymentStatus(
      salary.netSalary,
      salary.paidAmount,
      salary.advanceAmount
    );

    await salary.save();
    return res.status(200).json({
      success: true,
      message: "Advance deleted successfully",
      salary,
    });
  } catch (error) {
    console.error("[deleteSalaryAdvance]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete advance",
      error: error.message,
    });
  }
};

const deleteSalary = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary ID",
      });
    }

    const salary = await Salary.findOne({
      _id: id,
      isDeleted: false,
    }).select("paidAmount advanceAmount");

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }

    if (Number(salary.paidAmount) > 0) {
      return res.status(400).json({
        success: false,
        message: "Paid or partially paid salary records cannot be deleted",
      });
    }

    if (Number(salary.advanceAmount) > 0) {
      return res.status(400).json({
        success: false,
        message: "Salary records with advances cannot be deleted. Delete the advances first.",
      });
    }

    await Salary.updateOne(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: "Salary deleted successfully",
    });
  } catch (error) {
    console.error("[deleteSalary]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete salary",
      error: error.message,
    });
  }
};

const SALARY_DAY_DIVISOR = 30;
const SIZES = ["2kg", "5kg", "8kg", "10kg"];

const REEL_WEIGHTS = {
  "2kg": 2,
  "5kg": 5,
  "8kg": 8,
  "10kg": 10,
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getDateString = (date) => {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDaysBetween = (start, end) => {
  const days = [];

  const current = startOfDay(start);
  const last = startOfDay(end);

  while (current <= last) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
};

const calculateFixedSalary = async ({ worker, periodStart, periodEnd }) => {
  const joiningDate = startOfDay(worker.joiningDate);

  const effectiveStart = joiningDate > periodStart ? joiningDate : periodStart;

  const dates = getDaysBetween(effectiveStart, periodEnd);
  const workingDays = dates.length;

  if (workingDays <= 0) {
    return {
      basicSalary: 0,
      attendance: {
        workingDays: 0,
        presentDays: 0,
        absentDays: 0,
        dailyRate: 0,
        absenceDeduction: 0,
      },
    };
  }

  const attendanceDocs = await Attendance.find({
    date: {
      $gte: getDateString(effectiveStart),
      $lte: getDateString(periodEnd),
    },
  }).select("date allPresent absentWorkers");

  const attendanceMap = new Map();

  for (const attendance of attendanceDocs) {
    attendanceMap.set(attendance.date, attendance);
  }

  let absentDays = 0;

  for (const date of dates) {
    const dateString = getDateString(date);
    const attendance = attendanceMap.get(dateString);

    if (!attendance) continue;
    if (attendance.allPresent === true) continue;

    const isAbsent =
      Array.isArray(attendance.absentWorkers) &&
      attendance.absentWorkers.some(
        (id) => String(id) === String(worker._id)
      );

    if (isAbsent) absentDays++;
  }

  const monthlySalary = Number(worker.fixedPay?.amount) || 0;
  const dailyRate = monthlySalary / SALARY_DAY_DIVISOR;
  const absenceDeduction = dailyRate * absentDays;
  const adjustedBasic = Math.max(0, monthlySalary - absenceDeduction);

  return {
    basicSalary: roundMoney(adjustedBasic),
    attendance: {
      workingDays,
      presentDays: Math.max(workingDays - absentDays, 0),
      absentDays,
      dailyRate: roundMoney(dailyRate),
      absenceDeduction: roundMoney(absenceDeduction),
    },
  };
};

const calculateVariableSalary = async ({ worker, periodStart, periodEnd }) => {
  const productions = await ProductProduction.find({
    date: {
      $gte: startOfDay(periodStart),
      $lte: endOfDay(periodEnd),
    },
    isActive: true,
    "workers.worker": worker._id,
  }).select("date workers");

  const quantities = { "2kg": 0, "5kg": 0, "8kg": 0, "10kg": 0 };
  const amounts = { "2kg": 0, "5kg": 0, "8kg": 0, "10kg": 0 };

  const rates = {
    "2kg": Number(worker.variablePay?.rate2kg) || 0,
    "5kg": Number(worker.variablePay?.rate5kg) || 0,
    "8kg": Number(worker.variablePay?.rate8kg) || 0,
    "10kg": Number(worker.variablePay?.rate10kg) || 0,
  };

  let totalReels = 0;
  let totalEarnings = 0;

  for (const production of productions) {
    const workerEntry = production.workers?.find(
      (item) => String(item.worker) === String(worker._id)
    );
    if (!workerEntry) continue;

    for (const size of SIZES) {
      const qty = Number(workerEntry.production?.[size]) || 0;
      quantities[size] += qty;
      totalReels += qty;
    }

    totalEarnings += Number(workerEntry.totalEarnings) || 0;
  }

  const production = {};

  for (const size of SIZES) {
    const quantity = quantities[size];
    const rate = rates[size];
    const weightKg = REEL_WEIGHTS[size] || 0;
    const amount = quantity * weightKg * rate;

    amounts[size] = amount;

    production[size] = {
      quantity,
      rate,
      amount: roundMoney(amount),
    };
  }

  return {
    basicSalary: roundMoney(totalEarnings),
    production: {
      ...production,
      totalReels,
      totalEarnings: roundMoney(totalEarnings),
    },
  };
};

const generateSalaries = async (req, res) => {
  try {
    const { periodStart, periodEnd, workerIds = [] } = req.body;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Salary period start and end dates are required",
      });
    }

    const start = startOfDay(periodStart);
    const end = endOfDay(periodEnd);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid salary period dates",
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "Period start date cannot be after period end date",
      });
    }

    const filter = {
      status: "Active",
      joiningDate: { $lte: end },
    };

    if (Array.isArray(workerIds) && workerIds.length) {
      const invalidId = workerIds.find((id) => !isValidId(id));

      if (invalidId) {
        return res.status(400).json({
          success: false,
          message: "Invalid worker ID",
        });
      }

      filter._id = { $in: workerIds };
    }

    const workers = await Worker.find(filter);

    if (!workers.length) {
      return res.status(200).json({
        success: true,
        message: "No active workers found",
        salaries: [],
      });
    }

    const results = [];

    for (const worker of workers) {
      let calculation;

      if (worker.payType === "Fixed") {
        calculation = await calculateFixedSalary({
          worker,
          periodStart: start,
          periodEnd: end,
        });
      } else {
        calculation = await calculateVariableSalary({
          worker,
          periodStart: start,
          periodEnd: end,
        });
      }

      const existingSalary = await Salary.findOne({
        worker: worker._id,
        periodStart: start,
        periodEnd: end,
        isDeleted: false,
      });

      if (existingSalary && Number(existingSalary.paidAmount) > 0) {
        results.push({
          worker: worker._id,
          name: worker.name,
          status: "skipped",
          reason: "Salary already has payments",
          salary: existingSalary,
        });

        continue;
      }

      const basicSalary = Number(calculation.basicSalary) || 0;
      const allowances = existingSalary?.allowances || 0;
      const deductions = existingSalary?.deductions || 0;

      const netSalary = calculateNetSalary(basicSalary, allowances, deductions);

      let salary;

      if (existingSalary) {
        existingSalary.payType = worker.payType;
        existingSalary.basicSalary = basicSalary;
        existingSalary.netSalary = netSalary;

        if (calculation.attendance) {
          existingSalary.attendance = calculation.attendance;
        }

        if (calculation.production) {
          existingSalary.production = calculation.production;
        }

        existingSalary.paymentStatus = calculatePaymentStatus(
          netSalary,
          existingSalary.paidAmount,
          existingSalary.advanceAmount
        );

        await existingSalary.save();
        salary = existingSalary;
      } else {
        try {
          salary = await Salary.create({
            worker: worker._id,
            payType: worker.payType,
            periodStart: start,
            periodEnd: end,
            basicSalary,
            allowances,
            deductions,
            attendance: calculation.attendance || undefined,
            production: calculation.production || undefined,
            netSalary,
            paidAmount: 0,
            paymentStatus: "Pending",
            notes: "",
          });
        } catch (createErr) {
          if (createErr.code === 11000) {
            results.push({
              worker: worker._id,
              name: worker.name,
              status: "skipped",
              reason: "Duplicate salary record already exists",
            });
            continue;
          }
          throw createErr;
        }
      }

      const populated = await Salary.findById(salary._id).populate(
        "worker",
        "workerId name phone role department payType fixedPay variablePay"
      );

      results.push({
        worker: worker._id,
        name: worker.name,
        status: existingSalary ? "updated" : "created",
        salary: populated,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Salary generation completed successfully",
      salaries: results,
    });
  } catch (error) {
    console.error("[generateSalaries]", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate salaries",
      error: error.message,
    });
  }
};

module.exports = {
  createSalary,
  generateSalaries,
  getSalaries,
  getSalary,
  updateSalary,
  recordSalaryAdvance,
  deleteSalaryAdvance,
  recordSalaryPayment,
  deleteSalary,
};