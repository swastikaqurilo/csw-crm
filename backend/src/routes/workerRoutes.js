const express = require("express");
const { restrictTo } = require("../middleware/auth");

const {
  getWorkers,
  getWorker,
  createWorker,
  updateWorker,
  deleteWorker,
  getAttendance,
  saveAttendance,
  getAttendanceHistory,
} = require("../controllers/workerController");

const router = express.Router();

// Static paths BEFORE /:id
router.get("/attendance/history", getAttendanceHistory);
router.get("/attendance", getAttendance);
router.post("/attendance", restrictTo("Admin", "Sales Manager"), saveAttendance);

router.get("/", getWorkers);
router.post("/", restrictTo("Admin", "Sales Manager"), createWorker);

router.get("/:id", getWorker);
router.put("/:id", restrictTo("Admin", "Sales Manager"), updateWorker);
router.delete("/:id", restrictTo("Admin"), deleteWorker);

module.exports = router;
