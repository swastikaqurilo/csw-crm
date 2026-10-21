const express = require("express");
const router = express.Router();

const {
  createEnquiry,
  getEnquiries,
  getEnquiry,
  updateEnquiry,
  deleteEnquiry,
  addTimelineNote,
} = require("../controllers/enquiryController");
const idempotency = require("../middleware/idempotency");

router.route("/")
  .get(getEnquiries)
  .post(idempotency(), createEnquiry);

router.route("/:id")
  .get(getEnquiry)
  .put(idempotency(), updateEnquiry)
  .delete(idempotency(), deleteEnquiry);

router.post("/:id/notes", idempotency(), addTimelineNote);

module.exports = router;