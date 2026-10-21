const express = require("express");
const router = express.Router();

const {
  getQuotations,
  getQuotationsByEnquiry,
  getQuotationById,
  createQuotation,
  updateQuotation,
  sendQuotation,
  updateQuotationStatus,
  deleteQuotation,
} = require("../controllers/quoteController");
const idempotency = require("../middleware/idempotency");

router.get("/", getQuotations);
router.get("/enquiry/:enquiryId", getQuotationsByEnquiry);
router.get("/:id", getQuotationById);

router.post("/", idempotency(), createQuotation);
router.put("/:id", idempotency(), updateQuotation);
router.patch("/:id/send", idempotency(), sendQuotation);
router.patch("/:id/status", idempotency(), updateQuotationStatus);
router.delete("/:id", idempotency(), deleteQuotation);

module.exports = router;
