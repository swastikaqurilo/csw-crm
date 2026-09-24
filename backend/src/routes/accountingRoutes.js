'use strict';

const express = require('express');
const { getAccountingDashboard } = require('../controllers/accountingController');

const router = express.Router();

router.get('/dashboard', getAccountingDashboard);

module.exports = router;