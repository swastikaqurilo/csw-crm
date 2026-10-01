const errorHandler = (err, req, res, next) => {
  // Mongoose ValidationError
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  // Mongoose CastError (bad ObjectId, bad number, etc.)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid value for ${err.path}`,
    });
  }

  // Duplicate key (unique index)
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate value",
    });
  }

  // Log the real error but don't leak it
  console.error("[Error]", err);
  res.status(500).json({
    success: false,
    message: "Something went wrong",
  });
};

module.exports = errorHandler;