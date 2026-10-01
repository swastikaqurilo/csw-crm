const express = require('express');
const router = express.Router();
const {
  getAllInventory,
  getInventoryFamilies,
  getInventoryById,
  createInventory,
  updateInventory,
  adjustStock,
  deleteInventory,
  getLowStock,
  getCriticalStock,
  getDeadStock,
  getInventorySummary,
  getInventoryMovements,
} = require('../controllers/inventoryController');

// If you have auth middleware, import it:
// const { protect } = require('../middleware/auth');

// ── STATIC routes first ──
router.get('/summary', getInventorySummary);
router.get('/low-stock', getLowStock);
router.get('/critical-stock', getCriticalStock);
router.get('/dead-stock', getDeadStock);
router.get('/families', getInventoryFamilies);

// ── Collection routes ──
router.get('/', getAllInventory);
router.post('/', createInventory);

// ── /:id sub-resources and actions ──
router.get('/:id/movements', getInventoryMovements);
router.post('/:id/adjust', adjustStock);

// ── Bare /:id CRUD last ──
router.get('/:id', getInventoryById);
router.patch('/:id', updateInventory);   // was PUT
router.delete('/:id', deleteInventory);

module.exports = router;