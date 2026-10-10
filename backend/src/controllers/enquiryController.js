const mongoose = require("mongoose");
const Enquiry = require("../models/Enquiry");
const { getNextSequence } = require("../models/Counter");

const MAX_TIMELINE_ENTRIES = 200;
const MAX_LIMIT = 100;

/* ---------- helpers ---------- */
const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 500) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : "";
};

const escapeRegex = (str) =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const generateEnquiryNumber = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`enquiry-${year}`);
  return `ENQ-${year}-${String(seq).padStart(4, "0")}`;
};
const createEnquiry = async (req, res) => {
  try {
    const {
      customerName,
      customerRole,
      company,
      phone,
      email,
      project,
      location,
      projectRef,
      product,
      quantity,
      estimatedValue,
      status,
      priority,
      source,
      assignedTo,
      assignedRole,
      requirement,
    } = req.body;

    const cleanCustomerName = safeString(customerName, 150);
    if (!cleanCustomerName) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    let numericEstimatedValue = 0;
    if (
      estimatedValue !== undefined &&
      estimatedValue !== null &&
      estimatedValue !== ""
    ) {
      numericEstimatedValue = Number(estimatedValue);
      if (
        !Number.isFinite(numericEstimatedValue) ||
        numericEstimatedValue < 0 ||
        numericEstimatedValue > 1e12
      ) {
        return res.status(400).json({
          success: false,
          message: "Estimated value must be between 0 and 1,000,000,000,000",
        });
      }
    }

    const VALID_STATUSES = [
      "New",
      "Contacted",
      "In Progress",
      "In Discussion",
      "Quoted",
      "Converted",
      "Lost",
    ];
    const VALID_PRIORITIES = ["Low", "Medium", "High"];
    const VALID_SOURCES = [
      "Website",
      "Referral",
      "Direct",
      "Phone",
      "Direct Tender Reference",
      "Other",
    ];

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, message: "Invalid priority" });
    }
    if (source !== undefined && !VALID_SOURCES.includes(source)) {
      return res.status(400).json({ success: false, message: "Invalid source" });
    }

    const enquiryNumber = await generateEnquiryNumber();

    const payload = {
      enquiryNumber,
      customerName: cleanCustomerName,
      customerRole: safeString(customerRole, 100) || "",
      company: safeString(company, 200) || "",
      phone: safeString(phone, 20) || "",
      email: safeString(email, 200) || "",
      project: safeString(project, 200) || "",
      location: safeString(location, 200) || "",
      projectRef: safeString(projectRef, 100) || "",
      product: safeString(product, 200) || "",
      quantity: safeString(quantity, 100) || "",
      estimatedValue: numericEstimatedValue,
      status: status || "New",
      priority: priority || "Medium",
      source: source || "Website",
      assignedTo: safeString(assignedTo, 100) || "",
      assignedRole: safeString(assignedRole, 100) || "",
      requirement: safeString(requirement, 2000) || "",
      timeline: [
        {
          date: new Date(),
          text: `Enquiry created from ${source || "Website"}`,
          createdBy: safeString(assignedTo, 100) || "System",
        },
      ],
      isActive: true,
    };

    const enquiry = await Enquiry.create(payload);

    res.status(201).json({
      success: true,
      message: "Enquiry created successfully",
      data: enquiry,
    });
  } catch (error) {
    console.error("[createEnquiry]", error);

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

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Enquiry number conflict, please retry",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create enquiry",
    });
  }
};

/* ================= LIST ================= */
const getEnquiries = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, source, search, priority } = req.query;

    const query = { isActive: true };

    const VALID_STATUSES = [
      "New",
      "Contacted",
      "In Progress",
      "In Discussion",
      "Quoted",
      "Converted",
      "Lost",
    ];

    if (status && status !== "All Statuses") {
      if (!VALID_STATUSES.includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status filter" });
      }
      query.status = status;
    }

    if (source && source !== "All Sources") {
      query.source = source;
    }

    if (priority) {
      if (!["Low", "Medium", "High"].includes(priority)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid priority filter" });
      }
      query.priority = priority;
    }

    if (search && typeof search === "string" && search.trim()) {
      const safe = escapeRegex(search.trim().slice(0, 100));
      query.$or = [
        { enquiryNumber: { $regex: safe, $options: "i" } },
        { customerName: { $regex: safe, $options: "i" } },
        { company: { $regex: safe, $options: "i" } },
        { project: { $regex: safe, $options: "i" } },
        { product: { $regex: safe, $options: "i" } },
      ];
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);
    const skip = (pageNumber - 1) * limitNumber;

    const [enquiries, total] = await Promise.all([
      Enquiry.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNumber),
      Enquiry.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: enquiries.length,
      total,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
      data: enquiries,
    });
  } catch (error) {
    console.error("[getEnquiries]", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch enquiries",
    });
  }
};

const getEnquiry = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID",
      });
    }

    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry || !enquiry.isActive) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    res.status(200).json({
      success: true,
      data: enquiry,
    });
  } catch (error) {
    console.error("[getEnquiry]", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch enquiry",
    });
  }
};

const updateEnquiry = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID",
      });
    }

    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry || !enquiry.isActive) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    const VALID_STATUSES = [
      "New",
      "Contacted",
      "In Progress",
      "In Discussion",
      "Quoted",
      "Converted",
      "Lost",
    ];
    const VALID_PRIORITIES = ["Low", "Medium", "High"];
    const VALID_SOURCES = [
      "Website",
      "Referral",
      "Direct",
      "Phone",
      "Direct Tender Reference",
      "Other",
    ];

    if (req.body.status && req.body.status !== enquiry.status) {
      if (!VALID_STATUSES.includes(req.body.status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status" });
      }
      enquiry.timeline = enquiry.timeline || [];
      enquiry.timeline.unshift({
        date: new Date(),
        text: `Status changed from ${enquiry.status} to ${req.body.status}`,
        createdBy: req.user?.name || "System",
      });
      if (enquiry.timeline.length > MAX_TIMELINE_ENTRIES) {
        enquiry.timeline = enquiry.timeline.slice(0, MAX_TIMELINE_ENTRIES);
      }
    }

    const stringFields = {
      customerName: 150,
      customerRole: 100,
      company: 200,
      phone: 20,
      email: 200,
      project: 200,
      location: 200,
      projectRef: 100,
      product: 200,
      quantity: 100,
      assignedTo: 100,
      assignedRole: 100,
      requirement: 2000,
    };

    for (const [field, max] of Object.entries(stringFields)) {
      if (req.body[field] !== undefined) {
        const v = safeString(req.body[field], max);
        if (field === "customerName" && !v) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid customer name" });
        }
        enquiry[field] = v ?? "";
      }
    }

    if (req.body.estimatedValue !== undefined) {
      const n = Number(req.body.estimatedValue);
      if (!Number.isFinite(n) || n < 0 || n > 1e12) {
        return res.status(400).json({
          success: false,
          message: "Estimated value must be between 0 and 1,000,000,000,000",
        });
      }
      enquiry.estimatedValue = n;
    }

    if (req.body.status !== undefined) {
      if (!VALID_STATUSES.includes(req.body.status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status" });
      }
      enquiry.status = req.body.status;
    }

    if (req.body.priority !== undefined) {
      if (!VALID_PRIORITIES.includes(req.body.priority)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid priority" });
      }
      enquiry.priority = req.body.priority;
    }

    if (req.body.source !== undefined) {
      if (!VALID_SOURCES.includes(req.body.source)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid source" });
      }
      enquiry.source = req.body.source;
    }

    await enquiry.save();

    res.status(200).json({
      success: true,
      message: "Enquiry updated successfully",
      data: enquiry,
    });
  } catch (error) {
    console.error("[updateEnquiry]", error);

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

    res.status(500).json({
      success: false,
      message: "Failed to update enquiry",
    });
  }
};

const deleteEnquiry = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID",
      });
    }

    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry || !enquiry.isActive) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    enquiry.isActive = false;
    await enquiry.save();

    res.status(200).json({
      success: true,
      message: "Enquiry deleted successfully",
    });
  } catch (error) {
    console.error("[deleteEnquiry]", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete enquiry",
    });
  }
};

const addTimelineNote = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid enquiry ID",
      });
    }

    const { text, createdBy } = req.body;

    const cleanText = safeString(text, 2000);
    if (!cleanText) {
      return res.status(400).json({
        success: false,
        message: "Note text is required",
      });
    }

    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry || !enquiry.isActive) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    enquiry.timeline = enquiry.timeline || [];
    enquiry.timeline.unshift({
      date: new Date(),
      text: cleanText,
      createdBy: req.user?.name || req.user?.email || "System",
    });

    if (enquiry.timeline.length > MAX_TIMELINE_ENTRIES) {
      enquiry.timeline = enquiry.timeline.slice(0, MAX_TIMELINE_ENTRIES);
    }

    await enquiry.save();

    res.status(200).json({
      success: true,
      message: "Note added successfully",
      data: enquiry,
    });
  } catch (error) {
    console.error("[addTimelineNote]", error);

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

    res.status(500).json({
      success: false,
      message: "Failed to add note",
    });
  }
};

module.exports = {
  createEnquiry,
  getEnquiries,
  getEnquiry,
  updateEnquiry,
  deleteEnquiry,
  addTimelineNote,
};