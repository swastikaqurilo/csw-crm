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

// Static paths BEFORE /:id so they are not captured as ids
router.get("/attendance/history", getAttendanceHistory);
router.get("/attendance", getAttendance);
router.post("/attendance", saveAttendance);

router.get("/", getWorkers);
router.post("/", createWorker);

router.get("/:id", getWorker);
router.put("/:id", updateWorker);
router.delete("/:id", deleteWorker);

module.exports = router;
