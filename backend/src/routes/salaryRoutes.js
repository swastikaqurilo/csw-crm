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

const router = express.Router();

// Read
router.get("/", getSalaries);
router.get("/:id", getSalary);

// Write / pay / delete
router.post("/generate", generateSalaries);
router.post("/", createSalary);
router.put("/:id", updateSalary);
router.post("/:id/advance", recordSalaryAdvance);
router.delete("/:id/advance/:advanceId", deleteSalaryAdvance);
router.post("/:id/payment", recordSalaryPayment);
router.delete("/:id", deleteSalary);

module.exports = router;