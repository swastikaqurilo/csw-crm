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
} = require("../controllers/rawmatsController");

/* ---------- STOCK ---------- */
router.get("/stock/seed-defaults", seedDefaultMaterials);
router.get("/stock", getAllRawStock);
router.post("/stock", createRawStock);
router.get("/stock/:id/movements", getRawStockMovements);
router.get("/stock/:id", getRawStockById);
router.patch("/stock/:id", updateRawStock);
router.post("/stock/:id/adjust", adjustRawStock);

/* ---------- PURCHASES ---------- */
router.get("/purchases", getAllPurchases);
router.post("/purchases", createPurchase);
router.get("/purchases/:id", getPurchaseById);
router.patch("/purchases/:id", updatePurchase);   
router.post("/purchases/:id/receive", receivePurchase);
router.post("/purchases/:id/cancel", cancelPurchase);
router.delete("/purchases/:id", deletePurchase);

module.exports = router;