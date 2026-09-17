const express = require('express');
const router = express.Router();

const {
  getAllInventory,
  getInventoryById,
  createInventory,
  updateInventory,
  adjustStock,
  deleteInventory,
  getLowStock,
} = require('../controllers/inventoryController');

router.get('/low-stock', getLowStock);

router.route('/')
  .get(getAllInventory)
  .post(createInventory);

router.route('/:id')
  .get(getInventoryById)
  .put(updateInventory)
  .delete(deleteInventory);

router.post('/:id/adjust', adjustStock);

module.exports = router;