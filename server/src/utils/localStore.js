/**
 * Shared local user store for development/fallback mode
 * Centralizes the globalThis.__chatwaveLocalUsers pattern
 * to avoid duplicate definitions across auth, middleware, and user controllers.
 */

import mongoose from "mongoose";

const localUserStore = globalThis.__chatwaveLocalUsers ?? new Map();
globalThis.__chatwaveLocalUsers = localUserStore;

/**
 * Check if MongoDB is disabled via SKIP_DB environment variable
 * @returns {boolean} True if SKIP_DB=true
 */
export const isLocalDbDisabled = () =>
  String(process.env.SKIP_DB || "").toLowerCase() === "true";

/**
 * Get the shared local user store Map
 * @returns {Map} Local user store
 */
export const getLocalUserStore = () => localUserStore;

/**
 * Generate a new ObjectId string for local users
 * @returns {string} New ObjectId string
 */
export const makeLocalUserId = () => new mongoose.Types.ObjectId().toString();

/**
 * Find a local user by their ID
 * @param {string} userId - User ID to search for
 * @returns {Object|null} User object or null
 */
export const getLocalUserById = (userId) => {
  const targetId = String(userId);
  for (const user of localUserStore.values()) {
    if (String(user._id) === targetId) return user;
  }
  return null;
};

/**
 * Serialize a user object for API responses (strips sensitive data)
 * @param {Object} user - User object
 * @returns {Object} Sanitized user data
 */
export const serializeLocalUser = (user) => ({
  _id: user._id,
  name: user.name,
  profilePic: user.profilePic || "",
  bio: user.bio || "",
  isOnline: user.isOnline ?? false,
  lastSeen: user.lastSeen || new Date()
});
