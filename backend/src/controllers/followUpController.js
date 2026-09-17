const FollowUp = require("../models/FollowUp");

const createFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.create(req.body);

    const populatedFollowUp = await FollowUp.findById(followUp._id)
      .populate("contact")
      .populate("enquiry");

    res.status(201).json({
      success: true,
      message: "Follow-up created successfully",
      data: populatedFollowUp,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        error: error.message,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid contact or enquiry ID",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create follow-up",
      error: error.message,
    });
  }
};

const getFollowUps = async (req, res) => {
  try {
    const followUps = await FollowUp.find()
      .populate("contact")
      .populate("enquiry")
      .sort({ scheduledAt: 1 });

    res.status(200).json({
      success: true,
      count: followUps.length,
      data: followUps,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch follow-ups",
      error: error.message,
    });
  }
};

const getFollowUp = async (req, res) => {
  try {
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
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid follow-up ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to fetch follow-up",
      error: error.message,
    });
  }
};

const updateFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    )
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
      message: "Follow-up updated successfully",
      data: followUp,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid follow-up ID",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update follow-up",
      error: error.message,
    });
  }
};

const deleteFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findByIdAndDelete(req.params.id);

    if (!followUp) {
      return res.status(404).json({
        success: false,
        message: "Follow-up not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Follow-up deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid follow-up ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete follow-up",
      error: error.message,
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