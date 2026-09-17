'use strict';

const express = require('express');

const {
  getRevenueDashboard,
  exportRevenueLedger,
} = require('../controllers/revenueController');

const router = express.Router();

router.get('/dashboard', getRevenueDashboard);
router.get('/ledger', exportRevenueLedger);

module.exports = router;