const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validate, importBundlesSchema, updateBundlePricingSchema, validateQuery, paginationSchema } = require('../middlewares/validate');

// ==================== ALL ROUTES REQUIRE ADMIN AUTH ====================
router.use(authMiddleware.protect);
router.use(authMiddleware.adminOnly);

// ==================== PROVIDER SYNC ROUTES ====================

// Get available bundles from provider (RemaData)
router.get('/provider/bundles', adminController.syncBundlesFromProvider);

// Import selected bundles from provider to database
router.post('/provider/import', validate(importBundlesSchema), adminController.importBundles);

// Check provider account balance
router.get('/provider/balance', adminController.getProviderBalance);

// Get provider transaction history
router.get('/provider/transactions', validateQuery(paginationSchema), adminController.getProviderTransactions);

// ==================== BUNDLE MANAGEMENT ====================

// Get all bundles (admin view with profit calculation)
router.get('/bundles/all', validateQuery(paginationSchema), adminController.getAllBundles);

// Update bundle pricing (cost price, selling price, stock)
router.put('/bundles/:id/pricing', validate(updateBundlePricingSchema), adminController.updateBundlePricing);

// ==================== ORDER MANAGEMENT ====================

// Get all orders (admin view)
router.get('/orders/all', adminController.getAllOrders);

// Update order status
router.put('/orders/:orderId/status', adminController.updateOrderStatus);

// Retry failed delivery
router.post('/orders/:orderId/retry', adminController.retryDelivery);

// ==================== DASHBOARD STATS ====================

// Get dashboard statistics (sales, profit, etc.)
router.get('/dashboard/stats', adminController.getDashboardStats);

// Get order statistics
router.get('/orders/stats', adminController.getOrderStats);

module.exports = router;