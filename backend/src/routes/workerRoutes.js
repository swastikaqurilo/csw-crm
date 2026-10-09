const express = require("express");

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

router.get("/attendance", getAttendance);
router.post("/attendance", saveAttendance);

router.get("/", getWorkers);
router.get("/:id", getWorker);

router.post("/", createWorker);
router.put("/:id", updateWorker);
router.delete("/:id", deleteWorker);
router.get("/attendance/history", getAttendanceHistory);

module.exports = router;