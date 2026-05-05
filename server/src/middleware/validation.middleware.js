/**
 * Validation Middleware Factory
 * Creates middleware functions for validating different request parts against Joi schemas
 */

import { validateData, createValidationError } from "../utils/validationSchemas.js";

/**
 * Create a validation middleware for request body
 * @param {Object} schema - Joi schema for validation
 * @returns {Function} Express middleware
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = validateData(req.body, schema);

    if (error) {
      const errors = createValidationError(error.details);
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    // Replace body with validated data (automatically converts and trims)
    req.body = value;
    next();
  };
};

/**
 * Create a validation middleware for query parameters
 * @param {Object} schema - Joi schema for validation
 * @returns {Function} Express middleware
 */
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = validateData(req.query, schema);

    if (error) {
      const errors = createValidationError(error.details);
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    // Replace query with validated data
    req.query = value;
    next();
  };
};

/**
 * Create a validation middleware for route parameters
 * @param {Object} schema - Joi schema for validation
 * @returns {Function} Express middleware
 */
export const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = validateData(req.params, schema);

    if (error) {
      const errors = createValidationError(error.details);
      return res.status(400).json({
        message: "Validation failed",
        errors
      });
    }

    // Replace params with validated data
    req.params = value;
    next();
  };
};

/**
 * Combine multiple validation middleware
 * @param {...Function} validators - Validation middleware functions
 * @returns {Array} Array of middleware functions
 */
export const combineValidators = (...validators) => {
  return validators.filter((v) => v !== undefined && v !== null);
};
