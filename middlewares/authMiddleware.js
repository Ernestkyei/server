const jwtUtils = require('../utils/jwtUtils');

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Please login first.'
      });
    }

    const { valid, decoded, error } = jwtUtils.verifyToken(token);

    if (!valid) {
      let message = 'Invalid token';
      if (error && error.includes('jwt expired')) {
        message = 'Token expired. Please login again.';
      }
      return res.status(401).json({
        success: false,
        message
      });
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload. Please login again.'
      });
    }

    // CHANGE: Set req.user with 'id' instead of 'userId'
    req.user = {
      id: decoded.userId,      // ← CHANGE THIS
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.'
    });
  }
};

exports.adminOnly = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }
    next();
  } catch (err) {
    console.error('Admin middleware error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Authorization error. Please try again.'
    });
  }
};