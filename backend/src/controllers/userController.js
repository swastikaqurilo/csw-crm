const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Used for timing-safe "user not found" responses
// (real hash of "dummy-password-for-timing")
const DUMMY_HASH =
  "$2a$12$C6UzMDM.H6dfI/f/IKcEe.9w3z6Oa4q0qLZf1J0q4x6YvGKzS5w8u";

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Type + presence checks
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Sanitize + length check
    const cleanEmail = email.toLowerCase().trim().slice(0, 200);

    if (!cleanEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      // Return the same generic error as bad credentials — don't reveal
      // which validation step failed for a login endpoint
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

    // 👈 Bug 2 fix: explicit `+password` because schema has select: false
    const user = await User.findOne({ email: cleanEmail }).select("+password");

    // 👈 Timing-safe: always run bcrypt.compare, even if user not found,
    //    so attackers can't tell "email exists" vs "email doesn't exist" by response time
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

    // 👈 Bug 1 fix: use `isActive`, not `status`
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account is inactive",
      });
    }

    // Verify JWT secret exists
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      console.error("[login] JWT_SECRET is missing or too short");
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

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

module.exports = {
  login,
};