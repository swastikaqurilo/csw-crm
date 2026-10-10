const express = require("express");
const { restrictTo } = require("../middleware/auth");

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

// Read: any authenticated user
router.get("/", getSalaries);
router.get("/:id", getSalary);

// Write / pay / delete: Admin or Sales Manager
router.post("/generate", restrictTo("Admin", "Sales Manager"), generateSalaries);
router.post("/", restrictTo("Admin", "Sales Manager"), createSalary);
router.put("/:id", restrictTo("Admin", "Sales Manager"), updateSalary);
router.post("/:id/advance", restrictTo("Admin", "Sales Manager"), recordSalaryAdvance);
router.delete("/:id/advance/:advanceId", restrictTo("Admin", "Sales Manager"), deleteSalaryAdvance);
router.post("/:id/payment", restrictTo("Admin", "Sales Manager"), recordSalaryPayment);
router.delete("/:id", restrictTo("Admin", "Sales Manager"), deleteSalary);

module.exports = router;