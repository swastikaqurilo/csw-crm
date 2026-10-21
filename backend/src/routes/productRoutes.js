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
const idempotency = require("../middleware/idempotency");

router.get("/stock", getAllProductStock);
router.get("/stock/:id/movements", getProductStockMovements);
router.get("/debug/reels", debugReels);
router.get("/", getAllProductions);
router.get("/:id", getProductionById);

router.patch("/stock/:id/reserved", idempotency(), updateProductReserved);
router.patch("/stock/:id/adjust", idempotency(), adjustProductStock);
router.patch("/stock/:id/scrap", idempotency(), recordProductScrap);
router.post("/", idempotency(), createProduction);
router.patch("/:id", idempotency(), updateProduction);
router.delete("/:id", idempotency(), deleteProduction);

module.exports = router;