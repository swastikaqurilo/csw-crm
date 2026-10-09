const express = require("express");
const router = express.Router();
const { restrictTo } = require("../middleware/auth");
const { getSettings, updateSettings } = require("../controllers/settingsController");

router.get("/", getSettings);
router.put("/", restrictTo("Admin"), updateSettings);

module.exports = router;