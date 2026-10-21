const express = require("express");

const {
  createContact,
  getContacts,
  getContact,
  updateContact,
  deleteContact,
} = require("../controllers/contactController");
const idempotency = require("../middleware/idempotency");

const router = express.Router();

router.get("/", getContacts);
router.get("/:id", getContact);

router.post("/", idempotency(), createContact);
router.put("/:id", idempotency(), updateContact);
router.delete("/:id", idempotency(), deleteContact);

module.exports = router;