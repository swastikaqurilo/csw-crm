const mongoose = require("mongoose");

const validateObjectId = (paramName = "id") => (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params[paramName])) {
    return res.status(400).json({
      success: false,
      message: `Invalid ${paramName}`,
    });
  }
  next();
};

module.exports = validateObjectId;