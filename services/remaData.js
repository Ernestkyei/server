// Auto-switch between Mock and Real API
const isProduction = import.meta.env.PROD;
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

let service;

if (!isProduction && USE_MOCK) {
  // Local development with mock data
  console.log('📦 Using MOCK data service');
  service = require('./remaDataMock');
} else {
  // Production on Render OR local with real API
  console.log('🌐 Using REAL API service');
  service = require('./remaDataAPI');
}

export const getBundles = service.getBundles;
export const purchaseBundle = service.purchaseBundle;
export const checkStatus = service.checkStatus;
export const getBalance = service.getBalance;
export const getTransactions = service.getTransactions;
export const formatPhoneNumber = service.formatPhoneNumber;