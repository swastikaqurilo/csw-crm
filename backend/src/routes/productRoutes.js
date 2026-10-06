const express = require("express");
const router = express.Router();

const {
  // Product Stock
  getAllProductStock,
  updateProductReserved,
  adjustProductStock,
  recordProductScrap,
  getProductStockMovements,

  // Production
  getAllProductions,
  getProductionById,
  createProduction,
  updateProduction,
  deleteProduction,
  getRecentRates,
  debugReels,
} = require("../controllers/productController");

/* ---- Product Stock (must come before /:id) ---- */
router.get("/stock", getAllProductStock);
router.patch("/stock/:id/reserved", updateProductReserved);
router.patch("/stock/:id/adjust", adjustProductStock);
router.patch("/stock/:id/scrap", recordProductScrap);
router.get("/stock/:id/movements", getProductStockMovements);
router.get("/debug/reels", debugReels);

/* ---- Production Entries ---- */
router.get("/recent-rates", getRecentRates);
router.get("/", getAllProductions);
router.post("/", createProduction);
router.get("/:id", getProductionById);
router.patch("/:id", updateProduction);
router.delete("/:id", deleteProduction);

module.exports = router;