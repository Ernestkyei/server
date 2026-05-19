const remaData = require('../services/remaDataMock');
const prisma = require('../config/database');
const orderService = require('../services/orderService');

// ==================== PROVIDER SYNC ====================

exports.syncBundlesFromProvider = async (req, res) => {
  try {
    const result = await remaData.getBundles();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch bundles from provider'
      });
    }
    
    res.json({
      success: true,
      message: 'Bundles fetched successfully',
      data: result.data.bundles
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.importBundles = async (req, res) => {
  try {
    const { bundles } = req.body;
    
    const importedBundles = [];
    
    for (const bundle of bundles) {
      const existing = await prisma.bundle.findFirst({
        where: { providerCode: bundle.id }
      });
      
      if (!existing) {
        const newBundle = await prisma.bundle.create({
          data: {
            name: bundle.name,
            network: bundle.network,
            dataSize: bundle.dataSize,
            costPrice: bundle.costPrice,
            sellingPrice: bundle.sellingPrice,
            provider: 'RemaData',
            providerCode: bundle.id,
            validity: bundle.validity || 30,
            stock: 100,
            isActive: true
          }
        });
        importedBundles.push(newBundle);
      }
    }
    
    res.json({
      success: true,
      message: `Imported ${importedBundles.length} bundles`,
      data: importedBundles
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getProviderBalance = async (req, res) => {
  try {
    const balance = await remaData.getBalance();
    
    res.json({
      success: true,
      data: balance.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getProviderTransactions = async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    const transactions = await remaData.getTransactions(parseInt(limit), parseInt(offset));
    
    res.json({
      success: true,
      data: transactions.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== BUNDLE MANAGEMENT ====================

exports.getAllBundles = async (req, res) => {
  try {
    const bundles = await prisma.bundle.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    const bundlesWithProfit = bundles.map(bundle => ({
      ...bundle,
      profitPerUnit: bundle.sellingPrice - bundle.costPrice,
      profitMargin: ((bundle.sellingPrice - bundle.costPrice) / bundle.sellingPrice * 100).toFixed(2)
    }));
    
    res.json({
      success: true,
      count: bundles.length,
      data: bundlesWithProfit
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateBundlePricing = async (req, res) => {
  try {
    const { id } = req.params;
    const { costPrice, sellingPrice, stock } = req.body;
    
    const updatedBundle = await prisma.bundle.update({
      where: { id },
      data: {
        costPrice: costPrice || undefined,
        sellingPrice: sellingPrice || undefined,
        stock: stock !== undefined ? stock : undefined
      }
    });
    
    res.json({
      success: true,
      message: 'Bundle pricing updated',
      data: updatedBundle
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== ORDER MANAGEMENT ====================

exports.getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const result = await orderService.getAllOrders(status, parseInt(page), parseInt(limit));
    
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

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, deliveryStatus } = req.body;
    
    const order = await orderService.updateOrderStatus(orderId, status, deliveryStatus);
    
    res.json({
      success: true,
      message: 'Order status updated',
      data: order
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.retryDelivery = async (req, res) => {
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
    
    await orderService.deliverDataToProvider(order);
    
    res.json({
      success: true,
      message: 'Delivery retry initiated'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== DASHBOARD STATS ====================

exports.getDashboardStats = async (req, res) => {
  try {
    const [totalUsers, totalOrders, completedOrders, totalRevenue, totalBundles, lowStockBundles] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.aggregate({ _sum: { amount: true }, where: { status: 'COMPLETED' } }),
      prisma.bundle.count({ where: { isActive: true } }),
      prisma.bundle.count({ where: { stock: { lt: 10 }, isActive: true } })
    ]);
    
    const completedOrdersWithBundles = await prisma.order.findMany({
      where: { status: 'COMPLETED' },
      include: { bundle: true }
    });
    
    const totalProfit = completedOrdersWithBundles.reduce((sum, order) => {
      return sum + (order.amount - order.bundle.costPrice);
    }, 0);
    
    res.json({
      success: true,
      data: {
        totalUsers,
        totalOrders,
        completedOrders,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalProfit,
        totalBundles,
        lowStockBundles
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getOrderStats = async (req, res) => {
  try {
    const stats = await orderService.getOrderStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
