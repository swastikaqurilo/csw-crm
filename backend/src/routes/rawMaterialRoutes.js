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

router.get("/stock/seed-defaults", seedDefaultMaterials);
router.get("/stock", getAllRawStock);
router.post("/stock", createRawStock);
router.get("/stock/:id/movements", getRawStockMovements);
router.get("/stock/:id", getRawStockById);
router.patch("/stock/:id", updateRawStock);
router.post("/stock/:id/adjust", adjustRawStock);

router.get("/purchases", getAllPurchases);
router.post("/purchases", createPurchase);
router.get("/purchases/:id", getPurchaseById);
router.patch("/purchases/:id", updatePurchase);   
router.post("/purchases/:id/receive", receivePurchase);
router.post("/purchases/:id/cancel", cancelPurchase);
router.delete("/purchases/:id", deletePurchase);
router.post("/purchases/:id/payments", recordPurchasePayment);
router.delete("/purchases/:id/payments/:paymentId", deletePurchasePayment);

module.exports = router;