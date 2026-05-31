const prisma = require('../config/database');
const notificationService = require('./notificationService');
const remaData = require('./remaDataMock');

// ==================== CONSTANTS ====================
const CONSTANTS = {
  LOW_STOCK_THRESHOLD: 10,
  DEFAULT_PROVIDER_BALANCE: 1000,
  PHONE_COUNTRY_CODE: '233',
  ORDER_STATUS: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED'
  },
  PAYMENT_STATUS: {
    PENDING: 'PENDING',
    PAID: 'PAID',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED'
  },
  DELIVERY_STATUS: {
    PENDING: 'PENDING_DELIVERY',
    PROCESSING: 'PROCESSING',
    DELIVERED: 'DELIVERED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED'
  }
};

// ==================== HELPER FUNCTIONS ====================

const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return null;
  
  let cleaned = phoneNumber.replace(/\s+/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = CONSTANTS.PHONE_COUNTRY_CODE + cleaned.substring(1);
  }
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  return cleaned;
};

const deductBundleStock = async (tx, bundleId) => {
  return await tx.bundle.update({
    where: { id: bundleId },
    data: { stock: { decrement: 1 } }
  });
};

const deductProviderWallet = async (tx, costPrice) => {
  const providerAccount = await tx.providerAccount.findFirst({
    where: { provider: 'RemaData' }
  });
  
  if (providerAccount) {
    await tx.providerAccount.update({
      where: { id: providerAccount.id },
      data: { balance: { decrement: costPrice } }
    });
    return;
  }
  
  await tx.providerAccount.create({
    data: {
      provider: 'RemaData',
      balance: CONSTANTS.DEFAULT_PROVIDER_BALANCE - costPrice,
      isActive: true
    }
  });
};

const checkLowStockAlert = async (bundle) => {
  if (bundle.stock <= CONSTANTS.LOW_STOCK_THRESHOLD) {
    await notificationService.bundleLowStock(bundle);
    console.log(`Low stock alert: ${bundle.name} (${bundle.stock} left)`);
  }
};

const generateOrderNumber = () => {
  return `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
};

const validateCreateOrderInput = (bundleId, phoneNumber) => {
  if (!bundleId) throw new Error('Bundle ID is required');
  if (!phoneNumber) throw new Error('Phone number is required');
};

// ==================== CORE FUNCTIONS ====================

const createOrder = async (bundleId, phoneNumber, customerEmail = null, customerName = null, userId = null) => {
  validateCreateOrderInput(bundleId, phoneNumber);

  try {
    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId, isActive: true }
    });

    if (!bundle) throw new Error('Bundle not found or unavailable');
    if (bundle.stock <= 0) throw new Error('Bundle out of stock');

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,        // ✅ links order to logged-in user (null for guests)
        bundleId,
        phoneNumber,
        // customerEmail and customerName removed — not in Prisma schema
        amount: bundle.sellingPrice,
        paymentStatus: CONSTANTS.PAYMENT_STATUS.PENDING,
        status: CONSTANTS.ORDER_STATUS.PENDING,
        deliveryStatus: CONSTANTS.DELIVERY_STATUS.PENDING
      },
      include: { bundle: true }
    });

    console.log(`Order created: ${order.orderNumber} | Amount: GHS ${bundle.sellingPrice}`);

    if (order.userId) {
      await notificationService.orderCreated(order);
    }

    return order;

  } catch (error) {
    console.error('createOrder failed:', error.message);
    throw new Error(`Order creation failed: ${error.message}`);
  }
};

const updatePaymentReference = async (orderId, paymentReference) => {
  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { paymentReference },
      include: { bundle: true }
    });
    
    console.log(`Payment reference saved: ${order.orderNumber} -> ${paymentReference}`);
    return order;
    
  } catch (error) {
    console.error('updatePaymentReference failed:', error.message);
    throw new Error(`Failed to save payment reference: ${error.message}`);
  }
};

const processSuccessfulPayment = async (paymentReference) => {
  try {
    const order = await prisma.order.findFirst({
      where: { paymentReference },
      include: { bundle: true }
    });
    
    if (!order) throw new Error('Order not found');
    
    if (order.paymentStatus === CONSTANTS.PAYMENT_STATUS.PAID) {
      console.log(`Order ${order.orderNumber} already paid, skipping duplicate`);
      return order;
    }
    
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: CONSTANTS.PAYMENT_STATUS.PAID }
      });
    });
    
    console.log(`Payment confirmed: ${order.orderNumber}`);
    
    if (order.userId) {
      await notificationService.paymentConfirmed(order);
    }
    
    await deliverDataToProvider(order);
    return order;
    
  } catch (error) {
    console.error('processSuccessfulPayment failed:', error.message);
    throw new Error(`Payment processing failed: ${error.message}`);
  }
};

const deliverDataToProvider = async (order) => {
  try {
    const formattedPhone = formatPhoneNumber(order.phoneNumber);
    
    console.log(`Delivering: ${order.orderNumber} | ${order.bundle.name} -> ${formattedPhone}`);
    
    const result = await remaData.purchaseBundle(
      order.bundle.providerCode,
      formattedPhone,
      order.id
    );
    
    await prisma.order.update({
      where: { id: order.id },
      data: {
        providerRequestId: result.requestId,
        providerStatus: result.status,
        deliveryStatus: result.status === 'DELIVERED' 
          ? CONSTANTS.DELIVERY_STATUS.DELIVERED 
          : CONSTANTS.DELIVERY_STATUS.PENDING
      }
    });
    
    if (result.status === 'DELIVERED') {
      await markOrderAsDelivered(order.id);
    }
    
    return result;
    
  } catch (error) {
    console.error('deliverDataToProvider failed:', error.message);
    
    await prisma.order.update({
      where: { id: order.id },
      data: {
        deliveryStatus: CONSTANTS.DELIVERY_STATUS.FAILED,
        deliveryMessage: error.message
      }
    });
    
    if (order.userId) {
      await notificationService.orderFailed(order, error.message);
    }
    
    throw new Error(`Data delivery failed: ${error.message}`);
  }
};

const markOrderAsDelivered = async (orderId) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bundle: true }
    });
    
    if (!order) throw new Error('Order not found');
    
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: CONSTANTS.ORDER_STATUS.COMPLETED,
          deliveryStatus: CONSTANTS.DELIVERY_STATUS.DELIVERED,
          deliveredAt: new Date(),
          deliveryMessage: 'Data bundle sent successfully'
        }
      });
      
      await deductBundleStock(tx, order.bundleId);
      await deductProviderWallet(tx, order.bundle.costPrice);
    });
    
    console.log(`Order delivered: ${order.orderNumber}`);
    
    if (order.userId) {
      await notificationService.orderDelivered(order);
    }
    
    const finalBundle = await prisma.bundle.findUnique({
      where: { id: order.bundleId }
    });
    
    if (finalBundle) {
      await checkLowStockAlert(finalBundle);
    }
    
    return order;
    
  } catch (error) {
    console.error('markOrderAsDelivered failed:', error.message);
    throw new Error(`Failed to mark order as delivered: ${error.message}`);
  }
};

// ==================== QUERY FUNCTIONS ====================

const checkDeliveryStatus = async (orderId) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });
    
    if (!order) throw new Error('Order not found');
    
    if (!order.providerRequestId) {
      return { status: order.deliveryStatus, message: order.deliveryMessage };
    }
    
    const result = await remaData.checkStatus(order.providerRequestId);
    
    if (result.status === 'DELIVERED' && order.deliveryStatus !== CONSTANTS.DELIVERY_STATUS.DELIVERED) {
      await markOrderAsDelivered(orderId);
    }
    
    return result;
    
  } catch (error) {
    console.error('checkDeliveryStatus failed:', error.message);
    throw new Error(`Failed to check delivery status: ${error.message}`);
  }
};

const getOrderByNumber = async (orderNumber) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        bundle: { select: { name: true, network: true, dataSize: true } }
      }
    });
    
    if (!order) throw new Error('Order not found');
    return order;
    
  } catch (error) {
    console.error('getOrderByNumber failed:', error.message);
    throw new Error(`Failed to get order: ${error.message}`);
  }
};

const getOrdersByPhoneNumber = async (phoneNumber) => {
  try {
    return await prisma.order.findMany({
      where: { phoneNumber },
      include: { bundle: { select: { name: true, network: true, dataSize: true } } },
      orderBy: { createdAt: 'desc' }
    });
    
  } catch (error) {
    console.error('getOrdersByPhoneNumber failed:', error.message);
    throw new Error(`Failed to get orders: ${error.message}`);
  }
};

const getAllOrders = async (status = null, page = 1, limit = 50) => {
  try {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          bundle: { select: { name: true, network: true, sellingPrice: true, costPrice: true } }
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
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total
    };
    
  } catch (error) {
    console.error('getAllOrders failed:', error.message);
    throw new Error(`Failed to get orders: ${error.message}`);
  }
};

const updateOrderStatus = async (orderId, status, deliveryStatus = null) => {
  try {
    const updateData = { status };
    if (deliveryStatus) updateData.deliveryStatus = deliveryStatus;
    
    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: { bundle: true }
    });
    
    console.log(`Order ${order.orderNumber} status -> ${status}`);
    return order;
    
  } catch (error) {
    console.error('updateOrderStatus failed:', error.message);
    throw new Error(`Failed to update order status: ${error.message}`);
  }
};

const getOrderStats = async () => {
  try {
    const [totalOrders, completedOrders, pendingOrders, failedOrders, totalRevenue] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: CONSTANTS.ORDER_STATUS.COMPLETED } }),
      prisma.order.count({ where: { status: CONSTANTS.ORDER_STATUS.PENDING } }),
      prisma.order.count({ where: { status: CONSTANTS.ORDER_STATUS.FAILED } }),
      prisma.order.aggregate({
        _sum: { amount: true },
        where: { status: CONSTANTS.ORDER_STATUS.COMPLETED }
      })
    ]);
    
    const completedOrdersWithBundles = await prisma.order.findMany({
      where: { status: CONSTANTS.ORDER_STATUS.COMPLETED },
      include: { bundle: true }
    });
    
    const totalProfit = completedOrdersWithBundles.reduce(
      (sum, order) => sum + (order.amount - order.bundle.costPrice), 0
    );
    
    return {
      totalOrders,
      completedOrders,
      pendingOrders,
      failedOrders,
      totalRevenue: totalRevenue._sum.amount || 0,
      totalProfit,
      averageOrderValue: completedOrders > 0 ? totalRevenue._sum.amount / completedOrders : 0
    };
    
  } catch (error) {
    console.error('getOrderStats failed:', error.message);
    throw new Error(`Failed to get order stats: ${error.message}`);
  }
};

// ==================== IDEMPOTENCY ====================

const isWebhookAlreadyProcessed = async (paymentReference) => {
  const order = await prisma.order.findFirst({
    where: { paymentReference }
  });
  return order && order.paymentStatus === CONSTANTS.PAYMENT_STATUS.PAID;
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
  formatPhoneNumber,
  isWebhookAlreadyProcessed,
  CONSTANTS
};