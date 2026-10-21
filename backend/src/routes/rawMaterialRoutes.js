const express = require("express");
const router = express.Router();
const {
  getAllRawStock,
  getRawStockById,
  createRawStock,
  updateRawStock,
  adjustRawStock,
  getRawStockMovements,
  seedDefaultMaterials,
  getAllPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase, 
  receivePurchase,
  cancelPurchase,
  deletePurchase,
  recordPurchasePayment,
  deletePurchasePayment,
} = require("../controllers/rawmatsController");
const idempotency = require("../middleware/idempotency");

router.get("/stock/seed-defaults", seedDefaultMaterials);
router.get("/stock", getAllRawStock);
router.get("/stock/:id/movements", getRawStockMovements);
router.get("/stock/:id", getRawStockById);

router.get("/purchases", getAllPurchases);
router.get("/purchases/:id", getPurchaseById);
router.post("/purchases/:id/payments", recordPurchasePayment);
router.delete("/purchases/:id/payments/:paymentId", deletePurchasePayment);

router.post("/stock", idempotency(), createRawStock);
router.patch("/stock/:id", idempotency(), updateRawStock);
router.post("/stock/:id/adjust", idempotency(), adjustRawStock);
router.post("/purchases", idempotency(), createPurchase);
router.patch("/purchases/:id", idempotency(), updatePurchase);
router.post("/purchases/:id/receive", idempotency(), receivePurchase);
router.post("/purchases/:id/cancel", idempotency(), cancelPurchase);
router.delete("/purchases/:id", idempotency(), deletePurchase);
router.post("/purchases/:id/payments", idempotency(), recordPurchasePayment);
router.delete("/purchases/:id/payments/:paymentId", idempotency(), deletePurchasePayment);

module.exports = router;