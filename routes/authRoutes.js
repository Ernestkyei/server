const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { validate, registerSchema, loginSchema } = require('../middlewares/validate');

console.log('✅ Auth routes loaded');
console.log('   - POST /register');
console.log('   - POST /login');
console.log('   - POST /refresh-token');  // ← Verify this appears

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh-token', authController.refreshToken);

router.get('/me', authMiddleware.protect, authController.getMe);
router.post('/logout', authMiddleware.protect, authController.logout);

module.exports = router;
