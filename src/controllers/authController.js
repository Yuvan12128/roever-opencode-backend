const { validationResult } = require('express-validator');
const authService = require('../services/authService');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/response');

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest(errors.array()[0].msg, 'VALIDATION_ERROR');
    }

    const { email, password } = req.body;
    const { user, token } = await authService.login(email, password);

    success(res, 'Login successful', { user, token });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user._id);
    success(res, 'Current user retrieved', { user });
  } catch (err) {
    next(err);
  }
};

/**
 * JWTs are stateless, so logout is primarily a client-side action
 * (discard the token). This endpoint exists so the client has a clean
 * contract to call; it also gives us a hook for future server-side
 * token revocation if that requirement is introduced later.
 */
const logout = async (req, res, next) => {
  try {
    success(res, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { login, me, logout };
