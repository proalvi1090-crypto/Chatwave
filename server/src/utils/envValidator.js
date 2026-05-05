/**
 * Environment variable validation utilities
 * Ensures critical configuration is available and properly set
 */

/**
 * Validate that a required environment variable is set and not empty
 * @param {string} varName - Environment variable name
 * @param {string} description - Human-readable description of the variable
 * @throws {Error} If variable is not set or empty
 */
export const validateRequired = (varName, description) => {
  const value = process.env[varName];
  if (!value || typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `Missing critical environment variable: ${varName}. ${description} is required for application security.`
    );
  }
  return value.trim();
};

/**
 * Validate optional environment variable with fallback
 * @param {string} varName - Environment variable name
 * @param {string} fallback - Default value if not set
 * @returns {string} Environment variable value or fallback
 */
export const validateOptional = (varName, fallback = "") => {
  const value = process.env[varName];
  if (!value || typeof value !== "string") return fallback;
  return value.trim() || fallback;
};

/**
 * Escape special regex characters to prevent ReDoS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for use in regex patterns
 */
export const escapeRegex = (str) => {
  if (typeof str !== "string") return "";
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
};
