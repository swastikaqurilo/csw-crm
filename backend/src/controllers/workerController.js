const mongoose = require("mongoose");
const { Worker, Attendance } = require("../models/Worker");

const isValidId = (id) => mongoose.isValidObjectId(id);

const safeString = (value, max = 150) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
};

const validatePayConfiguration = ({ payType, fixedPay, variablePay }) => {
  const errors = [];

  if (!["Fixed", "Variable"].includes(payType)) {
    errors.push("Valid pay type is required");
    return errors;
  }

  if (payType === "Fixed") {
    const amount = fixedPay?.amount;

    if (amount === undefined || amount === null || amount === "") {
      errors.push("Fixed pay amount is required");
    } else if (!Number.isFinite(Number(amount)) || Number(amount) < 0) {
      errors.push("Fixed pay amount must be a valid number");
    }

    if (
      fixedPay?.cycle &&
      !["Daily", "Weekly", "Monthly"].includes(fixedPay.cycle)
    ) {
      errors.push("Invalid fixed pay cycle");
    }
  }

  if (payType === "Variable") {
    const rates = [
      { field: "rate2kg", label: "2 KG" },
      { field: "rate5kg", label: "5 KG" },
      { field: "rate8kg", label: "8 KG" },
      { field: "rate10kg", label: "10 KG" },
    ];

    let hasRate = false;

    for (const rate of rates) {
      const value = variablePay?.[rate.field];

      if (value !== undefined && value !== null && value !== "") {
        hasRate = true;

        const numericValue = Number(value);

        if (!Number.isFinite(numericValue)) {
          errors.push(`${rate.label} rate must be a valid number`);
          continue;
        }

        if (numericValue < 2 || numericValue > 3) {
          errors.push(`${rate.label} rate must be between ₹2 and ₹3 per KG`);
        }
      }
    }

    if (!hasRate) {
      errors.push("At least one variable pay rate is required");
    }
  }

  return errors;
};

const createWorker = async (req, res) => {
  try {
    const {
      name,
      phone,
      role,
      department,
      joiningDate,
      status = "Active",
      payType,
      fixedPay,
      variablePay,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Worker name is required",
      });
    }

    if (!joiningDate) {
      return res.status(400).json({
        success: false,
        message: "Joining date is required",
      });
    }

    const joining = new Date(joiningDate);
    if (Number.isNaN(joining.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid joining date",
      });
    }

    if (!["Active", "Inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid worker status",
      });
    }

    const payErrors = validatePayConfiguration({ payType, fixedPay, variablePay });

    if (payErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid pay configuration",
        errors: payErrors,
      });
    }

    const worker = await Worker.create({
      name: name.trim(),
      phone: safeString(phone, 20),
      role: safeString(role, 100),
      department: safeString(department, 100),
      joiningDate: joining,
      status,
      payType,
      fixedPay:
        payType === "Fixed"
          ? {
              amount: Number(fixedPay.amount),
              cycle: fixedPay.cycle || "Monthly",
            }
          : { amount: null, cycle: "Monthly" },
      variablePay:
        payType === "Variable"
          ? {
              rate2kg:
                variablePay?.rate2kg !== undefined && variablePay?.rate2kg !== ""
                  ? Number(variablePay.rate2kg)
                  : null,
              rate5kg:
                variablePay?.rate5kg !== undefined && variablePay?.rate5kg !== ""
                  ? Number(variablePay.rate5kg)
                  : null,
              rate8kg:
                variablePay?.rate8kg !== undefined && variablePay?.rate8kg !== ""
                  ? Number(variablePay.rate8kg)
                  : null,
              rate10kg:
                variablePay?.rate10kg !== undefined &&
                variablePay?.rate10kg !== ""
                  ? Number(variablePay.rate10kg)
                  : null,
            }
          : { rate2kg: null, rate5kg: null, rate8kg: null, rate10kg: null },
    });

    return res.status(201).json({
      success: true,
      message: "Worker created successfully",
      data: worker,
    });
  } catch (error) {
    console.error("[createWorker]", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Worker ID already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create worker",
      error: error.message,
    });
  }
};

const getWorkers = async (req, res) => {
  try {
    const {
      search = "",
      status,
      payType,
      department,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const filter = {};

    if (status) {
      if (!["Active", "Inactive"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter",
        });
      }
      filter.status = status;
    }

    if (payType) {
      if (!["Fixed", "Variable"].includes(payType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pay type filter",
        });
      }
      filter.payType = payType;
    }

    if (department?.trim()) {
      filter.department = department.trim();
    }

    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: regex },
        { phone: regex },
        { role: regex },
        { department: regex },
      ];
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [workers, total] = await Promise.all([
      Worker.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Worker.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: workers.length,
      data: workers,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("[getWorkers]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch workers",
      error: error.message,
    });
  }
};

const getWorker = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid worker ID",
      });
    }

    const worker = await Worker.findById(id).lean();

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    return res.status(200).json({ success: true, data: worker });
  } catch (error) {
    console.error("[getWorker]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch worker",
      error: error.message,
    });
  }
};

const updateWorker = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid worker ID",
      });
    }

    const worker = await Worker.findById(id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    const {
      name,
      phone,
      role,
      department,
      joiningDate,
      status,
      payType,
      fixedPay,
      variablePay,
    } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Worker name cannot be empty",
        });
      }
      worker.name = name.trim();
    }

    if (phone !== undefined) worker.phone = safeString(phone, 20);
    if (role !== undefined) worker.role = safeString(role, 100);
    if (department !== undefined)
      worker.department = safeString(department, 100);

    if (joiningDate !== undefined) {
      const joining = new Date(joiningDate);

      if (Number.isNaN(joining.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid joining date",
        });
      }

      worker.joiningDate = joining;
    }

    if (status !== undefined) {
      if (!["Active", "Inactive"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid worker status",
        });
      }

      worker.status = status;
    }

    const nextPayType = payType !== undefined ? payType : worker.payType;
    const nextFixedPay = fixedPay !== undefined ? fixedPay : worker.fixedPay;
    const nextVariablePay =
      variablePay !== undefined ? variablePay : worker.variablePay;

    const payErrors = validatePayConfiguration({
      payType: nextPayType,
      fixedPay: nextFixedPay,
      variablePay: nextVariablePay,
    });

    if (payErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid pay configuration",
        errors: payErrors,
      });
    }

    worker.payType = nextPayType;

    if (nextPayType === "Fixed") {
      worker.fixedPay = {
        amount: Number(nextFixedPay.amount),
        cycle: nextFixedPay.cycle || "Monthly",
      };

      worker.variablePay = {
        rate2kg: null,
        rate5kg: null,
        rate8kg: null,
        rate10kg: null,
      };
    }

    if (nextPayType === "Variable") {
      worker.variablePay = {
        rate2kg:
          nextVariablePay?.rate2kg !== undefined && nextVariablePay?.rate2kg !== ""
            ? Number(nextVariablePay.rate2kg)
            : null,
        rate5kg:
          nextVariablePay?.rate5kg !== undefined && nextVariablePay?.rate5kg !== ""
            ? Number(nextVariablePay.rate5kg)
            : null,
        rate8kg:
          nextVariablePay?.rate8kg !== undefined && nextVariablePay?.rate8kg !== ""
            ? Number(nextVariablePay.rate8kg)
            : null,
        rate10kg:
          nextVariablePay?.rate10kg !== undefined &&
          nextVariablePay?.rate10kg !== ""
            ? Number(nextVariablePay.rate10kg)
            : null,
      };

      worker.fixedPay = { amount: null, cycle: "Monthly" };
    }

    await worker.save();

    return res.status(200).json({
      success: true,
      message: "Worker updated successfully",
      data: worker,
    });
  } catch (error) {
    console.error("[updateWorker]", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Worker ID already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update worker",
      error: error.message,
    });
  }
};

const deleteWorker = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid worker ID",
      });
    }

    const worker = await Worker.findById(id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    await worker.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Worker deleted successfully",
    });
  } catch (error) {
    console.error("[deleteWorker]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete worker",
      error: error.message,
    });
  }
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const getAttendance = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date || !DATE_RE.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Valid date (YYYY-MM-DD) is required",
      });
    }

    const record = await Attendance.findOne({ date }).populate(
      "absentWorkers",
      "name workerId role"
    );

    if (!record) {
      return res.json({ success: true, data: null });
    }

    return res.json({
      success: true,
      data: {
        date: record.date,
        allPresent: record.allPresent,
        absentWorkers: record.absentWorkers,
      },
    });
  } catch (err) {
    console.error("[getAttendance]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const saveAttendance = async (req, res) => {
  try {
    const { date, allPresent, absentWorkerIds = [] } = req.body;

    if (!date || !DATE_RE.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Valid date (YYYY-MM-DD) is required",
      });
    }

    if (!Array.isArray(absentWorkerIds)) {
      return res.status(400).json({
        success: false,
        message: "absentWorkerIds must be an array",
      });
    }

    const cleanAbsent = allPresent ? [] : absentWorkerIds;

    if (cleanAbsent.length) {
      const count = await Worker.countDocuments({ _id: { $in: cleanAbsent } });
      if (count !== cleanAbsent.length) {
        return res.status(400).json({
          success: false,
          message: "One or more absent worker IDs are invalid",
        });
      }
    }

    const record = await Attendance.findOneAndUpdate(
      { date },
      {
        $set: {
          date,
          allPresent: !!allPresent,
          absentWorkers: cleanAbsent,
          markedBy: req.user?._id || null,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate("absentWorkers", "name workerId role");

    return res.json({
      success: true,
      message: "Attendance saved",
      data: {
        date: record.date,
        allPresent: record.allPresent,
        absentWorkers: record.absentWorkers,
      },
    });
  } catch (err) {
    console.error("[saveAttendance]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /attendance/history?page=1&limit=10
// Lists every saved attendance record, newest first, with counts.
// ---------------------------------------------------------------------------
const getAttendanceHistory = async (req, res) => {
  try {
    const page  = Math.max(Number(req.query.page)  || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const skip  = (page - 1) * limit;

    const [records, total] = await Promise.all([
      Attendance.find({})
        .sort({ date: -1 })                       // ISO strings sort chronologically
        .skip(skip)
        .limit(limit)
        .populate("absentWorkers", "name workerId role")
        .lean(),
      Attendance.countDocuments({}),
    ]);

    const activeWorkers = await Worker.find({ status: "Active" })
      .select("joiningDate")
      .lean();

    const pad = (n) => String(n).padStart(2, "0");
    const toISO = (d) => {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return null;
      return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    };

    const data = records.map((r) => {
      const eligible = activeWorkers.filter((w) => {
        const j = toISO(w.joiningDate);
        return !j || j <= r.date;                 // joined on/before that day
      }).length;

      const absentN  = Array.isArray(r.absentWorkers) ? r.absentWorkers.length : 0;
      const presentN = r.allPresent ? eligible : Math.max(0, eligible - absentN);

      return {
        _id: r._id,
        date: r.date,
        allPresent: r.allPresent,
        absentWorkers: r.absentWorkers || [],
        totalWorkers: eligible,
        presentCount: presentN,
        markedBy: r.markedBy,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("[getAttendanceHistory]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createWorker,
  getWorkers,
  getWorker,
  updateWorker,
  deleteWorker,
  getAttendance,
  saveAttendance,
  getAttendanceHistory,
};