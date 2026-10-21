const express = require("express");

const {
  createSalary,
  generateSalaries,
  getSalaries,
  getSalary,
  updateSalary,
  recordSalaryPayment,
  deleteSalary,
  recordSalaryAdvance,
  deleteSalaryAdvance,
} = require("../controllers/salaryController");
const idempotency = require("../middleware/idempotency");

const router = express.Router();

router.get("/", getSalaries);
router.get("/:id", getSalary);

router.post("/generate", idempotency(), generateSalaries);
router.post("/", idempotency(), createSalary);
router.put("/:id", idempotency(), updateSalary);
router.post("/:id/advance", idempotency(), recordSalaryAdvance);
router.delete("/:id/advance/:advanceId", idempotency(), deleteSalaryAdvance);
router.post("/:id/payment", idempotency(), recordSalaryPayment);
router.delete("/:id", idempotency(), deleteSalary);

module.exports = router;