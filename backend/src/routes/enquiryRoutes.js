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

router.route("/")
  .get(getEnquiries)
  .post(createEnquiry);

router.route("/:id")
  .get(getEnquiry)
  .put(updateEnquiry)
  .delete(deleteEnquiry);

router.post("/:id/notes", addTimelineNote);

module.exports = router;