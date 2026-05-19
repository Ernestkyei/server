const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const notificationService = require('./notificationService');

// Mock provider service (will be replaced with real RemaData API)
const remaData = require('./remaDataMock');

class OrderService {
  async createOrder(bundleId, phoneNumber, userId = null, customerEmail = null, customerName = null) {
    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId, isActive: true }
    });
    
    if (!bundle) {
      throw new Error('Bundle not found or unavailable');
    }
    
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
    
    if (order.userId) {
      await notificationService.orderCreated(order);
    }
    
    return order;
  }
  
  async updatePaymentReference(orderId, paymentReference) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentReference,
        paymentStatus: 'PAID'
        // Don't change status here - keep as PENDING
      },
      include: {
        bundle: true
      }
    });
    
    if (order.userId) {
      await notificationService.paymentConfirmed(order);
    }
    
    return order;
  }
  
  async processSuccessfulPayment(paymentReference) {
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
    
    const providerResult = await this.deliverDataToProvider(order);
    
    return order;
  }
  
  async deliverDataToProvider(order) {
    try {
      const formattedPhone = this.formatPhoneNumber(order.phoneNumber);
      
      const result = await remaData.purchaseBundle(
        order.bundle.providerCode,
        formattedPhone,
        order.id
      );
      
      await prisma.order.update({
        where: { id: order.id },
        data: {
          providerRequestId: result.requestId,
          providerStatus: result.status
        }
      });
      
      if (result.status === 'DELIVERED') {
        await this.markOrderAsDelivered(order.id);
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
  }
  
  async markOrderAsDelivered(orderId) {
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
    
    if (order.userId) {
      await notificationService.orderDelivered(order);
    }
    
    await prisma.bundle.update({
      where: { id: order.bundleId },
      data: { stock: { decrement: 1 } }
    });
    
    const updatedBundle = await prisma.bundle.findUnique({
      where: { id: order.bundleId }
    });
    
    if (updatedBundle && updatedBundle.stock <= 10) {
      await notificationService.bundleLowStock(updatedBundle);
    }
    
    return order;
  }
  
  async checkDeliveryStatus(orderId) {
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
      await this.markOrderAsDelivered(orderId);
    }
    
    return result;
  }
  
  async getOrderByNumber(orderNumber) {
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
  }
  
  async getOrdersByPhoneNumber(phoneNumber) {
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
  }
  
  async getAllOrders(status = null, page = 1, limit = 50) {
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
  }
  
  async updateOrderStatus(orderId, status, deliveryStatus = null) {
    const updateData = { status };
    if (deliveryStatus) {
      updateData.deliveryStatus = deliveryStatus;
    }
    
    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: { bundle: true }
    });
    
    return order;
  }
  
  async getOrderStats() {
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
  }
  
  formatPhoneNumber(phoneNumber) {
    let cleaned = phoneNumber.replace(/\s+/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '233' + cleaned.substring(1);
    }
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    return cleaned;
  }
}

module.exports = new OrderService();
