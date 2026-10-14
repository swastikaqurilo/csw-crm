const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");
const User = require("../models/User");
const { sendOtpEmail } = require("../utils/mailer");

const DUMMY_HASH =
  "$2a$12$C6UzMDM.H6dfI/f/IKcEe.9w3z6Oa4q0qLZf1J0q4x6YvGKzS5w8u";

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const isValidId = (v) => mongoose.isValidObjectId(v);

const signToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const cleanEmail = email.toLowerCase().trim().slice(0, 200);

    if (!cleanEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (password.length > 128) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = await User.findOne({ email: cleanEmail }).select("+password");

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account is inactive",
      });
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      console.error("[login] JWT_SECRET is missing or too short");
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("[login]", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Valid email is required",
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    if (password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password is too long",
      });
    }

    const cleanEmail = email.toLowerCase().trim().slice(0, 200);

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with that email already exists",
      });
    }

    const user = await User.create({
      name: name.trim().slice(0, 150),
      email: cleanEmail,
      password,
      role: role || "Sales Manager",
      isActive: true,
    });

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("[register]", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with that email already exists",
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join("; "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};

const getMe = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account is inactive",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin,
        },
      },
    });
  } catch (error) {
    console.error("[getMe]", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch account",
    });
  }
};

const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Logged out",
  });
};

const OTP_TTL_MS = 10 * 60 * 1000;      // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;   // 60 seconds

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const forgotPassword = async (req, res) => {
  console.log("[forgotPassword] HIT — email from body:", req.body.email);
  try {
    const email = (req.body.email || "").toLowerCase().trim().slice(0, 200);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const genericOk = {
      success: true,
      message: "If that email is registered, a code has been sent.",
    };

    const user = await User.findOne({ email });
    if (!user) return res.json(genericOk);

    console.log("[forgotPassword] user found:", !!user, "| searched for:", email);

    if (
      user.lastOtpSentAt &&
      Date.now() - user.lastOtpSentAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      const wait = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - user.lastOtpSentAt.getTime())) / 1000
      );
      return res.status(429).json({
        success: false,
        message: `Please wait ${wait}s before requesting another code.`,
      });
    }

    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");

    user.resetOtp = sha256(otp);
    user.resetOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    user.resetOtpAttempts = 0;
    user.lastOtpSentAt = new Date();
    await user.save();

    try {
      await sendOtpEmail({ to: user.email, otp, name: user.name });
    } catch (mailErr) {
      console.error("[forgotPassword] mail failed:", mailErr);
      user.resetOtp = null;
      user.resetOtpExpires = null;
      user.lastOtpSentAt = null;
      await user.save();
      return res.status(500).json({
        success: false,
        message: "Couldn't send the email. Try again later.",
      });
    }

    return res.json(genericOk);
  } catch (err) {
    console.error("[forgotPassword]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const email = (req.body.email || "").toLowerCase().trim().slice(0, 200);
    const otp = String(req.body.otp || "").trim();
    const password = String(req.body.password || "");

    if (!email || !otp || !password) {
      return res.status(400).json({
        success: false,
        message: "Email, code and new password are required.",
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Code must be 6 digits.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    if (password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password is too long.",
      });
    }

    const user = await User.findOne({ email });
    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired code. Request a new one.",
      });
    }

    if (user.resetOtpExpires.getTime() < Date.now()) {
      user.resetOtp = null;
      user.resetOtpExpires = null;
      user.resetOtpAttempts = 0;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Code has expired. Request a new one.",
      });
    }

    if (user.resetOtpAttempts >= MAX_OTP_ATTEMPTS) {
      user.resetOtp = null;
      user.resetOtpExpires = null;
      user.resetOtpAttempts = 0;
      await user.save();
      return res.status(429).json({
        success: false,
        message: "Too many incorrect attempts. Request a new code.",
      });
    }

    if (user.resetOtp !== sha256(otp)) {
      user.resetOtpAttempts += 1;
      await user.save();
      const left = MAX_OTP_ATTEMPTS - user.resetOtpAttempts;
      return res.status(400).json({
        success: false,
        message: `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`,
      });
    }

    user.password = password;
    user.resetOtp = null;
    user.resetOtpExpires = null;
    user.resetOtpAttempts = 0;
    user.lastOtpSentAt = null;
    await user.save();

    return res.json({
      success: true,
      message: "Password updated. You can now sign in.",
    });
  } catch (err) {
    console.error("[resetPassword]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  login,
  register,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
};