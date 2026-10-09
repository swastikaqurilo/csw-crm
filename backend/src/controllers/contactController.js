const mongoose = require("mongoose");
const Contact = require("../models/Contacts");
const Order = require("../models/Order");
const Payment = require("../models/Payment");

const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 500) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : "";
};

const normalizePhone = (v) => {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
};

const escapeRegex = (str) =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createContact = async (req, res) => {
  try {
    const {
      name,
      company,
      role,
      email,
      phone,
      address,
      billingAddress,
      shippingAddress,
      gstin,
      state,
      stateCode,
      enquiry,
      status,
    } = req.body;

    const cleanName = safeString(name, 150);
    if (!cleanName) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    // company & email optional (aligns with order-created contacts)
    const cleanCompany = safeString(company, 200) || "";
    const cleanEmail = safeString(email, 200) || "";

    let cleanPhone = "";
    if (phone !== undefined && phone !== null && String(phone).trim() !== "") {
      cleanPhone = normalizePhone(phone);
      if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid 10-digit Indian mobile number",
        });
      }
    }

    let cleanEnquiry = null;
    if (enquiry) {
      if (!isValidId(enquiry)) {
        return res.status(400).json({ success: false, message: "Invalid enquiry ID" });
      }
      cleanEnquiry = enquiry;
    }

    const cleanAddress = safeString(address, 500) || "";
    const cleanBilling = safeString(billingAddress, 500) || cleanAddress;
    const cleanShipping = safeString(shippingAddress, 500) || cleanAddress;

    const payload = {
      name: cleanName,
      company: cleanCompany,
      role: safeString(role, 100) || "",
      email: cleanEmail,
      phone: cleanPhone,

      address: cleanAddress,
      billingAddress: cleanBilling,
      shippingAddress: cleanShipping,

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

const getContacts = async (req, res) => {
  try {
    const { q, company, page = 1, limit = 5, status } = req.query;

    const filter = {};

    if (q && typeof q === "string" && q.trim()) {
      const safe = escapeRegex(q.trim().slice(0, 100));
      filter.$or = [
        { name: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
        { phone: { $regex: safe, $options: "i" } },
      ];
    }

    if (company && company !== "All Companies") {
      filter.company = safeString(company, 200);
    }

    if (status) {
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status filter" });
      }
      filter.status = status;
    }

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
        totalPages: Math.ceil(total / limitNum) || 1,
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
      billingAddress,
      shippingAddress,
      gstin,
      state,
      stateCode,
      enquiry,
      status,
    } = req.body;

    if (name !== undefined) {
      const v = safeString(name, 150);
      if (!v) return res.status(400).json({ success: false, message: "Invalid name" });
      contact.name = v;
    }
    if (company !== undefined) {
      contact.company = safeString(company, 200) || "";
    }
    if (role !== undefined) contact.role = safeString(role, 100) || "";
    if (email !== undefined) {
      contact.email = safeString(email, 200) || "";
    }
    if (phone !== undefined) {
      if (phone === null || String(phone).trim() === "") {
        contact.phone = "";
      } else {
        const p = normalizePhone(phone);
        if (p && !/^[6-9]\d{9}$/.test(p)) {
          return res.status(400).json({
            success: false,
            message: "Enter a valid 10-digit Indian mobile number",
          });
        }
        contact.phone = p || "";
      }
    }

    if (address !== undefined) {
      const a = safeString(address, 500) || "";
      contact.address = a;
      if (billingAddress === undefined && shippingAddress === undefined) {
        contact.billingAddress = a;
        contact.shippingAddress = a;
      }
    }
    if (billingAddress !== undefined) {
      contact.billingAddress = safeString(billingAddress, 500) || "";
    }
    if (shippingAddress !== undefined) {
      contact.shippingAddress = safeString(shippingAddress, 500) || "";
    }

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

    await contact.save();

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

const deleteContact = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid contact ID" });
    }

    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    // Soft-delete: keep history for orders / payments
    const [orderCount, paymentCount] = await Promise.all([
      Order.countDocuments({ contact: contact._id, isActive: true }),
      Payment.countDocuments({ contact: contact._id, isActive: true }),
    ]);

    if (contact.status === "inactive") {
      return res.status(200).json({
        success: true,
        message: "Contact is already inactive",
        data: contact,
      });
    }

    contact.status = "inactive";
    await contact.save();

    return res.status(200).json({
      success: true,
      message:
        orderCount + paymentCount > 0
          ? "Contact deactivated (linked orders/payments preserved)"
          : "Contact deactivated successfully",
      data: contact,
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
