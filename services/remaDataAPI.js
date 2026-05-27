// REAL API Service - Connects to your Render backend
const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.error('❌ VITE_API_URL environment variable is not set!');
  throw new Error('VITE_API_URL environment variable is not set!');
}

console.log(`🌐 API Service initialized with URL: ${API_URL}`);

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

// Get bundles from your database
const getBundles = async () => {
  try {
    console.log('Fetching bundles from API...');
    const response = await fetch(`${API_URL}/api/bundles`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API Response:', data);
    
    if (data.success && data.data) {
      // Transform database format to match frontend expected format
      const transformedBundles = data.data.map(bundle => ({
        id: `${bundle.network || 'DATA'}-${bundle.data}`,
        name: bundle.name || `${bundle.network || 'Data'} ${bundle.data}`,
        network: bundle.network || 'MTN',
        dataSize: bundle.data,
        costPrice: bundle.price * 0.8, // Estimated cost price (80% of selling price)
        sellingPrice: bundle.price,
        validity: bundle.validity || 30,
        inStock: (bundle.stock || 0) > 0
      }));
      
      return {
        success: true,
        data: {
          bundles: transformedBundles
        }
      };
    }
    
    return { success: false, error: 'No bundles found in database' };
  } catch (error) {
    console.error('API Error (getBundles):', error);
    return { success: false, error: error.message };
  }
};

// Purchase a bundle
const purchaseBundle = async (bundleCode, phoneNumber, reference) => {
  try {
    console.log(`Purchasing bundle ${bundleCode} for ${phoneNumber}`);
    
    const response = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bundleId: bundleCode,
        phoneNumber: formatPhoneNumber(phoneNumber),
        reference: reference || `ORDER-${Date.now()}`
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Purchase response:', data);
    
    return {
      success: data.success || true,
      requestId: data.orderId || data.id,
      status: data.status || 'PENDING',
      message: data.message || 'Order created successfully',
      data: data
    };
  } catch (error) {
    console.error('API Error (purchaseBundle):', error);
    return { 
      success: false, 
      error: error.message,
      status: 'FAILED'
    };
  }
};

// Check delivery status
const checkStatus = async (requestId) => {
  try {
    console.log(`Checking status for order: ${requestId}`);
    
    const response = await fetch(`${API_URL}/api/orders/${requestId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      status: data.status || 'UNKNOWN',
      data: data.data || data
    };
  } catch (error) {
    console.error('API Error (checkStatus):', error);
    return { success: false, error: error.message };
  }
};

// Get account balance (if admin endpoint exists)
const getBalance = async () => {
  try {
    console.log('Fetching account balance...');
    
    // Try to get from admin endpoint
    const response = await fetch(`${API_URL}/api/admin/balance`);
    
    if (!response.ok) {
      // If endpoint doesn't exist, return mock balance
      return {
        success: true,
        data: {
          balance: 0,
          currency: 'GHS',
          message: 'Balance endpoint not configured yet'
        }
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      data: {
        balance: data.balance || 0,
        currency: data.currency || 'GHS',
        pending: data.pending || 0
      }
    };
  } catch (error) {
    console.error('API Error (getBalance):', error);
    return { 
      success: true, 
      data: { balance: 0, message: 'Balance API not implemented' } 
    };
  }
};

// Get transaction history
const getTransactions = async (limit = 10, offset = 0) => {
  try {
    console.log(`Fetching transactions (limit: ${limit}, offset: ${offset})...`);
    
    const response = await fetch(`${API_URL}/api/orders?limit=${limit}&offset=${offset}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data: {
        transactions: data.data || [],
        total: data.total || 0,
        limit,
        offset
      }
    };
  } catch (error) {
    console.error('API Error (getTransactions):', error);
    return { 
      success: true, 
      data: { transactions: [], total: 0 } 
    };
  }
};

// Export all functions
export {
  getBundles,
  purchaseBundle,
  checkStatus,
  getBalance,
  getTransactions,
  formatPhoneNumber
};