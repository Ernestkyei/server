const orderService = require('../services/orderService');
const prisma = require('../config/database');
const axios = require('axios');

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

// Initialize payment with REAL Paystack
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
    
    console.log('Initializing payment for order:', order.orderNumber);
    
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: `guest-${order.phoneNumber}@kidave.com`,
        amount: Math.round(order.amount * 100),
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Paystack response received, reference:', response.data.data.reference);
    
    await orderService.updatePaymentReference(order.id, response.data.data.reference);
    
    console.log('Payment reference saved for order:', order.orderNumber);
    
    res.json({
      success: true,
      data: {
        authorization_url: response.data.data.authorization_url,
        reference: response.data.data.reference,
        amount: order.amount,
        orderNumber: order.orderNumber
      }
    });
    
  } catch (error) {
    console.error('Paystack error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.message || 'Payment initialization failed'
    });
  }
};

// Verify payment (for callback) - FIXED VERSION
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    
    console.log('========================================');
    console.log('VERIFYING PAYMENT FOR REFERENCE:', reference);
    console.log('========================================');
    
    if (!reference) {
      return res.json({ success: false, message: 'No reference provided' });
    }
    
    // 1. First, try to find order by paymentReference
    let order = await prisma.order.findFirst({
      where: { paymentReference: reference },
      include: { bundle: true }
    });
    
    console.log('Order found by paymentReference:', order ? 'YES - ' + order.orderNumber : 'NO');
    
    // 2. If order exists and is already PAID, return success immediately
    if (order && order.paymentStatus === 'PAID') {
      console.log('Order already marked as PAID');
      return res.json({
        success: true,
        message: 'Payment already verified',
        order: {
          orderNumber: order.orderNumber,
          bundleName: order.bundle.name,
          amount: order.amount,
          phoneNumber: order.phoneNumber
        }
      });
    }
    
    // 3. Verify with Paystack API
    let paystackResponse;
    try {
      paystackResponse = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          }
        }
      );
      console.log('Paystack API call successful');
      console.log('Paystack status:', paystackResponse.data.data.status);
    } catch (apiError) {
      console.error('Paystack API error:', apiError.response?.data || apiError.message);
      return res.json({
        success: false,
        message: 'Failed to verify with Paystack'
      });
    }
    
    // 4. If Paystack says payment was successful
    if (paystackResponse.data.data.status === 'success') {
      // If we don't have an order yet, try to find by orderNumber from metadata
      if (!order) {
        const metadata = paystackResponse.data.data.metadata;
        if (metadata && metadata.orderNumber) {
          order = await prisma.order.findFirst({
            where: { orderNumber: metadata.orderNumber },
            include: { bundle: true }
          });
          console.log('Order found by metadata:', order ? 'YES - ' + order.orderNumber : 'NO');
        }
      }
      
      // Update order
      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            status: 'COMPLETED',
            deliveryStatus: 'DELIVERED',
            deliveredAt: new Date(),
            deliveryMessage: 'Data bundle sent successfully to your phone',
            paymentReference: reference
          }
        });
        console.log('✅ Order updated to PAID and DELIVERED');
      } else {
        console.log('⚠️ No order found to update');
      }
      
      // ALWAYS return success: true for successful payment
      return res.json({
        success: true,
        message: 'Payment verified successfully',
        order: order ? {
          orderNumber: order.orderNumber,
          bundleName: order.bundle.name,
          amount: order.amount,
          phoneNumber: order.phoneNumber
        } : null
      });
    } else {
      // Payment not successful
      console.log('Payment not successful, status:', paystackResponse.data.data.status);
      return res.json({
        success: false,
        message: 'Payment not successful',
        status: paystackResponse.data.data.status
      });
    }
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Verification failed'
    });
  }
};

// Paystack webhook
exports.paystackWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;
    
    console.log('Webhook received:', event);
    
    if (event === 'charge.success') {
      const order = await prisma.order.findFirst({
        where: { paymentReference: data.reference },
        include: { bundle: true }
      });
      
      if (order && order.paymentStatus !== 'PAID') {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            status: 'COMPLETED',
            deliveryStatus: 'DELIVERED',
            deliveredAt: new Date(),
            deliveryMessage: 'Data bundle sent successfully'
          }
        });
        
        console.log(`✅ Payment confirmed via webhook for order ${order.orderNumber}`);
      }
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
