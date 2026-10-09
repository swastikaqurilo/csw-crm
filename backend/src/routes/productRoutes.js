const express = require("express");
const router = express.Router();

const {
  getAllProductStock,
  updateProductReserved,
  adjustProductStock,
  recordProductScrap,
  getProductStockMovements,
  getAllProductions,
  getProductionById,
  createProduction,
  updateProduction,
  deleteProduction,
  debugReels,
} = require("../controllers/productController");

router.get("/stock", getAllProductStock);

router.patch("/stock/:id/reserved", updateProductReserved);

router.patch("/stock/:id/adjust", adjustProductStock);

router.patch("/stock/:id/scrap", recordProductScrap);

router.get("/stock/:id/movements", getProductStockMovements);

router.get("/debug/reels", debugReels);

router.get("/", getAllProductions);

router.post("/", createProduction);

router.get("/:id", getProductionById);

router.patch("/:id", updateProduction);

router.delete("/:id", deleteProduction);

module.exports = router;