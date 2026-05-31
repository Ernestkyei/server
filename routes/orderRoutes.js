const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validate, orderSchema } = require('../middlewares/validate');

// ==================== OPTIONAL AUTH MIDDLEWARE ====================
// Attaches req.user if a valid token is present, but does NOT block guests.
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  const token = authHeader.split(' ')[1];
  try {
    req.user = authMiddleware.verifyToken(token); // reuse your existing verify logic
  } catch {
    // invalid/expired token — treat as guest, don't block
  }
  next();
};

// ==================== PUBLIC ROUTES (No login required) ====================

// Create order — optionalAuth so userId is saved when user is logged in
router.post('/', optionalAuth, validate(orderSchema), orderController.createOrder);

// Get order by order number
router.get('/track/:orderNumber', orderController.getOrderByNumber);

// Get orders by phone number
router.get('/customer/:phoneNumber', orderController.getOrdersByPhoneNumber);

// Check delivery status
router.get('/status/:orderId', orderController.checkDeliveryStatus);

// Initialize payment — optionalAuth so userId can be patched if missing
router.post('/:orderId/pay', optionalAuth, orderController.initializePayment);

// Verify payment (callback from Paystack)
router.get('/verify-payment/:reference', orderController.verifyPayment);

// Paystack webhook (no auth - called by Paystack)
router.post('/webhook/paystack', orderController.paystackWebhook);

// ==================== USER ROUTES (Login required) ====================

// Get payment history for logged-in user
router.get('/payment-history', authMiddleware.protect, orderController.getPaymentHistory);

// Get single payment details
router.get('/payment-history/:orderId', authMiddleware.protect, orderController.getPaymentDetails);

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