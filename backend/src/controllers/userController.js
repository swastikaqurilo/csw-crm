const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

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

/* =========================================================
   LOGIN
========================================================= */
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
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
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

/* =========================================================
   REGISTER
   ⚠️ Assumes: name, email, password, role on User schema.
   ⚠️ Assumes: hashing happens HERE, not in a schema pre-save hook.
   If your User model hashes in pre('save'), REMOVE the hash below
   or you'll double-hash.
========================================================= */
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

    const hashed = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim().slice(0, 150),
      email: cleanEmail,
      password: hashed,
      role: role || "Sales Manager",
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
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

/* =========================================================
   GET ME
   Requires `protect` middleware to have set req.user.
========================================================= */
const getMe = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await User.findById(req.user._id).select(
      "-password"
    );

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
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin,
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

module.exports = {
  login,
  register,
  getMe,
  logout,
};