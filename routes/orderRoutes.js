const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validate, orderSchema } = require('../middlewares/validate');

// ==================== PUBLIC ROUTES (No login required) ====================

// Create order (guest checkout)
router.post('/', validate(orderSchema), orderController.createOrder);

// Get order by order number
router.get('/track/:orderNumber', orderController.getOrderByNumber);

// Get orders by phone number
router.get('/customer/:phoneNumber', orderController.getOrdersByPhoneNumber);

// Check delivery status
router.get('/status/:orderId', orderController.checkDeliveryStatus);

// Initialize payment for an order
router.post('/:orderId/pay', orderController.initializePayment);

// Verify payment (for callback from Paystack)
router.get('/verify-payment/:reference', orderController.verifyPayment);

// Paystack webhook (no auth - called by Paystack)
router.post('/webhook/paystack', orderController.paystackWebhook);

// ==================== ADMIN ROUTES (Login + Admin role required) ====================

// Get all orders (admin only)
router.get('/admin/all', 
  authMiddleware.protect, 
  authMiddleware.adminOnly, 
  orderController.getAllOrders
);

// Update order status (admin only)
router.put('/admin/:orderId/status', 
  authMiddleware.protect, 
  authMiddleware.adminOnly, 
  orderController.updateOrderStatus
);

// Retry failed delivery (admin only)
router.post('/admin/:orderId/retry', 
  authMiddleware.protect, 
  authMiddleware.adminOnly, 
  orderController.retryDelivery
);

// Get order statistics (admin only)
router.get('/admin/stats', 
  authMiddleware.protect, 
  authMiddleware.adminOnly, 
  orderController.getOrderStats
);

module.exports = router;
