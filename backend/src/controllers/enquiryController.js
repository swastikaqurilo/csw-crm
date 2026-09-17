const Enquiry = require("../models/Enquiry");

const generateEnquiryNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `ENQ-${year}-`;

  const lastEnquiry = await Enquiry.findOne({
    enquiryNumber: { $regex: `^${prefix}` },
  })
    .sort({ enquiryNumber: -1 })
    .select("enquiryNumber");

  let nextNumber = 1;
  if (lastEnquiry) {
    const lastNum = parseInt(lastEnquiry.enquiryNumber.split("-")[2], 10);
    nextNumber = lastNum + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
};

const createEnquiry = async (req, res) => {
  try {
    const enquiryNumber = await generateEnquiryNumber();

    const enquiry = await Enquiry.create({
      ...req.body,
      enquiryNumber,
      timeline: [
        {
          date: new Date(),
          text: `Enquiry created from ${req.body.source || "Website"}`,
          createdBy: req.body.assignedTo || "System",
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Enquiry created successfully",
      data: enquiry,
    });
  } catch (error) {
    console.error("Create enquiry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create enquiry",
      error: error.message,
    });
  }
};

const getEnquiries = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      source,
      search,
      priority,
    } = req.query;

    const query = { isActive: true };

    if (status && status !== "All Statuses") query.status = status;
    if (source && source !== "All Sources") query.source = source;
    if (priority) query.priority = priority;

    if (search) {
      query.$or = [
        { enquiryNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { project: { $regex: search, $options: "i" } },
        { product: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [enquiries, total] = await Promise.all([
      Enquiry.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Enquiry.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: enquiries.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: enquiries,
    });
  } catch (error) {
    console.error("Get enquiries error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch enquiries",
      error: error.message,
    });
  }
};

const getEnquiry = async (req, res) => {
  try {
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
    res.status(500).json({
      success: false,
      message: "Failed to fetch enquiry",
      error: error.message,
    });
  }
};

const updateEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry || !enquiry.isActive) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    if (req.body.status && req.body.status !== enquiry.status) {
      enquiry.timeline.push({
        date: new Date(),
        text: `Status changed from ${enquiry.status} to ${req.body.status}`,
        createdBy: req.body.assignedTo || "System",
      });
    }

    Object.keys(req.body).forEach((key) => {
      if (key !== "timeline" && key !== "enquiryNumber") {
        enquiry[key] = req.body[key];
      }
    });

    await enquiry.save();

    res.status(200).json({
      success: true,
      message: "Enquiry updated successfully",
      data: enquiry,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update enquiry",
      error: error.message,
    });
  }
};

const deleteEnquiry = async (req, res) => {
  try {
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
    res.status(500).json({
      success: false,
      message: "Failed to delete enquiry",
      error: error.message,
    });
  }
};

const addTimelineNote = async (req, res) => {
  try {
    const { text, createdBy } = req.body;

    if (!text) {
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

    enquiry.timeline.unshift({
      date: new Date(),
      text,
      createdBy: createdBy || "System",
    });

    await enquiry.save();

    res.status(200).json({
      success: true,
      message: "Note added successfully",
      data: enquiry,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to add note",
      error: error.message,
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