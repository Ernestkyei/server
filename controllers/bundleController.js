// controllers/bundleController.js
const bundleService = require('../services/bundleService');

// Get all active bundles (for customers)
exports.getAllBundles = async (req, res) => {
  try {
    const { network } = req.query;
    const bundles = await bundleService.getAllBundles(network);
    
    res.json({
      success: true,
      count: bundles.length,
      data: bundles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single bundle by ID
exports.getBundleById = async (req, res) => {
  try {
    const { id } = req.params;
    const bundle = await bundleService.getBundleById(id);
    
    res.json({
      success: true,
      data: bundle
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

// Get bundles by network
exports.getBundlesByNetwork = async (req, res) => {
  try {
    const { network } = req.params;
    const bundles = await bundleService.getBundlesByNetwork(network);
    
    res.json({
      success: true,
      count: bundles.length,
      data: bundles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};