// services/remaDataMock.js
// MOCK SERVICE - Replace with real API when you get credentials
// To switch to real API: change the require path

const mockTransactions = new Map();
let requestCounter = 1;

// Helper to simulate network delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Mock: Get available bundles from provider
const getBundles = async () => {
  console.log('MOCK: Fetching bundles from RemaData...');
  await delay(500);
  
  return {
    success: true,
    data: {
      bundles: [
        { id: "MTN-1GB", name: "MTN 1GB", network: "MTN", dataSize: "1GB", costPrice: 3.50, sellingPrice: 4.30, validity: 30, inStock: true },
        { id: "MTN-2GB", name: "MTN 2GB", network: "MTN", dataSize: "2GB", costPrice: 6.00, sellingPrice: 8.00, validity: 30, inStock: true },
        { id: "MTN-5GB", name: "MTN 5GB", network: "MTN", dataSize: "5GB", costPrice: 12.00, sellingPrice: 15.00, validity: 30, inStock: true },
        { id: "MTN-10GB", name: "MTN 10GB", network: "MTN", dataSize: "10GB", costPrice: 20.00, sellingPrice: 25.00, validity: 30, inStock: true },
        { id: "MTN-20GB", name: "MTN 20GB", network: "MTN", dataSize: "20GB", costPrice: 35.00, sellingPrice: 45.00, validity: 30, inStock: true },
        { id: "VODAFONE-1GB", name: "Vodafone 1GB", network: "VODAFONE", dataSize: "1GB", costPrice: 3.80, sellingPrice: 4.50, validity: 30, inStock: true },
        { id: "VODAFONE-3GB", name: "Vodafone 3GB", network: "VODAFONE", dataSize: "3GB", costPrice: 9.00, sellingPrice: 12.00, validity: 30, inStock: true },
        { id: "VODAFONE-5GB", name: "Vodafone 5GB", network: "VODAFONE", dataSize: "5GB", costPrice: 14.00, sellingPrice: 18.00, validity: 30, inStock: true },
        { id: "AIRTELTIGO-1GB", name: "AirtelTigo 1GB", network: "AIRTELTIGO", dataSize: "1GB", costPrice: 3.20, sellingPrice: 3.99, validity: 30, inStock: true },
        { id: "AIRTELTIGO-3GB", name: "AirtelTigo 3GB", network: "AIRTELTIGO", dataSize: "3GB", costPrice: 8.00, sellingPrice: 10.00, validity: 30, inStock: true },
        { id: "AIRTELTIGO-5GB", name: "AirtelTigo 5GB", network: "AIRTELTIGO", dataSize: "5GB", costPrice: 12.00, sellingPrice: 14.99, validity: 30, inStock: true },
        { id: "GLO-1GB", name: "Glo 1GB", network: "GLO", dataSize: "1GB", costPrice: 3.20, sellingPrice: 4.00, validity: 30, inStock: true },
        { id: "GLO-3GB", name: "Glo 3GB", network: "GLO", dataSize: "3GB", costPrice: 8.50, sellingPrice: 11.00, validity: 30, inStock: true },
        { id: "GLO-5GB", name: "Glo 5GB", network: "GLO", dataSize: "5GB", costPrice: 12.50, sellingPrice: 16.00, validity: 30, inStock: true }
      ]
    }
  };
};

// Mock: Purchase data bundle - ALWAYS RETURNS DELIVERED
const purchaseBundle = async (bundleCode, phoneNumber, reference) => {
  console.log(`MOCK: Purchasing bundle ${bundleCode} for ${phoneNumber}`);
  console.log(`Order Reference: ${reference}`);
  await delay(1000);
  
  const requestId = `MOCK-${Date.now()}-${requestCounter++}`;
  // FORCE DELIVERED - NO RANDOM! Always return DELIVERED
  const status = 'DELIVERED';
  
  // Find bundle to get correct amount
  const bundles = await getBundles();
  const bundle = bundles.data.bundles.find(b => b.id === bundleCode);
  const amount = bundle ? bundle.costPrice : 10.00;
  
  const transaction = {
    requestId,
    bundleCode,
    phoneNumber,
    reference,
    status,
    amount,
    createdAt: new Date().toISOString(),
    message: 'Bundle delivered successfully'
  };
  
  mockTransactions.set(requestId, transaction);
  
  console.log(`MOCK: Bundle DELIVERED for ${phoneNumber}`);
  
  return {
    success: true,
    requestId,
    status: 'DELIVERED',
    message: 'Bundle delivered successfully',
    data: transaction
  };
};

// Mock: Check delivery status
const checkStatus = async (requestId) => {
  console.log(`MOCK: Checking status for ${requestId}`);
  await delay(300);
  
  const transaction = mockTransactions.get(requestId);
  
  if (!transaction) {
    return {
      success: false,
      error: 'Transaction not found'
    };
  }
  
  // Always return DELIVERED
  return {
    success: true,
    status: 'DELIVERED',
    data: transaction
  };
};

// Mock: Get account balance
const getBalance = async () => {
  console.log('MOCK: Fetching account balance...');
  await delay(300);
  
  return {
    success: true,
    data: {
      balance: 5000.00,
      currency: 'GHS',
      pending: 0.00,
      creditLimit: 1000.00
    }
  };
};

// Mock: Get transaction history
const getTransactions = async (limit = 10, offset = 0) => {
  console.log('MOCK: Fetching transaction history...');
  await delay(400);
  
  const transactions = Array.from(mockTransactions.values())
    .reverse()
    .slice(offset, offset + limit);
  
  return {
    success: true,
    data: {
      transactions,
      total: mockTransactions.size,
      limit,
      offset
    }
  };
};

// Helper: Format phone number to international format
const formatPhoneNumber = (phoneNumber) => {
  let cleaned = phoneNumber.replace(/\s+/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '233' + cleaned.substring(1);
  }
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
};

module.exports = {
  getBundles,
  purchaseBundle,
  checkStatus,
  getBalance,
  getTransactions,
  formatPhoneNumber
};