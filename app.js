// app.js
const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

dotenv.config();

// Import all routes
const authRoutes = require('./routes/authRoutes');
const bundleRoutes = require('./routes/bundleRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',     // Client frontend
  'http://localhost:4000',     // Admin frontend
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
].filter(Boolean);

// Security middleware
app.use(helmet());

// CORS configuration - allow multiple origins
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.'
  },
  skipSuccessfulRequests: true,
});

// Admin API rate limiter (stricter)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: 'Too many admin requests. Please try again after 15 minutes.'
  },
  skipSuccessfulRequests: true,
});

app.use(globalLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// ==================== ROUTES ====================

// Health check (no rate limit)
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Data Bundle Marketplace API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    allowedOrigins: allowedOrigins,
    endpoints: {
      auth: '/api/auth',
      bundles: '/api/bundles',
      orders: '/api/orders',
      admin: '/api/admin'
    }
  });
});

// Auth routes (public + protected with stricter rate limit)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);

// Bundle routes (public)
app.use('/api/bundles', bundleRoutes);

// Order routes (public - guest checkout)
app.use('/api/orders', orderRoutes);

// Admin routes (protected - admin only with stricter rate limit)
app.use('/api/admin', adminLimiter);
app.use('/api/admin', adminRoutes);

// ==================== ERROR HANDLERS ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.url} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error(err.stack);
  
  // Handle specific error types
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

module.exports = app;