const orderService = require('../services/orderService');
const prisma = require('../config/database');

// Create a new order (Guest checkout - no login required)
exports.createOrder = async (req, res) => {
  try {
    const { bundleId, phoneNumber, customerEmail, customerName } = req.body;
    
    if (!bundleId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Bundle ID and phone number are required'
      });
    }
    
    if (!/^0[0-9]{9}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be 10 digits starting with 0'
      });
    }
    
    const order = await orderService.createOrder(bundleId, phoneNumber, customerEmail, customerName);
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderNumber: order.orderNumber,
        orderId: order.id,
        bundleName: order.bundle.name,
        amount: order.amount,
        phoneNumber: order.phoneNumber,
        status: order.status,
        createdAt: order.createdAt
      }
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get order by order number
exports.getOrderByNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const order = await orderService.getOrderByNumber(orderNumber);
    
    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        bundleName: order.bundle.name,
        network: order.bundle.network,
        dataSize: order.bundle.dataSize,
        amount: order.amount,
        phoneNumber: order.phoneNumber,
        paymentStatus: order.paymentStatus,
        deliveryStatus: order.deliveryStatus,
        deliveryMessage: order.deliveryMessage,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt
      }
    });
    
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// Get orders by phone number
exports.getOrdersByPhoneNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const orders = await orderService.getOrdersByPhoneNumber(phoneNumber);
    
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Check delivery status
exports.checkDeliveryStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const status = await orderService.checkDeliveryStatus(orderId);
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Initialize payment
exports.initializePayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bundle: true }
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    if (order.paymentStatus !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Payment already processed'
      });
    }
    
    const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    await orderService.updatePaymentReference(order.id, paymentReference);
    
    const paymentUrl = `https://checkout.paystack.com/${paymentReference}`;
    
    res.json({
      success: true,
      data: {
        paymentReference,
        paymentUrl,
        amount: order.amount,
        orderNumber: order.orderNumber
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Paystack webhook
exports.paystackWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;
    
    if (event === 'charge.success') {
      await orderService.processSuccessfulPayment(data.reference);
      console.log(`Payment successful: ${data.reference}`);
    }
    
    res.sendStatus(200);
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
};

// Admin: Get all orders
exports.getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const result = await orderService.getAllOrders(status, parseInt(page), parseInt(limit));
    
    res.json({ success: true, data: result });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, deliveryStatus } = req.body;
    
    const order = await orderService.updateOrderStatus(orderId, status, deliveryStatus);
    
    res.json({ success: true, message: 'Order status updated', data: order });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Retry failed delivery
exports.retryDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { bundle: true }
    });
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    await orderService.deliverDataToProvider(order);
    
    res.json({ success: true, message: 'Delivery retry initiated' });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Get order statistics
exports.getOrderStats = async (req, res) => {
  try {
    const stats = await orderService.getOrderStats();
    res.json({ success: true, data: stats });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
