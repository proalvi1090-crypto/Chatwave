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
  HTTP_STATUS,
  NODE_ENVIRONMENT
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

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Validate input before querying database
    validateRegisterInput(name, email, password);

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return sendConflict(res, ERROR_MESSAGES.EMAIL_IN_USE);
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ name: name.trim(), email: normalizedEmail, password: hash });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return sendSuccessResponse(res, HTTP_STATUS.CREATED, { accessToken, user: sanitizeUser(user) });
  } catch (err) {
    return sendBadRequest(res, err.message, { error: err });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Validate email format before querying
    if (!isValidEmail(email)) {
      return sendBadRequest(res, ERROR_MESSAGES.EMAIL_REQUIRED);
    }
    if (!password || typeof password !== "string") {
      return sendBadRequest(res, ERROR_MESSAGES.PASSWORD_REQUIRED);
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return sendUnauthorized(res, ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return sendUnauthorized(res, ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return sendSuccessResponse(res, HTTP_STATUS.OK, { accessToken, user: sanitizeUser(user) });
  } catch (err) {
    return handleCatchError(err, res, "Login");
  }
};

export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return sendUnauthorized(res, ERROR_MESSAGES.NO_REFRESH_TOKEN);
    }

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
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
    console.error("Refresh token verification failed:", err.message);
    return sendUnauthorized(res, ERROR_MESSAGES.REFRESH_TOKEN_INVALID, { error: err });
  }
};

export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [, token] = authHeader.split(" ");

    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      await User.findByIdAndUpdate(payload.sub, { $inc: { refreshTokenVersion: 1 } });
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === NODE_ENVIRONMENT.PRODUCTION
    });

    return sendSuccessResponse(res, HTTP_STATUS.OK, null, "Logged out from all devices");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Logout error:", err.message);
    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === NODE_ENVIRONMENT.PRODUCTION
    });
    return sendSuccessResponse(res, HTTP_STATUS.OK, null, "Logged out");
  }
};
