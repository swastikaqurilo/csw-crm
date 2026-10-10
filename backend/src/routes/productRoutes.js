  const express = require("express");
  const { restrictTo } = require("../middleware/auth");

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

  router.patch(
    "/stock/:id/reserved",
    restrictTo("Admin", "Sales Manager"),
    updateProductReserved
  );

  router.patch(
    "/stock/:id/adjust",
    restrictTo("Admin", "Sales Manager"),
    adjustProductStock
  );

  router.patch(
    "/stock/:id/scrap",
    restrictTo("Admin", "Sales Manager"),
    recordProductScrap
  );

  router.get("/stock/:id/movements", getProductStockMovements);

  router.get("/debug/reels", restrictTo("Admin"), debugReels);

  router.get("/", getAllProductions);

  router.post("/", restrictTo("Admin", "Sales Manager"), createProduction);

  router.get("/:id", getProductionById);

  router.patch("/:id", restrictTo("Admin", "Sales Manager"), updateProduction);

  router.delete("/:id", restrictTo("Admin", "Sales Manager"), deleteProduction);

  module.exports = router;