/**
 * Application constants for better maintainability
 * Centralized configuration for magic numbers, limits, and error messages
 */

// Authentication & Security
export const BCRYPT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Message Limits
export const MAX_MESSAGES_PER_QUERY = 200;
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_FILE_NAME_LENGTH = 255;

// Group Limits
export const MIN_GROUP_MEMBERS = 1;
export const MAX_GROUP_NAME_LENGTH = 100;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
};

// Error Messages
export const ERROR_MESSAGES = {
  // Authentication
  EMAIL_REQUIRED: "Valid email address is required",
  PASSWORD_REQUIRED: "Password is required",
  PASSWORD_TOO_SHORT: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  NAME_REQUIRED: "Valid name is required",
  INVALID_CREDENTIALS: "Invalid credentials",
  EMAIL_IN_USE: "Email already in use",
  NO_REFRESH_TOKEN: "No refresh token",
  REFRESH_TOKEN_INVALID: "Refresh token expired or invalid",

  // Conversations
  CONVERSATION_NOT_FOUND: "Conversation not found",
  CONVERSATION_REQUIRED: "Conversation ID required",
  INVALID_CONVERSATION_ID: "Invalid conversation ID",
  GROUP_NAME_REQUIRED: "Group name and at least one member required",

  // Messages
  MESSAGE_NOT_FOUND: "Message not found",
  EMOJI_REQUIRED: "emoji required",
  MESSAGE_CONTENT_REQUIRED: "Message content is required",

  // Users
  USER_NOT_FOUND: "User not found",
  PARTICIPANT_ID_REQUIRED: "participantId required",
  INVALID_PARTICIPANT_ID: "Invalid participant ID",

  // Authorization
  FORBIDDEN: "Forbidden",
  UNAUTHORIZED: "Unauthorized",
  ACCESS_DENIED: "Access denied",

  // Validation
  INVALID_DATE: "Invalid date format",
  INVALID_FROM_DATE: "Invalid from date",
  INVALID_TO_DATE: "Invalid to date",
  INVALID_QUERY_PARAMETER: "Invalid query parameter",

  // Search
  SEARCH_QUERY_REQUIRED: "Search query required",

  // General
  INTERNAL_ERROR: "Internal server error",
  SOMETHING_WRONG: "Something went wrong"
};

// Success Messages
export const SUCCESS_MESSAGES = {
  MESSAGE_SENT: "Message sent successfully",
  MESSAGE_DELETED: "Message deleted successfully",
  CONVERSATION_CREATED: "Conversation created successfully",
  CONVERSATION_UPDATED: "Conversation updated successfully",
  CONVERSATION_DELETED: "Conversation deleted successfully",
  USER_UPDATED: "User updated successfully"
};

// Resource Types (Cloudinary)
export const CLOUDINARY_RESOURCE_TYPES = {
  IMAGE: "image",
  RAW: "raw",
  VIDEO: "video"
};

// Message Types
export const MESSAGE_TYPES = {
  TEXT: "text",
  IMAGE: "image",
  FILE: "file",
  SYSTEM: "system"
};

// File MIME Types
export const MIME_TYPES = {
  IMAGE_JPEG: "image/jpeg",
  IMAGE_PNG: "image/png",
  IMAGE_GIF: "image/gif",
  IMAGE_WEBP: "image/webp"
};

// Conversation Types
export const CONVERSATION_TYPES = {
  PRIVATE: false,
  GROUP: true
};

// Event Names (Socket.io)
export const SOCKET_EVENTS = {
  NEW_MESSAGE: "new_message",
  MESSAGE_EDITED: "message_edited",
  MESSAGE_DELETED: "message_deleted",
  TYPING: "typing",
  STOP_TYPING: "stop_typing",
  USER_ONLINE: "user_online",
  USER_OFFLINE: "user_offline",
  REACTION_ADDED: "reaction_added",
  MESSAGE_SEEN: "message_seen",
  PRESENCE_UPDATE: "presence_update"
};

// Node Environment
export const NODE_ENVIRONMENT = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test"
};
