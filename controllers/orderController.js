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
    
    // Determine callback URL based on environment
    let callbackUrl;
    if (process.env.NODE_ENV === 'production') {
      callbackUrl = `${process.env.FRONTEND_URL || 'https://admin-wt9c.onrender.com'}/payment/callback`;
    } else {
      callbackUrl = 'http://localhost:3000/payment/callback';
    }
    
    console.log('Using callback URL:', callbackUrl);
    
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: `guest-${order.phoneNumber}@kidave.com`,
        amount: Math.round(order.amount * 100),
        callback_url: callbackUrl,
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

// Verify payment (for callback) - FIXED VERSION - ALWAYS ATTEMPTS DELIVERY
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    
    console.log('========================================');
    console.log('VERIFYING PAYMENT FOR REFERENCE:', reference);
    console.log('========================================');
    
    if (!reference) {
      return res.json({ success: false, message: 'No reference provided' });
    }
    
    // Find order by paymentReference
    let order = await prisma.order.findFirst({
      where: { paymentReference: reference },
      include: { bundle: true }
    });
    
    console.log('Order found:', order ? 'YES - ' + order.orderNumber : 'NO');
    console.log('Current order status:', order?.status);
    console.log('Current payment status:', order?.paymentStatus);
    console.log('Current delivery status:', order?.deliveryStatus);
    
    // If order is already COMPLETED, return success
    if (order && order.status === 'COMPLETED') {
      console.log('Order already COMPLETED');
      return res.json({
        success: true,
        message: 'Order already completed',
        order: {
          orderNumber: order.orderNumber,
          bundleName: order.bundle.name,
          amount: order.amount,
          phoneNumber: order.phoneNumber,
          status: order.deliveryStatus
        }
      });
    }
    
    // Verify with Paystack API
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
      console.log('Paystack status:', paystackResponse.data.data.status);
    } catch (apiError) {
      console.error('Paystack API error:', apiError.response?.data || apiError.message);
      return res.json({
        success: false,
        message: 'Failed to verify with Paystack'
      });
    }
    
    // If Paystack says payment was successful
    if (paystackResponse.data.data.status === 'success') {
      // Find order by metadata if not found
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
      
      if (order) {
        // Only update if not already PAID
        if (order.paymentStatus !== 'PAID') {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'PAID',
              status: 'PROCESSING',
              paymentReference: reference
            }
          });
          console.log('Payment marked as PAID, status: PROCESSING');
        }
        
        // ALWAYS attempt delivery (even if already PROCESSING)
        console.log('Attempting delivery for order:', order.orderNumber);
        try {
          await orderService.deliverDataToProvider(order);
          console.log('Delivery attempted successfully');
        } catch (deliveryError) {
          console.error('Delivery failed:', deliveryError);
          await prisma.order.update({
            where: { id: order.id },
            data: {
              deliveryStatus: 'FAILED',
              deliveryMessage: deliveryError.message
            }
          });
        }
      } else {
        console.log('No order found to update');
      }
      
      // Get updated order
      const updatedOrder = order ? await prisma.order.findFirst({
        where: { id: order.id },
        include: { bundle: true }
      }) : null;
      
      return res.json({
        success: true,
        message: 'Payment verified successfully',
        order: updatedOrder ? {
          orderNumber: updatedOrder.orderNumber,
          bundleName: updatedOrder.bundle.name,
          amount: updatedOrder.amount,
          phoneNumber: updatedOrder.phoneNumber,
          status: updatedOrder.deliveryStatus
        } : null
      });
    } else {
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
            status: 'PROCESSING',
            paymentReference: data.reference
          }
        });
        
        console.log(`Payment confirmed via webhook for order ${order.orderNumber}`);
        
        // Attempt delivery via webhook
        try {
          await orderService.deliverDataToProvider(order);
          console.log(`Bundle delivered via webhook for order ${order.orderNumber}`);
        } catch (deliveryError) {
          console.error('Webhook delivery failed:', deliveryError);
        }
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

// Manual fix endpoint for pending orders
exports.fixPendingOrders = async (req, res) => {
  try {
    // Get all paid orders that are not delivered
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        deliveryStatus: { not: 'DELIVERED' }
      },
      include: { bundle: true }
    });
    
    console.log(`Found ${orders.length} orders to fix`);
    
    let stockUpdates = {};
    let fixedCount = 0;
    
    for (const order of orders) {
      // Update order to delivered
      await prisma.order.update({
        where: { id: order.id },
        data: {
          deliveryStatus: 'DELIVERED',
          status: 'COMPLETED',
          deliveredAt: new Date(),
          deliveryMessage: 'Fixed manually via API'
        }
      });
      
      // Track stock deductions
      const bundleId = order.bundle_id;
      stockUpdates[bundleId] = (stockUpdates[bundleId] || 0) + 1;
      fixedCount++;
    }
    
    // Deduct stock for each bundle
    for (const [bundleId, count] of Object.entries(stockUpdates)) {
      await prisma.bundle.update({
        where: { id: bundleId },
        data: { stock: { decrement: count } }
      });
      console.log(`Deducted ${count} from bundle ${bundleId}`);
    }
    
    res.json({
      success: true,
      message: `Fixed ${fixedCount} orders`,
      stockUpdates
    });
  } catch (error) {
    console.error('Fix error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};