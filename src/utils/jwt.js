const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Sign a JWT containing only the minimum claims needed for authorization.
 * The authenticate middleware re-loads the user from the database on every
 * request, so role/status changes take effect immediately and the token
 * never carries sensitive data.
 */
const signToken = (user) =>
  jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

const verifyToken = (token) => jwt.verify(token, config.jwt.secret);

module.exports = { signToken, verifyToken };
