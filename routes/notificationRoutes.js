// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');

// All notification routes require authentication
router.use(authMiddleware.protect);

// Get user's notifications
router.get('/', notificationController.getMyNotifications);

// Get unread count
router.get('/unread/count', notificationController.getUnreadCount);

// Mark a notification as read
router.put('/:notificationId/read', notificationController.markAsRead);

// Mark all as read
router.put('/read/all', notificationController.markAllAsRead);

// Delete a notification
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router;