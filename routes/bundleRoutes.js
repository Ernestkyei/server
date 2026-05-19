// routes/bundleRoutes.js
const express = require('express');
const router = express.Router();
const bundleController = require('../controllers/bundleController');

// Public routes (no authentication needed)
router.get('/', bundleController.getAllBundles);
router.get('/network/:network', bundleController.getBundlesByNetwork);
router.get('/:id', bundleController.getBundleById);

module.exports = router;