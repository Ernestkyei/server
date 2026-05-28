// services/notificationService.js
const prisma = require('../config/database');

// Create a notification for a user
exports.createNotification = async (userId, title, message, data = null) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        isRead: false
      }
    });
    
    console.log(`📧 Notification sent to user ${userId}: ${title}`);
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

// Get all notifications for a user
exports.getUserNotifications = async (userId, limit = 20, offset = 0) => {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit
  });
  
  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false }
  });
  
  return {
    notifications,
    unreadCount,
    total: notifications.length
  };
};

// Mark a single notification as read
exports.markAsRead = async (notificationId, userId) => {
  const notification = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true }
  });
  
  return notification.count > 0;
};

// Mark all notifications as read for a user
exports.markAllAsRead = async (userId) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  });
  
  return result.count;
};

// Delete a notification
exports.deleteNotification = async (notificationId, userId) => {
  const result = await prisma.notification.deleteMany({
    where: { id: notificationId, userId }
  });
  
  return result.count > 0;
};

// Delete all notifications for a user (admin only)
exports.deleteAllNotifications = async (userId) => {
  const result = await prisma.notification.deleteMany({
    where: { userId }
  });
  
  return result.count;
};

// Order related notifications
exports.orderCreated = async (order) => {
  const message = `Your order #${order.orderNumber} has been created. Amount: ${order.amount} GHS`;
  await exports.createNotification(order.userId, 'Order Created', message);
};

exports.paymentConfirmed = async (order) => {
  const message = `Payment confirmed for order #${order.orderNumber}. Your data bundle will be delivered shortly.`;
  await exports.createNotification(order.userId, 'Payment Confirmed', message);
};

exports.orderDelivered = async (order) => {
  const message = `Your data bundle (${order.bundle.name}) has been sent to ${order.phoneNumber}`;
  await exports.createNotification(order.userId, 'Data Delivered 🎉', message);
};

exports.orderFailed = async (order, reason) => {
  const message = `Order #${order.orderNumber} failed: ${reason}. Please contact support.`;
  await exports.createNotification(order.userId, 'Order Failed ❌', message);
};

// Bundle related notifications (admin only)
exports.bundleLowStock = async (bundle) => {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' }
  });
  
  for (const admin of admins) {
    await exports.createNotification(
      admin.id, 
      'Low Stock Alert ⚠️', 
      `Bundle ${bundle.name} has only ${bundle.stock} units left.`
    );
  }
};

// Welcome notification for new users
exports.welcomeNewUser = async (user) => {
  const message = `Welcome to Data Bundle Marketplace! 🎉 Start by browsing our data bundles.`;
  await exports.createNotification(user.id, 'Welcome! 👋', message);
};

// Provider balance low notification (admin only)
exports.providerBalanceLow = async (provider, balance) => {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' }
  });
  
  for (const admin of admins) {
    await exports.createNotification(
      admin.id,
      'Provider Balance Low ⚠️',
      `${provider} balance is low: ${balance} GHS. Please recharge.`
    );
  }
};