const mongoose = require("mongoose");
const Contact = require("../models/Contacts");

/* ---------- helpers ---------- */
const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 500) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : "";
};

// Escape regex special chars → prevents ReDoS and injection in $regex
const escapeRegex = (str) =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ================= CREATE ================= */
const createContact = async (req, res) => {
  try {
    const {
      name,
      company,
      role,
      email,
      phone,
      address,
      gstin,
      state,
      stateCode,
      enquiry,
      status,
    } = req.body;

    // Required fields
    const cleanName = safeString(name, 150);
    const cleanCompany = safeString(company, 200);
    const cleanEmail = safeString(email, 200);

    if (!cleanName) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!cleanCompany) {
      return res.status(400).json({ success: false, message: "Company is required" });
    }
    if (!cleanEmail) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // enquiry ID check
    let cleanEnquiry = null;
    if (enquiry) {
      if (!isValidId(enquiry)) {
        return res.status(400).json({ success: false, message: "Invalid enquiry ID" });
      }
      cleanEnquiry = enquiry;
    }

    // Explicit whitelist — nothing from req.body flows raw.
    // Notice: `contactId` and `enquiries` are NOT in this list → client can't set them.
    const payload = {
      name: cleanName,
      company: cleanCompany,
      role: safeString(role, 100) || "",
      email: cleanEmail,
      phone: safeString(phone, 20) || "",
      address: safeString(address, 500) || "",
      gstin: safeString(gstin, 15) || "",
      state: safeString(state, 100) || "",
      stateCode: safeString(stateCode, 5) || "",
      enquiry: cleanEnquiry,
      status: ["active", "inactive"].includes(status) ? status : "active",
      lastContact: new Date(),
    };

    const contact = await Contact.create(payload);

    res.status(201).json({
      success: true,
      message: "Contact created successfully",
      data: contact,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || "field";
      return res.status(409).json({
        success: false,
        message: `Contact already exists: ${field}`,
        field,
      });
    }

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

    console.error("[createContact]", error);
    res.status(500).json({
      success: false,
      message: "Failed to create contact",
    });
  }
};

/* ================= LIST ================= */
const getContacts = async (req, res) => {
  try {
    const { q, company, page = 1, limit = 5, status } = req.query;

    const filter = {};

    // Search — escape regex to avoid ReDoS / injection
    if (q && typeof q === "string" && q.trim()) {
      const safe = escapeRegex(q.trim().slice(0, 100));
      filter.$or = [
        { name: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
        { phone: { $regex: safe, $options: "i" } },
      ];
    }

    // Company filter
    if (company && company !== "All Companies") {
      filter.company = safeString(company, 200);
    }

    // Status filter
    if (status) {
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status filter" });
      }
      filter.status = status;
    }

    // Clamp pagination — prevent ?limit=999999 DoS
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 100);

    const [contacts, total] = await Promise.all([
      Contact.find(filter)
        .populate("enquiry")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Contact.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("[getContacts]", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contacts",
    });
  }
};

/* ================= GET ONE ================= */
const getContact = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid contact ID" });
    }

    const contact = await Contact.findById(req.params.id).populate("enquiry");

    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    res.status(200).json({ success: true, data: contact });
  } catch (error) {
    console.error("[getContact]", error);
    res.status(500).json({ success: false, message: "Failed to fetch contact" });
  }
};

/* ================= UPDATE ================= */
const updateContact = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid contact ID" });
    }

    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    const {
      name,
      company,
      role,
      email,
      phone,
      address,
      gstin,
      state,
      stateCode,
      enquiry,
      status,
    } = req.body;

    // Whitelist editable fields (NOT contactId, NOT enquiries count)
    if (name !== undefined) {
      const v = safeString(name, 150);
      if (!v) return res.status(400).json({ success: false, message: "Invalid name" });
      contact.name = v;
    }
    if (company !== undefined) {
      const v = safeString(company, 200);
      if (!v) return res.status(400).json({ success: false, message: "Invalid company" });
      contact.company = v;
    }
    if (role !== undefined) contact.role = safeString(role, 100) || "";
    if (email !== undefined) {
      const v = safeString(email, 200);
      if (!v) return res.status(400).json({ success: false, message: "Invalid email" });
      contact.email = v;
    }
    if (phone !== undefined) contact.phone = safeString(phone, 20) || "";
    if (address !== undefined) contact.address = safeString(address, 500) || "";
    if (gstin !== undefined) contact.gstin = safeString(gstin, 15) || "";
    if (state !== undefined) contact.state = safeString(state, 100) || "";
    if (stateCode !== undefined) contact.stateCode = safeString(stateCode, 5) || "";

    if (enquiry !== undefined) {
      if (enquiry === null || enquiry === "") {
        contact.enquiry = null;
      } else {
        if (!isValidId(enquiry)) {
          return res.status(400).json({ success: false, message: "Invalid enquiry ID" });
        }
        contact.enquiry = enquiry;
      }
    }

    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
      }
      contact.status = status;
    }

    await contact.save(); // runs schema validators

    const updated = await Contact.findById(contact._id).populate("enquiry");

    res.status(200).json({
      success: true,
      message: "Contact updated successfully",
      data: updated,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || "field";
      return res.status(409).json({
        success: false,
        message: `Contact already exists: ${field}`,
        field,
      });
    }

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

    console.error("[updateContact]", error);
    res.status(500).json({ success: false, message: "Failed to update contact" });
  }
};

/* ================= DELETE ================= */
const deleteContact = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid contact ID" });
    }

    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    await contact.deleteOne();

    res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error) {
    console.error("[deleteContact]", error);
    res.status(500).json({ success: false, message: "Failed to delete contact" });
  }
};

module.exports = {
  createContact,
  getContacts,
  getContact,
  updateContact,
  deleteContact,
};