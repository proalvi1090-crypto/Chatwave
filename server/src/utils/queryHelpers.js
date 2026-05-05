/**
 * Query parameter validation and parsing helpers
 * Centralizes common query parameter extraction logic
 */

import { ERROR_MESSAGES, MESSAGE_TYPES } from "./constants.js";
import { escapeRegex } from "./envValidator.js";

/**
 * Safely extract and trim query parameter
 * @param {Object} query - Query object from request
 * @param {string} key - Parameter key
 * @param {string} defaultValue - Default value if not present
 * @returns {string} Trimmed query value or default
 */
export const getQueryParam = (query, key, defaultValue = "") => {
  const value = query[key];
  if (!value) return defaultValue;
  return typeof value === "string" ? value.trim() : String(value).trim();
};

/**
 * Parse date boundary for range queries
 * @param {string} value - Date string (YYYY-MM-DD or ISO format)
 * @param {string} boundary - "start" or "end" to set time portion
 * @returns {Date|null} Parsed date or null if invalid
 */
export const parseDateBoundary = (value, boundary = "start") => {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const hasTime = raw.includes("T");
  let dateString = raw;
  if (!hasTime) {
    const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
    dateString = `${raw}${suffix}`;
  }

  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Build date filter for MongoDB queries
 * @param {string} fromDate - Start date string
 * @param {string} toDate - End date string
 * @returns {Object} Filter object or error message
 */
export const buildDateFilter = (fromDate, toDate) => {
  const filter = {};

  if (!fromDate && !toDate) {
    return { filter };
  }

  const parsedFrom = parseDateBoundary(fromDate, "start");
  const parsedTo = parseDateBoundary(toDate, "end");

  if (fromDate && !parsedFrom) {
    return { error: ERROR_MESSAGES.INVALID_FROM_DATE };
  }

  if (toDate && !parsedTo) {
    return { error: ERROR_MESSAGES.INVALID_TO_DATE };
  }

  filter.createdAt = {};
  if (parsedFrom) filter.createdAt.$gte = parsedFrom;
  if (parsedTo) filter.createdAt.$lte = parsedTo;

  return { filter };
};

/**
 * Extract common message filter parameters
 * @param {Object} query - Query object from request
 * @returns {Object} Normalized filter parameters
 */
export const extractMessageFilters = (query) => ({
  searchQuery: sanitizeSearchQuery(getQueryParam(query, "q")),
  sender: getQueryParam(query, "sender"),
  messageType: getQueryParam(query, "type"),
  isPinned: query.pinned === "true",
  hasFile: query.hasFile === "true",
  fromDate: getQueryParam(query, "from"),
  toDate: getQueryParam(query, "to")
});


const isValidObjectIdString = (value) => /^[0-9a-fA-F]{24}$/.test(value);

const isAllowedMessageType = (value) => Object.values(MESSAGE_TYPES).includes(value);

const MAX_SEARCH_QUERY_LENGTH = 100;

const sanitizeSearchQuery = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > MAX_SEARCH_QUERY_LENGTH) return escapeRegex(trimmed.slice(0, MAX_SEARCH_QUERY_LENGTH));
  return escapeRegex(trimmed);
};

/**
 * Build MongoDB filter for message queries
 * @param {Object} filters - Extracted filter parameters
 * @param {string} conversationId - Conversation ID to filter by
 * @param {string} userId - Current user ID (for deletedFor filter)
 * @returns {Object} MongoDB filter object
 */
export const buildMessageFilter = (filters, conversationId, userId) => {
  const filter = {
    conversation: conversationId,
    deletedFor: { $ne: userId }
  };

  if (filters.searchQuery) {
    filter.$or = [
      { content: { $regex: filters.searchQuery, $options: "i" } },
      { fileName: { $regex: filters.searchQuery, $options: "i" } }
    ];
  }

  if (isValidObjectIdString(filters.sender)) {
    filter.sender = filters.sender;
  }

  if (filters.messageType && filters.messageType !== "all" && isAllowedMessageType(filters.messageType)) {
    filter.type = filters.messageType;
  }

  if (filters.isPinned) {
    filter.pinned = true;
  }

  if (filters.hasFile) {
    filter.fileUrl = { $ne: "" };
  }

  return filter;
};

/**
 * Validate email format (deterministic, no regex backtracking)
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export const isValidEmail = (email) => {
  if (typeof email !== "string") {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf("@");

  if (atIndex <= 0 || atIndex !== normalized.lastIndexOf("@")) {
    return false;
  }

  const localPart = normalized.slice(0, atIndex);
  const domainPart = normalized.slice(atIndex + 1);

  if (!localPart || !domainPart || localPart.includes(" ") || domainPart.includes(" ")) {
    return false;
  }

  if (domainPart.startsWith(".") || domainPart.endsWith(".") || !domainPart.includes(".")) {
    return false;
  }

  return true;
};

/**
 * Normalize email for consistent database queries
 * @param {string} email - Email to normalize
 * @returns {string} Normalized email
 */
export const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

/**
 * Validate ObjectId string format
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid MongoDB ObjectId format
 */
export const isValidObjectId = (id) => {
  if (!id) return false;
  return /^[0-9a-fA-F]{24}$/.test(String(id));
};
