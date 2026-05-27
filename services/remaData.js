// Auto-switch between Mock and Real API
// TEMPORARILY FORCE MOCK ON RENDER
const FORCE_MOCK = true;  

let service;

if (FORCE_MOCK) {
  console.log('📦 FORCING MOCK data service');
  service = require('./remaDataMock');
} else {
  console.log('🌐 Using REAL API service');
  service = require('./remaDataAPI');
}

export const getBundles = service.getBundles;
export const purchaseBundle = service.purchaseBundle;
export const checkStatus = service.checkStatus;
export const getBalance = service.getBalance;
export const getTransactions = service.getTransactions;
export const formatPhoneNumber = service.formatPhoneNumber;