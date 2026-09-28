const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/jwt');

/**
 * authenticate — verifies the JWT from the Authorization header and loads
 * the user from the database. The request's identity ALWAYS comes from the
 * verified token + database record, never from client-sent fields.
 */
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication required', 'NO_TOKEN');
    }

    const token = header.split(' ')[1];

    if (!token) {
      throw ApiError.unauthorized('Authentication required', 'NO_TOKEN');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Session expired, please login again', 'TOKEN_EXPIRED');
      }
      throw ApiError.unauthorized('Invalid authentication token', 'INVALID_TOKEN');
    }

    // Re-load user from DB so deactivated users lose access immediately
    const user = await User.findById(decoded.id);

    if (!user) {
      throw ApiError.unauthorized('User no longer exists', 'USER_NOT_FOUND');
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden('Account is deactivated', 'ACCOUNT_INACTIVE');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * authorize — restricts a route to specific roles.
 * Usage: router.get('/route', authenticate, authorize('VP', 'ADMIN'), handler)
 */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required', 'NO_TOKEN'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden('You do not have permission to access this resource', 'FORBIDDEN')
      );
    }

    return next();
  };

module.exports = { authenticate, authorize };
