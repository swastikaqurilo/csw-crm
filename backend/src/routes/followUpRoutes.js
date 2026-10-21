const express = require("express");

const {
  createFollowUp,
  getFollowUps,
  getFollowUp,
  updateFollowUp,
  deleteFollowUp,
} = require("../controllers/followUpController");
const idempotency = require("../middleware/idempotency");

const router = express.Router();

router.get("/", getFollowUps);
router.get("/:id", getFollowUp);
router.post("/", idempotency(), createFollowUp);
router.put("/:id", idempotency(), updateFollowUp);
router.delete("/:id", idempotency(), deleteFollowUp);

module.exports = router;