// services/bundleService.js
const prisma = require('../config/database');

// Get all active bundles (for customers)
exports.getAllBundles = async (network = null) => {
  const where = { isActive: true };
  if (network) {
    where.network = network;
  }
  
  const bundles = await prisma.bundle.findMany({
    where,
    select: {
      id: true,
      name: true,
      network: true,
      dataSize: true,
      sellingPrice: true,
      description: true
    },
    orderBy: [
      { network: 'asc' },
      { sellingPrice: 'asc' }
    ]
  });
  
  return bundles;
};

// Get single bundle by ID
exports.getBundleById = async (id) => {
  const bundle = await prisma.bundle.findUnique({
    where: { id, isActive: true },
    select: {
      id: true,
      name: true,
      network: true,
      dataSize: true,
      sellingPrice: true,
      description: true
    }
  });
  
  if (!bundle) {
    throw new Error('Bundle not found');
  }
  
  return bundle;
};

// Get bundles by network
exports.getBundlesByNetwork = async (network) => {
  const bundles = await prisma.bundle.findMany({
    where: {
      network: network.toUpperCase(),
      isActive: true
    },
    select: {
      id: true,
      name: true,
      dataSize: true,
      sellingPrice: true,
      description: true
    },
    orderBy: { sellingPrice: 'asc' }
  });
  
  return bundles;
};

// Get bundle with cost price (for admin only)
exports.getBundleWithCost = async (id) => {
  const bundle = await prisma.bundle.findUnique({
    where: { id }
  });
  
  if (!bundle) {
    throw new Error('Bundle not found');
  }
  
  return bundle;
};

// Check if bundle exists and is active
exports.checkBundleAvailability = async (bundleId) => {
  const bundle = await prisma.bundle.findUnique({
    where: { id: bundleId, isActive: true }
  });
  
  if (!bundle) {
    throw new Error('Bundle not available');
  }
  
  if (bundle.stock <= 0) {
    throw new Error('Bundle out of stock');
  }
  
  return bundle;
};

// Update bundle stock (when someone buys)
exports.decrementStock = async (bundleId, quantity = 1) => {
  const bundle = await prisma.bundle.update({
    where: { id: bundleId },
    data: { stock: { decrement: quantity } }
  });
  
  return bundle;
};