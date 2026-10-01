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
} = require("../controllers/quotationController");

router.get("/", getQuotations);
router.get("/enquiry/:enquiryId", getQuotationsByEnquiry);
router.get("/:id", getQuotationById);

router.post("/", createQuotation);

router.put("/:id", updateQuotation);
router.patch("/:id/send", sendQuotation);
router.patch("/:id/status", updateQuotationStatus);

router.delete("/:id", deleteQuotation);

module.exports = router;