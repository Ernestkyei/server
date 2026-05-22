const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validate, importBundlesSchema, updateBundlePricingSchema, validateQuery, paginationSchema } = require('../middlewares/validate');

// ==================== ALL ROUTES REQUIRE ADMIN AUTH ====================
router.use(authMiddleware.protect);
router.use(authMiddleware.adminOnly);

// ==================== PROVIDER SYNC ROUTES ====================
router.get('/provider/bundles', adminController.syncBundlesFromProvider);
router.post('/provider/import', validate(importBundlesSchema), adminController.importBundles);
router.get('/provider/balance', adminController.getProviderBalance);
router.get('/provider/transactions', validateQuery(paginationSchema), adminController.getProviderTransactions);

// ==================== BUNDLE MANAGEMENT ====================
router.get('/bundles/all', validateQuery(paginationSchema), adminController.getAllBundles);
router.put('/bundles/:id/pricing', validate(updateBundlePricingSchema), adminController.updateBundlePricing);

// ==================== ORDER MANAGEMENT ====================
router.get('/orders/all', adminController.getAllOrders);
router.put('/orders/:orderId/status', adminController.updateOrderStatus);
router.post('/orders/:orderId/retry', adminController.retryDelivery);
router.get('/orders/stats', adminController.getOrderStats);

// ==================== USER MANAGEMENT ====================
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.delete('/users/:id', adminController.deleteUser);

// ==================== DASHBOARD STATS ====================
router.get('/dashboard/stats', adminController.getDashboardStats);

// ==================== SETTINGS ROUTES ====================

// Get general settings
router.get('/settings/general', adminController.getGeneralSettings);

// Update general settings
router.put('/settings/general', adminController.updateGeneralSettings);

// Get API keys
router.get('/settings/api-keys', adminController.getApiKeys);

// Update API keys
router.put('/settings/api-keys', adminController.updateApiKeys);

module.exports = router;