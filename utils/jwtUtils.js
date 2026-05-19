
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

exports.generateToken = (userId, email, role) => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

exports.generateRefreshToken = (userId, email) => {
  return jwt.sign({ userId, email, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
};

exports.verifyToken = (token, expectedType = null) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (expectedType && decoded.type !== expectedType) {
      return { valid: false, error: `Expected ${expectedType} token` };
    }
    return { valid: true, decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

exports.decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
};

exports.isTokenExpired = (token) => {
  const decoded = exports.decodeToken(token);
  if (!decoded) return true;
  return decoded.exp < Date.now() / 1000;
};