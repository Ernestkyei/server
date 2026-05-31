const orderService = require('../services/orderService');
const prisma = require('../config/database');
const axios = require('axios');

// ==================== HELPER ====================

const formatOrderResponse = (order) => ({
  orderNumber: order.orderNumber,
  network: order.bundle.network,
  dataSize: order.bundle.dataSize,
  amount: order.amount,
  sellingPrice: order.amount,
  phoneNumber: order.phoneNumber,
  deliveryStatus: order.deliveryStatus,
  status: order.deliveryStatus
});

// ==================== CONTROLLERS ====================

// Create a new order
// Works for both guests and authenticated users.
// If the request has a valid JWT (req.user), the order is linked to that user.
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

    // ✅ FIX: pass userId so the order is linked to the logged-in user
    const userId = req.user?.id || null;

    const order = await orderService.createOrder(
      bundleId,
      phoneNumber,
      customerEmail,
      customerName,
      userId          // <-- new argument
    );

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

// Initialize payment with Paystack
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

    // ✅ FIX: if the order has no userId yet but the caller is authenticated, patch it now
    if (!order.userId && req.user?.id) {
      await prisma.order.update({
        where: { id: order.id },
        data: { userId: req.user.id }
      });
    }

    console.log('Initializing payment for order:', order.orderNumber);

    const callbackUrl = process.env.NODE_ENV === 'production'
      ? `${process.env.FRONTEND_URL || 'https://admin-wt9c.onrender.com'}/payment/callback`
      : 'http://localhost:3000/payment/callback';

    console.log('Using callback URL:', callbackUrl);

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: order.customerEmail || `guest-${order.phoneNumber}@kidave.com`,
        amount: Math.round(order.amount * 100),
        callback_url: callbackUrl,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: order.userId || req.user?.id || null  // ✅ carry userId in metadata as fallback
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

// Verify payment (callback from Paystack)
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    console.log('========================================');
    console.log('VERIFYING PAYMENT FOR REFERENCE:', reference);
    console.log('========================================');

    if (!reference) {
      return res.json({ success: false, message: 'No reference provided' });
    }

    let order = await prisma.order.findFirst({
      where: { paymentReference: reference },
      include: { bundle: true }
    });

    console.log('Order found:', order ? 'YES - ' + order.orderNumber : 'NO');
    console.log('Current order status:', order?.status);
    console.log('Current payment status:', order?.paymentStatus);
    console.log('Current delivery status:', order?.deliveryStatus);

    if (order && order.status === 'COMPLETED') {
      console.log('Order already COMPLETED, returning success');
      return res.json({
        success: true,
        message: 'Order already completed',
        order: formatOrderResponse(order)
      });
    }

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

    if (paystackResponse.data.data.status === 'success') {
      const metadata = paystackResponse.data.data.metadata;

      if (!order) {
        if (metadata?.orderNumber) {
          order = await prisma.order.findFirst({
            where: { orderNumber: metadata.orderNumber },
            include: { bundle: true }
          });
          console.log('Order found by metadata:', order ? 'YES - ' + order.orderNumber : 'NO');
        }
      }

      if (order) {
        // ✅ FIX: resolve userId from order, metadata, or authenticated caller
        const resolvedUserId =
          order.userId ||
          metadata?.userId ||
          req.user?.id ||
          null;

        if (order.paymentStatus !== 'PAID') {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'PAID',
              status: 'PROCESSING',
              paymentReference: reference,
              ...(resolvedUserId && { userId: resolvedUserId }) // ✅ patch userId if missing
            }
          });
          console.log('Payment marked as PAID, userId saved:', resolvedUserId);
        }

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

      const updatedOrder = order
        ? await prisma.order.findFirst({
            where: { id: order.id },
            include: { bundle: true }
          })
        : null;

      return res.json({
        success: true,
        message: 'Payment verified successfully',
        order: updatedOrder ? formatOrderResponse(updatedOrder) : null
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
        // ✅ FIX: also save userId from metadata during webhook if missing
        const userId = order.userId || data.metadata?.userId || null;

        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            status: 'PROCESSING',
            paymentReference: data.reference,
            ...(userId && { userId })
          }
        });

        console.log(`Payment confirmed via webhook for order ${order.orderNumber}`);

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
      await prisma.order.update({
        where: { id: order.id },
        data: {
          deliveryStatus: 'DELIVERED',
          status: 'COMPLETED',
          deliveredAt: new Date(),
          deliveryMessage: 'Fixed manually via API'
        }
      });

      const bundleId = order.bundleId;
      stockUpdates[bundleId] = (stockUpdates[bundleId] || 0) + 1;
      fixedCount++;
    }

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

// ==================== PAYMENT HISTORY (USER) ====================

exports.getPaymentHistory = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error('No authenticated user found in request');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    console.log('===== PAYMENT HISTORY DEBUG =====');
    console.log('Logged in user ID:', userId);
    console.log('User email:', req.user.email);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { userId };
    if (status && status !== 'all') {
      filter.paymentStatus = status;
    }

    console.log('Filter being applied:', JSON.stringify(filter));

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: filter,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          orderNumber: true,
          amount: true,
          phoneNumber: true,
          paymentStatus: true,
          paymentReference: true,
          status: true,
          deliveryStatus: true,
          deliveryMessage: true,
          createdAt: true,
          deliveredAt: true,
          bundle: {
            select: {
              name: true,
              network: true,
              dataSize: true,
              sellingPrice: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count({ where: filter })
    ]);

    console.log(`Found ${orders.length} orders for user ${userId}`);
    console.log('===============================');

    const paymentHistory = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      bundleName: order.bundle.name,
      network: order.bundle.network,
      dataSize: order.bundle.dataSize,
      amount: order.amount,
      phoneNumber: order.phoneNumber,
      paymentStatus: order.paymentStatus,
      paymentReference: order.paymentReference,
      orderStatus: order.status,
      deliveryStatus: order.deliveryStatus,
      deliveryMessage: order.deliveryMessage,
      date: order.createdAt,
      completedDate: order.deliveredAt
    }));

    res.json({
      success: true,
      data: {
        payments: paymentHistory,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
          hasNext: skip + parseInt(limit) < total
        }
      }
    });

  } catch (error) {
    console.error('Get payment history error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
};

exports.getPaymentDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!req.user || !req.user.id) {
      console.error('No authenticated user found in request');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user.id;

    console.log('===== PAYMENT DETAILS DEBUG =====');
    console.log('User ID:', userId);
    console.log('Order ID:', orderId);

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: userId
      },
      include: {
        bundle: true
      }
    });

    if (!order) {
      console.log('Order not found or does not belong to user');
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    console.log('Order found and belongs to user');
    console.log('===============================');

    res.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        bundleName: order.bundle.name,
        network: order.bundle.network,
        dataSize: order.bundle.dataSize,
        amount: order.amount,
        phoneNumber: order.phoneNumber,
        paymentStatus: order.paymentStatus,
        paymentReference: order.paymentReference,
        orderStatus: order.status,
        deliveryStatus: order.deliveryStatus,
        deliveryMessage: order.deliveryMessage,
        date: order.createdAt,
        deliveredAt: order.deliveredAt
      }
    });

  } catch (error) {
    console.error('Get payment details error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details'
    });
  }
};