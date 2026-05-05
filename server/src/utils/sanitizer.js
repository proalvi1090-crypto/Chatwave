/**
 * NoSQL Injection Prevention and Input Sanitization
 * Provides comprehensive input sanitization to prevent NoSQL injection attacks
 */

import mongoSanitize from "mongo-sanitize";

/**
 * Deep clone and sanitize an object recursively
 * Removes any keys starting with $ or containing dangerous patterns
 * @param {any} obj - Object to sanitize
 * @returns {any} Sanitized object
 */
export const deepSanitize = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== "object") {
    if (typeof obj === "string") {
      // Remove any $ at the start of strings which could be operator injection
      return mongoSanitize(obj);
    }
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => deepSanitize(item));
  }

  // Handle objects
  const sanitized = {};
  for (const key in obj) {
    if (!Object.hasOwn(obj, key)) {
      continue;
    }

    // Reject keys starting with $ (MongoDB operators) or containing problematic patterns
    if (key.startsWith("$") || key.startsWith("__proto__") || key === "constructor") {
      console.warn(`Blocked suspicious key: ${key}`); // NOSONAR
      continue;
    }

    // Recursively sanitize the value
    sanitized[key] = deepSanitize(obj[key]);
  }

  return sanitized;
};



/**
 * Sanitize query object (req.query)
 * @param {Object} query - Query parameters
 * @returns {Object} Sanitized query
 */
export const sanitizeQuery = (query) => {
  return deepSanitize(query);
};

/**
 * Sanitize request body (req.body)
 * @param {Object} body - Request body
 * @returns {Object} Sanitized body
 */
export const sanitizeBody = (body) => {
  return deepSanitize(body);
};

/**
 * Sanitize request params (req.params)
 * @param {Object} params - Route parameters
 * @returns {Object} Sanitized params
 */
export const sanitizeParams = (params) => {
  return deepSanitize(params);
};

/**
 * Check if object contains potentially dangerous patterns
 * @param {Object} obj - Object to check
 * @returns {boolean} True if potentially dangerous
 */
export const hasDangerousPatterns = (obj) => {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  for (const key in obj) {
    if (!Object.hasOwn(obj, key)) {
      continue;
    }

    // Check for $ operators
    if (key.startsWith("$")) {
      return true;
    }

    // Recursively check nested objects
    if (typeof obj[key] === "object" && obj[key] !== null) {
      if (hasDangerousPatterns(obj[key])) {
        return true;
      }
    }

    // Check string values for operator injection
    if (typeof obj[key] === "string" && obj[key].startsWith("$")) {
      return true;
    }
  }

  return false;
};



/**
 * Create a sanitization middleware for Express
 * Applies sanitization to req.body, req.query, and req.params
 * @returns {Function} Express middleware
 */
export const sanitizationMiddleware = () => {
  return (req, res, next) => {
    // Only sanitize requests with data
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeBody(req.body);
    }

    if (req.query && typeof req.query === "object") {
      req.query = sanitizeQuery(req.query);
    }

    if (req.params && typeof req.params === "object") {
      req.params = sanitizeParams(req.params);
    }

    next();
  };
};
