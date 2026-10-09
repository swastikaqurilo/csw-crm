const mongoose = require("mongoose");
const FollowUp = require("../models/FollowUp");

const MAX_LIMIT = 200;

const VALID_TYPES = ["Call", "Email", "Meeting", "WhatsApp", "Other"];
const VALID_STATUSES = ["Pending", "Completed", "Cancelled"];
const VALID_PRIORITIES = ["Low", "Medium", "High"];

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

const createFollowUp = async (req, res) => {
  try {
    const {
      contact,
      enquiry,
      type,
      subject,
      notes,
      scheduledAt,
      status,
      priority,
      completedAt,
    } = req.body;

    if (!contact || !isValidId(contact)) {
      return res.status(400).json({
        success: false,
        message: "Valid contact ID is required",
      });
    }

    const cleanSubject = safeString(subject, 200);
    if (!cleanSubject) {
      return res.status(400).json({
        success: false,
        message: "Subject is required",
      });
    }

    const parsedScheduledAt = parseDate(scheduledAt);
    if (!parsedScheduledAt) {
      return res.status(400).json({
        success: false,
        message: "A valid scheduled date is required",
      });
    }

    let cleanEnquiry = null;
    if (enquiry) {
      if (!isValidId(enquiry)) {
        return res.status(400).json({
          success: false,
          message: "Invalid enquiry ID",
        });
      }
      cleanEnquiry = enquiry;
    }

    if (type !== undefined && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, message: "Invalid priority" });
    }

    const finalStatus = status || "Pending";
    let finalCompletedAt = null;

    if (finalStatus === "Completed") {
      finalCompletedAt = parseDate(completedAt) || new Date();
    } else if (completedAt !== undefined && completedAt !== null) {
      return res.status(400).json({
        success: false,
        message: "completedAt can only be set when status is Completed",
      });
    }

    const payload = {
      contact,
      enquiry: cleanEnquiry,
      type: type || "Call",
      subject: cleanSubject,
      notes: safeString(notes, 2000) || "",
      scheduledAt: parsedScheduledAt,
      status: finalStatus,
      priority: priority || "Medium",
      completedAt: finalCompletedAt,
    };

    const followUp = await FollowUp.create(payload);

    const populated = await FollowUp.findById(followUp._id)
      .populate("contact")
      .populate("enquiry");

    res.status(201).json({
      success: true,
      message: "Follow-up created successfully",
      data: populated,
    });
  } catch (error) {
    console.error("[createFollowUp]", error);

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
      message: "Failed to create follow-up",
    });
  }
};

const getFollowUps = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      priority,
      type,
      contact,
      enquiry,
    } = req.query;

    const query = {};

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status filter" });
      }
      query.status = status;
    }

    if (priority) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid priority filter" });
      }
      query.priority = priority;
    }

    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid type filter" });
      }
      query.type = type;
    }

    if (contact) {
      if (!isValidId(contact)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid contact ID" });
      }
      query.contact = contact;
    }

    if (enquiry) {
      if (!isValidId(enquiry)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid enquiry ID" });
      }
      query.enquiry = enquiry;
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 50, 1), MAX_LIMIT);
    const skip = (pageNumber - 1) * limitNumber;

    const [followUps, total] = await Promise.all([
      FollowUp.find(query)
        .populate("contact")
        .populate("enquiry")
        .sort({ scheduledAt: 1 })
        .skip(skip)
        .limit(limitNumber),
      FollowUp.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: followUps.length,
      total,
      page: pageNumber,
      pages: Math.max(Math.ceil(total / limitNumber), 1),
      data: followUps,
    });
  } catch (error) {
    console.error("[getFollowUps]", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch follow-ups",
    });
  }
};

const getFollowUp = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid follow-up ID",
      });
    }

    const followUp = await FollowUp.findById(req.params.id)
      .populate("contact")
      .populate("enquiry");

    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: "Follow-up not found",
      });
    }

    res.status(200).json({
      success: true,
      data: followUp,
    });
  } catch (error) {
    console.error("[getFollowUp]", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch follow-up",
    });
  }
};

const updateFollowUp = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid follow-up ID",
      });
    }

    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: "Follow-up not found",
      });
    }

    const {
      contact,
      enquiry,
      type,
      subject,
      notes,
      scheduledAt,
      status,
      priority,
      completedAt,
    } = req.body;

    if (contact !== undefined) {
      if (!isValidId(contact)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid contact ID" });
      }
      followUp.contact = contact;
    }

    if (enquiry !== undefined) {
      if (enquiry === null || enquiry === "") {
        followUp.enquiry = null;
      } else {
        if (!isValidId(enquiry)) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid enquiry ID" });
        }
        followUp.enquiry = enquiry;
      }
    }

    if (subject !== undefined) {
      const v = safeString(subject, 200);
      if (!v) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid subject" });
      }
      followUp.subject = v;
    }

    if (notes !== undefined) {
      followUp.notes = safeString(notes, 2000) || "";
    }

    if (scheduledAt !== undefined) {
      const d = parseDate(scheduledAt);
      if (!d) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid scheduled date" });
      }
      followUp.scheduledAt = d;
    }

    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid type" });
      }
      followUp.type = type;
    }

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid priority" });
      }
      followUp.priority = priority;
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status" });
      }

      followUp.status = status;

      if (status === "Completed") {
        followUp.completedAt = parseDate(completedAt) || new Date();
      } else {
        followUp.completedAt = null;
      }
    } else if (completedAt !== undefined) {
      if (followUp.status !== "Completed") {
        return res.status(400).json({
          success: false,
          message: "completedAt can only be set when status is Completed",
        });
      }
      followUp.completedAt = parseDate(completedAt) || followUp.completedAt;
    }

    await followUp.save();

    const populated = await FollowUp.findById(followUp._id)
      .populate("contact")
      .populate("enquiry");

    res.status(200).json({
      success: true,
      message: "Follow-up updated successfully",
      data: populated,
    });
  } catch (error) {
    console.error("[updateFollowUp]", error);

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
      message: "Failed to update follow-up",
    });
  }
};

const deleteFollowUp = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid follow-up ID",
      });
    }

    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: "Follow-up not found",
      });
    }

    await followUp.deleteOne();

    res.status(200).json({
      success: true,
      message: "Follow-up deleted successfully",
    });
  } catch (error) {
    console.error("[deleteFollowUp]", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete follow-up",
    });
  }
};

module.exports = {
  createFollowUp,
  getFollowUps,
  getFollowUp,
  updateFollowUp,
  deleteFollowUp,
};