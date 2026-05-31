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
    const { costPrice, sellingPrice } = req.body;
    
    const updatedBundle = await prisma.bundle.update({
      where: { id },
      data: {
        costPrice: costPrice || undefined,
        sellingPrice: sellingPrice || undefined
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

exports.updateBundleStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;
    
    const updatedBundle = await prisma.bundle.update({
      where: { id },
      data: { stock }
    });
    
    res.json({
      success: true,
      message: 'Bundle stock updated',
      data: updatedBundle
    });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bundle stock'
    });
  }
};

exports.toggleBundleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    const updatedBundle = await prisma.bundle.update({
      where: { id },
      data: { isActive }
    });
    
    res.json({
      success: true,
      message: `Bundle ${isActive ? 'enabled' : 'disabled'} successfully`,
      data: updatedBundle
    });
  } catch (error) {
    console.error('Toggle bundle status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bundle status'
    });
  }
};

exports.createBundle = async (req, res) => {
  try {
    const bundleData = req.body;
    
    const newBundle = await prisma.bundle.create({
      data: {
        name: bundleData.name,
        network: bundleData.network,
        dataSize: bundleData.dataSize,
        costPrice: bundleData.costPrice,
        sellingPrice: bundleData.sellingPrice,
        stock: bundleData.stock || 0,
        isActive: true,
        provider: 'Manual',
        providerCode: `MANUAL-${Date.now()}`
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Bundle created successfully',
      data: newBundle
    });
  } catch (error) {
    console.error('Create bundle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bundle'
    });
  }
};

exports.deleteBundle = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.bundle.delete({
      where: { id }
    });
    
    res.json({
      success: true,
      message: 'Bundle deleted successfully'
    });
  } catch (error) {
    console.error('Delete bundle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete bundle'
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

// ==================== USER MANAGEMENT (FIXED) ====================

exports.getAllUsers = async (req, res) => {
  try {
    console.log('Fetching all users...');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { orders: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const totalSpentResult = await prisma.order.aggregate({
        where: { 
          userId: user.id,
          paymentStatus: 'PAID'
        },
        _sum: { amount: true }
      });
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: 'N/A',
        role: user.role,
        status: user.isActive ? 'active' : 'inactive',
        orders: user._count.orders,
        totalSpent: totalSpentResult._sum.amount || 0,
        joined: user.createdAt
      };
    }));
    
    res.json({
      success: true,
      data: usersWithStats
    });
    
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { bundle: true }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const orderCount = await prisma.order.count({
      where: { userId: id }
    });
    
    const totalSpentResult = await prisma.order.aggregate({
      where: { 
        userId: id,
        paymentStatus: 'PAID'
      },
      _sum: { amount: true }
    });
    
    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phoneNumber || 'N/A',
        role: user.role,
        status: user.isActive ? 'active' : 'inactive',
        orders: user.orders,
        orderCount: orderCount,
        totalSpent: totalSpentResult._sum.amount || 0,
        joined: user.createdAt
      }
    });
    
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const isActive = status === 'active';
    
    const user = await prisma.user.update({
      where: { id },
      data: { isActive }
    });
    
    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: user.id,
        status: user.isActive ? 'active' : 'inactive'
      }
    });
    
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.order.deleteMany({
      where: { userId: id }
    });
    
    await prisma.user.delete({
      where: { id }
    });
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

// ==================== SETTINGS MANAGEMENT ====================

exports.getGeneralSettings = async (req, res) => {
  try {
    let settings = await prisma.settings.findFirst();
    
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          profitMargin: 20,
          lowStockAlert: 10,
          currency: 'GHS'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        profitMargin: settings.profitMargin,
        lowStockAlert: settings.lowStockAlert,
        currency: settings.currency
      }
    });
  } catch (error) {
    console.error('Get general settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
};

exports.updateGeneralSettings = async (req, res) => {
  try {
    const { profitMargin, lowStockAlert, currency } = req.body;
    
    let settings = await prisma.settings.findFirst();
    
    if (!settings) {
      settings = await prisma.settings.create({
        data: { profitMargin, lowStockAlert, currency }
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: { profitMargin, lowStockAlert, currency }
      });
    }
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Update general settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
};

exports.getApiKeys = async (req, res) => {
  try {
    let apiKeys = await prisma.apiKeys.findFirst();
    
    if (!apiKeys) {
      apiKeys = await prisma.apiKeys.create({
        data: {
          remaDataKey: '',
          remaDataUrl: 'https://api.remadata.com/v1',
          africaTalkingKey: '',
          africaTalkingUsername: ''
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        remaData: {
          apiKey: apiKeys.remaDataKey ? '•••••••••••••••••' : '',
          baseUrl: apiKeys.remaDataUrl
        },
        africaTalking: {
          apiKey: apiKeys.africaTalkingKey ? '•••••••••••••••••' : '',
          username: apiKeys.africaTalkingUsername
        }
      }
    });
  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch API keys'
    });
  }
};

exports.updateApiKeys = async (req, res) => {
  try {
    const { provider, apiKey, username, baseUrl } = req.body;
    
    let apiKeys = await prisma.apiKeys.findFirst();
    
    if (!apiKeys) {
      apiKeys = await prisma.apiKeys.create({ data: {} });
    }
    
    const updateData = {};
    if (provider === 'remaData') {
      updateData.remaDataKey = apiKey;
      if (baseUrl) updateData.remaDataUrl = baseUrl;
    } else if (provider === 'africaTalking') {
      updateData.africaTalkingKey = apiKey;
      if (username) updateData.africaTalkingUsername = username;
    }
    
    const updated = await prisma.apiKeys.update({
      where: { id: apiKeys.id },
      data: updateData
    });
    
    res.json({
      success: true,
      message: 'API keys updated successfully'
    });
  } catch (error) {
    console.error('Update API keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update API keys'
    });
  }
};