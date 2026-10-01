const mongoose = require("mongoose");
const Person = require("../models/Person");

const MAX_LIMIT = 200;
const VALID_TYPES = ["Employee", "Factory People"];
const VALID_STATUSES = ["Active", "Inactive"];

/* ---------- helpers ---------- */
const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 500) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : "";
};

const parseDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const handleError = (res, error, fallback) => {
  console.error(`[${fallback}]`, error);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: Object.values(error.errors).map((e) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid value for ${error.path}`,
    });
  }

  res.status(500).json({
    success: false,
    message: fallback,
  });
};

/* ================= CREATE ================= */
const createPerson = async (req, res) => {
  try {
    const {
      name,
      phone,
      type,
      role,
      joiningDate,
      salary,
      dailyWage,
      status,
    } = req.body;

    // Required fields
    const cleanName = safeString(name, 150);
    if (!cleanName) {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }

    if (!type || !VALID_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid type" });
    }

    const parsedJoining = parseDate(joiningDate);
    if (!parsedJoining) {
      return res
        .status(400)
        .json({ success: false, message: "Valid joining date is required" });
    }

    // Conditional numeric fields
    let finalSalary = null;
    let finalDailyWage = null;

    if (type === "Employee") {
      if (salary === undefined || salary === null || salary === "") {
        return res.status(400).json({
          success: false,
          message: "Salary is required for an employee",
        });
      }
      const n = Number(salary);
      if (!Number.isFinite(n) || n < 0 || n > 1e9) {
        return res.status(400).json({
          success: false,
          message: "Salary must be between 0 and 1,000,000,000",
        });
      }
      finalSalary = n;
    }

    if (type === "Factory People") {
      if (
        dailyWage === undefined ||
        dailyWage === null ||
        dailyWage === ""
      ) {
        return res.status(400).json({
          success: false,
          message: "Daily wage is required for factory people",
        });
      }
      const n = Number(dailyWage);
      if (!Number.isFinite(n) || n < 0 || n > 1e7) {
        return res.status(400).json({
          success: false,
          message: "Daily wage must be between 0 and 10,000,000",
        });
      }
      finalDailyWage = n;
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    // Explicit whitelist
    const person = await Person.create({
      name: cleanName,
      phone: safeString(phone, 20) || "",
      type,
      role: safeString(role, 100) || "",
      joiningDate: parsedJoining,
      salary: finalSalary,
      dailyWage: finalDailyWage,
      status: status || "Active",
    });

    res.status(201).json({
      success: true,
      message: "Person created successfully",
      data: person,
    });
  } catch (error) {
    handleError(res, error, "Failed to create person");
  }
};

/* ================= LIST ================= */
const getPeople = async (req, res) => {
  try {
    const { type, status } = req.query;

    const filter = {};

    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid type filter" });
      }
      filter.type = type;
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status filter" });
      }
      filter.status = status;
    }

    const people = await Person.find(filter)
      .sort({ createdAt: -1 })
      .limit(MAX_LIMIT); // 👈 was unbounded

    res.status(200).json({
      success: true,
      count: people.length,
      data: people,
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch people");
  }
};

/* ================= GET ONE ================= */
const getPerson = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid person ID" });
    }

    const person = await Person.findById(req.params.id);
    if (!person) {
      return res
        .status(404)
        .json({ success: false, message: "Person not found" });
    }

    res.status(200).json({ success: true, data: person });
  } catch (error) {
    handleError(res, error, "Failed to fetch person");
  }
};

/* ================= UPDATE ================= */
const updatePerson = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid person ID" });
    }

    const person = await Person.findById(req.params.id);
    if (!person) {
      return res
        .status(404)
        .json({ success: false, message: "Person not found" });
    }

    // Name
    if (req.body.name !== undefined) {
      const v = safeString(req.body.name, 150);
      if (!v) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid name" });
      }
      person.name = v;
    }

    if (req.body.phone !== undefined) {
      person.phone = safeString(req.body.phone, 20) || "";
    }

    if (req.body.role !== undefined) {
      person.role = safeString(req.body.role, 100) || "";
    }

    // Type — if changing, enforce the conditional field rules
    if (req.body.type !== undefined) {
      if (!VALID_TYPES.includes(req.body.type)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid type" });
      }
      person.type = req.body.type;
    }

    // Joining date
    if (req.body.joiningDate !== undefined) {
      const d = parseDate(req.body.joiningDate);
      if (!d) {
        return res.status(400).json({
          success: false,
          message: "Invalid joining date",
        });
      }
      person.joiningDate = d;
    }

    // Salary (only when Employee)
    if (req.body.salary !== undefined) {
      if (person.type !== "Employee") {
        return res.status(400).json({
          success: false,
          message: "Salary can only be set for Employee type",
        });
      }
      const n = Number(req.body.salary);
      if (!Number.isFinite(n) || n < 0 || n > 1e9) {
        return res.status(400).json({
          success: false,
          message: "Salary must be between 0 and 1,000,000,000",
        });
      }
      person.salary = n;
    }

    // Daily wage (only when Factory People)
    if (req.body.dailyWage !== undefined) {
      if (person.type !== "Factory People") {
        return res.status(400).json({
          success: false,
          message: "Daily wage can only be set for Factory People type",
        });
      }
      const n = Number(req.body.dailyWage);
      if (!Number.isFinite(n) || n < 0 || n > 1e7) {
        return res.status(400).json({
          success: false,
          message: "Daily wage must be between 0 and 10,000,000",
        });
      }
      person.dailyWage = n;
    }

    // If type changed, clear the field that no longer applies
    if (person.type === "Employee") {
      person.dailyWage = null;
    } else if (person.type === "Factory People") {
      person.salary = null;
    }

    // Status
    if (req.body.status !== undefined) {
      if (!VALID_STATUSES.includes(req.body.status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status" });
      }
      person.status = req.body.status;
    }

    await person.save(); // runs schema validators

    res.status(200).json({
      success: true,
      message: "Person updated successfully",
      data: person,
    });
  } catch (error) {
    handleError(res, error, "Failed to update person");
  }
};

/* ================= DELETE (soft) ================= */
const deletePerson = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid person ID" });
    }

    const person = await Person.findById(req.params.id);
    if (!person) {
      return res
        .status(404)
        .json({ success: false, message: "Person not found" });
    }

    person.status = "Inactive";
    await person.save();

    res.status(200).json({
      success: true,
      message: "Person marked as inactive",
      data: person,
    });
  } catch (error) {
    handleError(res, error, "Failed to deactivate person");
  }
};

module.exports = {
  createPerson,
  getPeople,
  getPerson,
  updatePerson,
  deletePerson,
};