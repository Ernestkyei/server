const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const notificationService = require('./notificationService');

// Mock provider service (will be replaced with real RemaData API)
const remaData = require('./remaDataMock');

// Helper: Format phone number
const formatPhoneNumber = (phoneNumber) => {
  let cleaned = phoneNumber.replace(/\s+/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '233' + cleaned.substring(1);
  }
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
};

// ==================== CREATE ORDER ====================
const createOrder = async (bundleId, phoneNumber, userId = null, customerEmail = null, customerName = null) => {
  const bundle = await prisma.bundle.findUnique({
    where: { id: bundleId, isActive: true }
  });
  
  if (!bundle) {
    throw new Error('Bundle not found or unavailable');
  }
  
  // Check stock availability
  if (bundle.stock <= 0) {
    throw new Error('Bundle out of stock');
  }
  
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  
  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId,
      bundleId,
      phoneNumber,
      amount: bundle.sellingPrice,
      paymentStatus: 'PENDING',
      status: 'PENDING',
      deliveryStatus: 'PENDING_DELIVERY'
    },
    include: {
      bundle: true
    }
  });
  
  console.log(`Order created: ${orderNumber} for ${bundle.name} at GHS ${bundle.sellingPrice}`);
  
  if (order.userId) {
    await notificationService.orderCreated(order);
  }
  
  return order;
};

// ==================== UPDATE PAYMENT REFERENCE ====================
const updatePaymentReference = async (orderId, paymentReference) => {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentReference,
      paymentStatus: 'PAID'
    },
    include: {
      bundle: true
    }
  });
  
  console.log(`Payment reference updated for order ${order.orderNumber}: ${paymentReference}`);
  
  if (order.userId) {
    await notificationService.paymentConfirmed(order);
  }
  
  return order;
};

// ==================== PROCESS SUCCESSFUL PAYMENT ====================
const processSuccessfulPayment = async (paymentReference) => {
  const order = await prisma.order.findFirst({
    where: { paymentReference },
    include: {
      bundle: true
    }
  });
  
  if (!order) {
    throw new Error('Order not found');
  }
  
  if (order.paymentStatus === 'PAID') {
    return order;
  }
  
  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'PAID'
    }
  });
  
  if (order.userId) {
    await notificationService.paymentConfirmed(order);
  }
  
  const providerResult = await deliverDataToProvider(order);
  
  return order;
};

// ==================== DELIVER DATA TO PROVIDER ====================
const deliverDataToProvider = async (order) => {
  try {
    const formattedPhone = formatPhoneNumber(order.phoneNumber);
    
    console.log(`DELIVERING ORDER: ${order.orderNumber}`);
    console.log(`Bundle: ${order.bundle.name}`);
    console.log(`Phone: ${formattedPhone}`);
    
    const result = await remaData.purchaseBundle(
      order.bundle.providerCode,
      formattedPhone,
      order.id
    );
    
    console.log(`Provider result:`, result);
    
    await prisma.order.update({
      where: { id: order.id },
      data: {
        providerRequestId: result.requestId,
        providerStatus: result.status,
        deliveryStatus: result.status === 'DELIVERED' ? 'DELIVERED' : 'PENDING_DELIVERY'
      }
    });
    
    // If provider confirms delivery, mark as delivered (this deducts stock)
    if (result.status === 'DELIVERED') {
      console.log(`Calling markOrderAsDelivered for ${order.orderNumber}`);
      await markOrderAsDelivered(order.id);
    } else {
      console.log(`Provider returned status: ${result.status}, not DELIVERED yet`);
    }
    
    return result;
  } catch (error) {
    console.error('Provider delivery failed:', error);
    
    await prisma.order.update({
      where: { id: order.id },
      data: {
        deliveryStatus: 'FAILED',
        deliveryMessage: error.message
      }
    });
    
    if (order.userId) {
      await notificationService.orderFailed(order, error.message);
    }
    
    throw new Error(`Data delivery failed: ${error.message}`);
  }
};

// ==================== MARK ORDER AS DELIVERED ====================
const markOrderAsDelivered = async (orderId) => {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'COMPLETED',
      deliveryStatus: 'DELIVERED',
      deliveredAt: new Date(),
      deliveryMessage: 'Data bundle sent successfully to your phone'
    },
    include: {
      bundle: true
    }
  });
  
  console.log(`Order ${order.orderNumber} marked as DELIVERED`);
  
  if (order.userId) {
    await notificationService.orderDelivered(order);
  }
  
  // DEDUCT BUNDLE STOCK
  const updatedBundle = await prisma.bundle.update({
    where: { id: order.bundleId },
    data: { stock: { decrement: 1 } }
  });
  console.log(`Stock deducted for bundle ${order.bundle.name}. New stock: ${updatedBundle.stock}`);
  
  // DEDUCT PROVIDER WALLET BALANCE
  const providerAccount = await prisma.providerAccount.findFirst({
    where: { provider: 'RemaData' }
  });
  
  if (providerAccount) {
    const updatedAccount = await prisma.providerAccount.update({
      where: { id: providerAccount.id },
      data: { balance: { decrement: order.bundle.costPrice } }
    });
    console.log(`Wallet deducted: GHS ${order.bundle.costPrice}. New balance: GHS ${updatedAccount.balance}`);
  } else {
    console.log('Provider account not found, creating one...');
    await prisma.providerAccount.create({
      data: {
        provider: 'RemaData',
        balance: 1000 - order.bundle.costPrice,
        isActive: true
      }
    });
    console.log(`New provider account created with balance: GHS ${1000 - order.bundle.costPrice}`);
  }
  
  // Check low stock alert
  if (updatedBundle.stock <= 10) {
    await notificationService.bundleLowStock(updatedBundle);
    console.log(`Low stock alert for ${updatedBundle.name}: ${updatedBundle.stock} left`);
  }
  
  return order;
};

// ==================== CHECK DELIVERY STATUS ====================
const checkDeliveryStatus = async (orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId }
  });
  
  if (!order) {
    throw new Error('Order not found');
  }
  
  if (!order.providerRequestId) {
    return { status: order.deliveryStatus, message: order.deliveryMessage };
  }
  
  const result = await remaData.checkStatus(order.providerRequestId);
  
  if (result.status === 'DELIVERED' && order.deliveryStatus !== 'DELIVERED') {
    await markOrderAsDelivered(orderId);
  }
  
  return result;
};

// ==================== GET ORDER BY NUMBER ====================
const getOrderByNumber = async (orderNumber) => {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      bundle: {
        select: {
          name: true,
          network: true,
          dataSize: true
        }
      }
    }
  });
  
  if (!order) {
    throw new Error('Order not found');
  }
  
  return order;
};

// ==================== GET ORDERS BY PHONE NUMBER ====================
const getOrdersByPhoneNumber = async (phoneNumber) => {
  const orders = await prisma.order.findMany({
    where: { phoneNumber },
    include: {
      bundle: {
        select: {
          name: true,
          network: true,
          dataSize: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return orders;
};

// ==================== GET ALL ORDERS (ADMIN) ====================
const getAllOrders = async (status = null, page = 1, limit = 50) => {
  const skip = (page - 1) * limit;
  
  const where = status ? { status } : {};
  
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      include: {
        bundle: {
          select: {
            name: true,
            network: true,
            sellingPrice: true,
            costPrice: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.order.count({ where })
  ]);
  
  const ordersWithProfit = orders.map(order => ({
    ...order,
    profit: order.bundle.sellingPrice - order.bundle.costPrice
  }));
  
  return {
    orders: ordersWithProfit,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
};

// ==================== UPDATE ORDER STATUS ====================
const updateOrderStatus = async (orderId, status, deliveryStatus = null) => {
  const updateData = { status };
  if (deliveryStatus) {
    updateData.deliveryStatus = deliveryStatus;
  }
  
  const order = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
    include: { bundle: true }
  });
  
  console.log(`Order ${order.orderNumber} status updated to ${status}`);
  
  return order;
};

// ==================== GET ORDER STATS ====================
const getOrderStats = async () => {
  const [
    totalOrders,
    completedOrders,
    pendingOrders,
    failedOrders,
    totalRevenue
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'COMPLETED' } }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.count({ where: { status: 'FAILED' } }),
    prisma.order.aggregate({
      _sum: { amount: true },
      where: { status: 'COMPLETED' }
    })
  ]);
  
  const completedOrdersWithBundles = await prisma.order.findMany({
    where: { status: 'COMPLETED' },
    include: { bundle: true }
  });
  
  const totalProfit = completedOrdersWithBundles.reduce((sum, order) => {
    return sum + (order.amount - order.bundle.costPrice);
  }, 0);
  
  return {
    totalOrders,
    completedOrders,
    pendingOrders,
    failedOrders,
    totalRevenue: totalRevenue._sum.amount || 0,
    totalProfit,
    averageOrderValue: totalRevenue._sum.amount / (completedOrders || 1)
  };
};

// ==================== EXPORTS ====================
module.exports = {
  createOrder,
  updatePaymentReference,
  processSuccessfulPayment,
  deliverDataToProvider,
  markOrderAsDelivered,
  checkDeliveryStatus,
  getOrderByNumber,
  getOrdersByPhoneNumber,
  getAllOrders,
  updateOrderStatus,
  getOrderStats,
  formatPhoneNumber
};