const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const idempotency = require("../middleware/idempotency");
const {
  getContactsDelta,
  getProductsDelta,
} = require("../controllers/syncController");

router.get("/contacts", auth, getContactsDelta);
router.get("/products", auth, getProductsDelta);

if (process.env.NODE_ENV !== "production") {
  router.post("/_test/write", auth, idempotency(), (req, res) => {
    res.json({
      ok: true,
      operationId: req.header("Idempotency-Key"),
      echo: req.body,
      executedAt: Date.now(),
    });
  });
}

module.exports = router;