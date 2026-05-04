/**
 * Check if error is due to database buffering timeout
 * Happens when DB connection fails and operations timeout waiting for reconnection
 */
export const isDbBufferTimeout = (err) =>
  typeof err?.message === "string" &&
  (err.message.includes("buffering timed out") || 
   err.message.includes("Cannot call") && err.message.includes("before initial connection is complete"));
