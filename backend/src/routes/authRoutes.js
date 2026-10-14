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

router.post("/login", login);
router.post("/register", register);
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;