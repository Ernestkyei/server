const { z } = require('zod');

// ==================== USER SCHEMAS ====================

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

// ==================== ORDER SCHEMAS ====================

const orderSchema = z.object({
  bundleId: z.string().uuid('Invalid bundle ID'),
  phoneNumber: z.string().regex(/^0[0-9]{9}$/, 'Phone number must be 10 digits starting with 0')
  // amount is NOT required - it comes from the bundle
});

// ==================== BUNDLE SCHEMAS ====================

const createBundleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  network: z.enum(['MTN', 'VODAFONE', 'AIRTELTIGO', 'GLO']),
  dataSize: z.string().min(1, 'Data size is required'),
  costPrice: z.number().positive('Cost price must be positive'),
  sellingPrice: z.number().positive('Selling price must be positive'),
  provider: z.string().min(1, 'Provider is required'),
  providerCode: z.string().min(1, 'Provider code is required'),
  stock: z.number().int().min(0).default(0),
  description: z.string().optional()
});

const updateBundlePricingSchema = z.object({
  costPrice: z.number().positive().optional(),
  sellingPrice: z.number().positive().optional(),
  stock: z.number().int().min(0).optional()
});

const importBundlesSchema = z.object({
  bundles: z.array(z.object({
    id: z.string(),
    name: z.string(),
    network: z.string(),
    dataSize: z.string(),
    costPrice: z.number(),
    sellingPrice: z.number()
  }))
});

const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
  search: z.string().optional()
});

// ==================== VALIDATION MIDDLEWARE ====================

const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    req.body = result.data;
    next();
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors
      });
    }
    
    req.query = result.data;
    next();
  };
};

module.exports = {
  validate,
  validateQuery,
  registerSchema,
  loginSchema,
  orderSchema,
  createBundleSchema,
  updateBundlePricingSchema,
  importBundlesSchema,
  paginationSchema
};
