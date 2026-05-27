// TEMPORARY: Using mock data on Render
const getBundles = async () => {
  return {
    success: true,
    data: {
      bundles: [
        { id: "MTN-1GB", name: "MTN 1GB", network: "MTN", dataSize: "1GB", sellingPrice: 4.30, validity: 30, inStock: true },
        { id: "MTN-2GB", name: "MTN 2GB", network: "MTN", dataSize: "2GB", sellingPrice: 8.00, validity: 30, inStock: true },
        { id: "MTN-5GB", name: "MTN 5GB", network: "MTN", dataSize: "5GB", sellingPrice: 15.00, validity: 30, inStock: true },
        { id: "VODAFONE-1GB", name: "Vodafone 1GB", network: "VODAFONE", dataSize: "1GB", sellingPrice: 4.50, validity: 30, inStock: true },
        { id: "AIRTELTIGO-1GB", name: "AirtelTigo 1GB", network: "AIRTELTIGO", dataSize: "1GB", sellingPrice: 3.99, validity: 30, inStock: true },
        { id: "GLO-1GB", name: "Glo 1GB", network: "GLO", dataSize: "1GB", sellingPrice: 4.00, validity: 30, inStock: true }
      ]
    }
  };
};

const purchaseBundle = async (bundleCode, phoneNumber, reference) => {
  return {
    success: true,
    requestId: `MOCK-${Date.now()}`,
    status: 'DELIVERED',
    message: 'Bundle delivered successfully'
  };
};

const checkStatus = async (requestId) => {
  return { success: true, status: 'DELIVERED' };
};

const getBalance = async () => {
  return { success: true, data: { balance: 5000 } };
};

const getTransactions = async () => {
  return { success: true, data: { transactions: [] } };
};

const formatPhoneNumber = (phoneNumber) => {
  let cleaned = phoneNumber.replace(/\s+/g, '');
  if (cleaned.startsWith('0')) cleaned = '233' + cleaned.substring(1);
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  return cleaned;
};

export {
  getBundles,
  purchaseBundle,
  checkStatus,
  getBalance,
  getTransactions,
  formatPhoneNumber
};