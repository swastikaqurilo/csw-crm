const express = require("express");

const {
  createFollowUp,
  getFollowUps,
  getFollowUp,
  updateFollowUp,
  deleteFollowUp,
} = require("../controllers/followUpController");

const router = express.Router();

router.post("/", createFollowUp);
router.get("/", getFollowUps);
router.get("/:id", getFollowUp);
router.put("/:id", updateFollowUp);
router.delete("/:id", deleteFollowUp);

module.exports = router;