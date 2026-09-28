/**
 * Consistent API response shapes.
 *
 * Success: { success: true, message, data }
 * Error:   { success: false, message, errorCode }
 */

const success = (res, message, data = {}, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const error = (res, message, errorCode = 'INTERNAL_ERROR', statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    message,
    errorCode,
  });
};

module.exports = { success, error };
