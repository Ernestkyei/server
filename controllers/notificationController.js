// controllers/notificationController.js
const notificationService = require('../services/notificationService');

// Get user's notifications
exports.getMyNotifications = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const result = await notificationService.getUserNotifications(
      req.user.userId,
      parseInt(limit),
      parseInt(offset)
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const success = await notificationService.markAsRead(notificationId, req.user.userId);
    
    res.json({
      success: true,
      message: success ? 'Notification marked as read' : 'Notification not found'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const count = await notificationService.markAllAsRead(req.user.userId);
    
    res.json({
      success: true,
      message: `${count} notifications marked as read`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const success = await notificationService.deleteNotification(notificationId, req.user.userId);
    
    res.json({
      success: true,
      message: success ? 'Notification deleted' : 'Notification not found'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const result = await notificationService.getUserNotifications(req.user.userId, 1, 0);
    
    res.json({
      success: true,
      data: { unreadCount: result.unreadCount }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};