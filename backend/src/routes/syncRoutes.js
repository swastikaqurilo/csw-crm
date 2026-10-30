const express = require("express");
const router = express.Router();

const { protect: auth } = require("../middleware/auth");
const idempotency = require("../middleware/idempotency");

const {
  getContactsDelta,
  getProductsDelta,
  getEnquiriesDelta,
  getOrdersDelta,
  getPaymentsDelta,
  getExpensesDelta,
  getRawStockDelta, 
  getRawPurchasesDelta,
} = require("../controllers/syncController");

router.get("/contacts",  auth, getContactsDelta);
router.get("/products",  auth, getProductsDelta);
router.get("/enquiries", auth, getEnquiriesDelta);
router.get("/orders",    auth, getOrdersDelta);
router.get("/payments",  auth, getPaymentsDelta);
router.get("/expenses",  auth, getExpensesDelta);
router.get("/raw-stock", auth, getRawStockDelta); 
router.get("/raw-purchases", auth, getRawPurchasesDelta);

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