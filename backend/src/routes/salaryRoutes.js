const express = require("express");

const {
  createSalary,
  generateSalaries,
  getSalaries,
  getSalary,
  updateSalary,
  recordSalaryPayment,
  deleteSalary,
  recordSalaryAdvance,       // ← new
  deleteSalaryAdvance, 
} = require("../controllers/salaryController");

const router = express.Router();

router.get("/", getSalaries);

router.post("/generate", generateSalaries);

router.get("/:id", getSalary);

router.post("/", createSalary);

router.put("/:id", updateSalary);
router.post("/advance", recordSalaryAdvance);
router.delete("/:id/advance/:advanceId", deleteSalaryAdvance);

router.post("/:id/payment", recordSalaryPayment);

router.delete("/:id", deleteSalary);

module.exports = router;