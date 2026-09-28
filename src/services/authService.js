const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/jwt');

/**
 * Authenticate a user with email + password.
 * Returns a JWT and the safe (password-free) user object.
 * Uses identical error messages for unknown email vs wrong password
 * to avoid user enumeration.
 */
const login = async (email, password) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden('Account is deactivated. Contact an administrator.', 'ACCOUNT_INACTIVE');
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Record last login (fire-and-forget; never blocks the response)
  user.lastLogin = new Date();
  user.save().catch((err) => console.error('[auth] Failed to update lastLogin:', err.message));

  const token = signToken(user);

  return { user, token };
};

/**
 * Return the safe user object for the currently authenticated user.
 */
const getMe = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }

  return user;
};

module.exports = { login, getMe };
