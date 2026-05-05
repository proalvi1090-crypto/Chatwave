import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
  REFRESH_TOKEN_COOKIE_OPTIONS
} from "../utils/token.js";
import {
  BCRYPT_ROUNDS,
  MIN_PASSWORD_LENGTH,
  ERROR_MESSAGES,
  HTTP_STATUS
} from "../utils/constants.js";
import {
  sendBadRequest,
  sendUnauthorized,
  sendConflict,
  sendSuccessResponse,
  handleCatchError
} from "../utils/responseHandler.js";
import {
  isValidEmail,
  normalizeEmail
} from "../utils/queryHelpers.js";
import { validateRequired } from "../utils/envValidator.js";
import {
  isLocalDbDisabled,
  getLocalUserStore,
  makeLocalUserId
} from "../utils/localStore.js";


// Validate JWT secrets at module load time
const jwtSecret = validateRequired("JWT_SECRET", "JWT_SECRET is required for token operations");
const jwtRefreshSecret = validateRequired("JWT_REFRESH_SECRET", "JWT_REFRESH_SECRET is required for token operations");

const localUserStore = getLocalUserStore();

const getLocalUserByEmail = (email) => {
  const normalizedEmail = normalizeEmail(email);
  for (const user of localUserStore.values()) {
    if (user.email === normalizedEmail) return user;
  }
  return null;
};

const isDbBufferTimeout = (err) =>
  typeof err?.message === "string" &&
  (err.message.includes("buffering timed out") || err.message.includes("Cannot call `users.findOne()` before initial connection is complete"));

const userToAuthPayload = (user) => ({
  id: user._id,
  name: user.name,
  profilePic: user.profilePic || "",
  bio: user.bio || "",
  isOnline: user.isOnline ?? false,
  lastSeen: user.lastSeen || new Date(),
  tokenVersion: user.tokenVersion ?? user.refreshTokenVersion ?? 0
});

/**
 * Validate user registration input
 * @throws {Error} If validation fails
 */
const validateRegisterInput = (name, email, password) => {
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new Error(ERROR_MESSAGES.NAME_REQUIRED);
  }
  if (!isValidEmail(email)) {
    throw new Error(ERROR_MESSAGES.EMAIL_REQUIRED);
  }
  if (!password || typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(ERROR_MESSAGES.PASSWORD_TOO_SHORT);
  }
};

/**
 * Sanitize user data for API responses
 */
const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  profilePic: user.profilePic,
  bio: user.bio,
  isOnline: user.isOnline,
  lastSeen: user.lastSeen
});

/**
 * Perform authentication and send tokens
 */
const authenticateAndRespond = async (user, res, getPayload) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
  return sendSuccessResponse(res, HTTP_STATUS.OK, { accessToken, user: getPayload(user) });
};

/**
 * Verify password and authenticate local user
 */
const verifyAndAuthenticateLocal = async (email, password, res) => {
  const localUser = getLocalUserByEmail(email);
  if (!localUser) {
    return sendUnauthorized(res, ERROR_MESSAGES.INVALID_CREDENTIALS);
  }
  const isValid = await bcrypt.compare(password, localUser.password);
  if (!isValid) {
    return sendUnauthorized(res, ERROR_MESSAGES.INVALID_CREDENTIALS);
  }
  return authenticateAndRespond(localUser, res, userToAuthPayload);
};

/**
 * Verify password and authenticate database user
 */
const verifyAndAuthenticateDb = async (email, password, res) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return sendUnauthorized(res, ERROR_MESSAGES.INVALID_CREDENTIALS);
  }
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return sendUnauthorized(res, ERROR_MESSAGES.INVALID_CREDENTIALS);
  }
  return authenticateAndRespond(user, res, sanitizeUser);
};

export const register = async (req, res) => {
  const { name, email, password } = req.body;
  const displayName = typeof name === "string" ? name.trim() : "";

  /**
   * Create a local user, persist it, and respond with tokens.
   */
  const createAndAuthenticateLocalUser = async (normalizedEmail) => {
    const localUser = {
      _id: makeLocalUserId(),
      name: displayName,
      email: normalizedEmail,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      profilePic: "",
      bio: "",
      isOnline: false,
      lastSeen: new Date(),
      refreshTokenVersion: 0
    };

    localUserStore.set(localUser._id, localUser);
    return authenticateAndRespond(localUser, res, userToAuthPayload);
  };

  try {
    const normalizedEmail = normalizeEmail(email);

    // Validate input before querying database
    validateRegisterInput(name, email, password);

    if (isLocalDbDisabled()) {
      const existing = getLocalUserByEmail(email);
      if (existing) {
        return sendConflict(res, ERROR_MESSAGES.EMAIL_IN_USE);
      }

      return createAndAuthenticateLocalUser(normalizedEmail);
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return sendConflict(res, ERROR_MESSAGES.EMAIL_IN_USE);
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ name: displayName, email: normalizedEmail, password: hash });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return sendSuccessResponse(res, HTTP_STATUS.CREATED, { accessToken, user: sanitizeUser(user) });
  } catch (err) {
    if (isDbBufferTimeout(err)) {
      const existing = getLocalUserByEmail(email);
      if (existing) {
        return sendConflict(res, ERROR_MESSAGES.EMAIL_IN_USE);
      }

      return createAndAuthenticateLocalUser(normalizeEmail(email));
    }

    return sendBadRequest(res, err.message, { error: err });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate email format before querying
    if (!isValidEmail(email)) {
      return sendBadRequest(res, ERROR_MESSAGES.EMAIL_REQUIRED);
    }
    if (!password || typeof password !== "string") {
      return sendBadRequest(res, ERROR_MESSAGES.PASSWORD_REQUIRED);
    }

    if (isLocalDbDisabled()) {
      return verifyAndAuthenticateLocal(email, password, res);
    }

    return verifyAndAuthenticateDb(email, password, res);
  } catch (err) {
    if (isDbBufferTimeout(err)) {
      return verifyAndAuthenticateLocal(email, password, res);
    }

    return handleCatchError(err, res, "Login");
  }
};

export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return sendUnauthorized(res, ERROR_MESSAGES.NO_REFRESH_TOKEN);
    }

    const payload = jwt.verify(token, jwtRefreshSecret);
    const user = await User.findById(payload.sub);

    if (!user || user.refreshTokenVersion !== payload.v) {
      return sendUnauthorized(res, ERROR_MESSAGES.REFRESH_TOKEN_INVALID);
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    res.cookie("refreshToken", newRefreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return sendSuccessResponse(res, HTTP_STATUS.OK, { accessToken, user: sanitizeUser(user) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Refresh token verification failed:", err.message); // NOSONAR
    return sendUnauthorized(res, ERROR_MESSAGES.REFRESH_TOKEN_INVALID, { error: err });
  }
};

export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [, token] = authHeader.split(" ");

    if (token) {
      const payload = jwt.verify(token, jwtSecret);
      await User.findByIdAndUpdate(payload.sub, { $inc: { refreshTokenVersion: 1 } });
    }

    res.clearCookie("refreshToken", REFRESH_TOKEN_COOKIE_OPTIONS);

    return sendSuccessResponse(res, HTTP_STATUS.OK, null, "Logged out from all devices");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Logout error:", err.message); // NOSONAR
    res.clearCookie("refreshToken", REFRESH_TOKEN_COOKIE_OPTIONS);
    return sendSuccessResponse(res, HTTP_STATUS.OK, null, "Logged out");
  }
};
