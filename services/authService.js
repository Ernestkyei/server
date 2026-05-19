const prisma = require('../config/database');
const bcrypt = require('bcryptjs');
const jwtUtils = require('../utils/jwtUtils');
const notificationService = require('./notificationService');

exports.hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

exports.comparePassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

exports.register = async (userData) => {
  const { email, password, name } = userData;
  
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });
  
  if (existingUser) {
    throw new Error('User already exists with this email');
  }
  
  const hashedPassword = await exports.hashPassword(password);
  
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: 'USER'
    }
  });
  
  await notificationService.welcomeNewUser(user);
  
  const accessToken = jwtUtils.generateToken(user.id, user.email, user.role);
  const refreshToken = jwtUtils.generateRefreshToken(user.id, user.email);
  
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    },
    accessToken,
    refreshToken
  };
};

exports.login = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email }
  });
  
  if (!user) {
    throw new Error('Invalid email or password');
  }
  
  const isPasswordValid = await exports.comparePassword(password, user.password);
  
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }
  
  const accessToken = jwtUtils.generateToken(user.id, user.email, user.role);
  const refreshToken = jwtUtils.generateRefreshToken(user.id, user.email);
  
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    accessToken,
    refreshToken
  };
};

exports.refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new Error('Refresh token required');
  }
  
  const { valid, decoded, error } = jwtUtils.verifyToken(refreshToken);
  
  if (!valid) {
    throw new Error(error === 'jwt expired' ? 'Refresh token expired. Please login again.' : 'Invalid refresh token');
  }
  
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  
  const newAccessToken = jwtUtils.generateToken(decoded.userId, decoded.email, decoded.role);
  
  return { accessToken: newAccessToken };
};

exports.logout = async () => {
  return { success: true, message: 'Logged out successfully' };
};

exports.getUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      orders: {
        take: 5,
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  return user;
};

exports.getUserByEmail = async (email) => {
  return await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  });
};

exports.updateUser = async (userId, updateData) => {
  const { name, password } = updateData;
  
  const data = {};
  if (name) data.name = name;
  if (password) {
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    data.password = await exports.hashPassword(password);
  }
  
  if (Object.keys(data).length === 0) {
    throw new Error('No valid fields provided for update');
  }
  
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  });
  
  return updatedUser;
};

exports.deleteUser = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  await prisma.user.delete({
    where: { id: userId }
  });
  
  return { success: true, message: 'User deleted successfully' };
};

exports.getAllUsers = async (page = 1, limit = 10, search = '') => {
  const skip = (page - 1) * limit;
  
  const where = search ? {
    OR: [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } }
    ]
  } : {};
  
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            orders: true
          }
        }
      }
    }),
    prisma.user.count({ where })
  ]);
  
  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

exports.updateUserRole = async (userId, role) => {
  const validRoles = ['USER', 'ADMIN'];
  if (!validRoles.includes(role)) {
    throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }
  
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  });
  
  return updatedUser;
};

exports.getUserStats = async () => {
  const [totalUsers, adminCount, userCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { role: 'USER' } })
  ]);
  
  return {
    totalUsers,
    adminCount,
    userCount
  };
};
