/**
 * Response helpers for consistent API responses
 * Centralizes error and success response formatting
 */

import { HTTP_STATUS } from "./constants.js";

/**
 * Send standardized error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @param {any} options.error - Error details (development only)
 * @param {any} options.data - Additional data to send
 */
export const sendErrorResponse = (res, statusCode, message, options = {}) => {
  const response = { message };

  if (options.data) {
    Object.assign(response, options.data);
  }

  if (process.env.NODE_ENV === "development" && options.error) {
    response.error = options.error instanceof Error ? options.error.message : options.error;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send standardized success response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {any} data - Response data
 * @param {string} message - Optional success message
 */
export const sendSuccessResponse = (res, statusCode = HTTP_STATUS.OK, data = null, message = null) => {
  const response = message ? { message, data } : data;
  return res.status(statusCode).json(response);
};

/**
 * Send bad request error (400)
 */
export const sendBadRequest = (res, message, options = {}) =>
  sendErrorResponse(res, HTTP_STATUS.BAD_REQUEST, message, options);

/**
 * Send unauthorized error (401)
 */
export const sendUnauthorized = (res, message, options = {}) =>
  sendErrorResponse(res, HTTP_STATUS.UNAUTHORIZED, message, options);

/**
 * Send forbidden error (403)
 */
export const sendForbidden = (res, message, options = {}) =>
  sendErrorResponse(res, HTTP_STATUS.FORBIDDEN, message, options);

/**
 * Send not found error (404)
 */
export const sendNotFound = (res, message, options = {}) =>
  sendErrorResponse(res, HTTP_STATUS.NOT_FOUND, message, options);

/**
 * Send conflict error (409)
 */
export const sendConflict = (res, message, options = {}) =>
  sendErrorResponse(res, HTTP_STATUS.CONFLICT, message, options);

/**
 * Send internal server error (500)
 */
export const sendInternalError = (res, message, options = {}) =>
  sendErrorResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message, options);


/**
 * Generic catch handler for logging errors
 * @param {Error} err - Error object
 * @param {Object} res - Express response object
 * @param {string} context - Context for error logging (e.g., function name)
 */
export const handleCatchError = (err, res, context = "Operation") => {
  // eslint-disable-next-line no-console
  console.error(`${context} error:`, err); // NOSONAR

  const errorResponse = {
    message: err.message || "Something went wrong"
  };

  if (process.env.NODE_ENV === "development") {
    errorResponse.error = err.message;
    errorResponse.stack = err.stack;
  }

  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
};
