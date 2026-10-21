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
const idempotency = require("../middleware/idempotency");

const router = express.Router();

router.get("/attendance/history", getAttendanceHistory);
router.get("/attendance", getAttendance);

router.get("/", getWorkers);
router.post("/", createWorker);

router.post("/attendance", idempotency(), saveAttendance);
router.post("/", idempotency(), createWorker);
router.put("/:id", idempotency(), updateWorker);
router.delete("/:id", idempotency(), deleteWorker);

module.exports = router;