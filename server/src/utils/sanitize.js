import { isValidObjectId } from "./queryHelpers.js";

/**
 * Validate and normalize an ObjectId-like value.
 * Returns the trimmed string when valid, otherwise null.
 */
export const sanitizeObjectId = (value) => {
  if (!value && value !== 0) return null;
  const id = String(value).trim();
  if (!id) return null;
  return isValidObjectId(id) ? id : null;
};

/**
 * Ensure the value is a plain string and strip leading `$` characters
 * to reduce the risk of MongoDB operator injection. Returns null for
 * invalid or empty strings.
 */
export const sanitizeString = (value) => {
  if (typeof value !== "string") return null;
  let s = value.trim();
  if (!s) return null;
  // Remove any leading $ characters that could be used for operator injection
  s = s.replace(/^\$+/, "");
  s = s.trim();
  return s || null;
};

export default { sanitizeObjectId, sanitizeString };
