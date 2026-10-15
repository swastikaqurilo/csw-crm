const express = require("express");
const { protect } = require("../middleware/auth");

const {
  login,
  register,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
} = require("../controllers/userController");

const router = express.Router();

// Public routes
router.post("/login", login);
router.post("/register", register);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Authenticated routes
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);

module.exports = router;
