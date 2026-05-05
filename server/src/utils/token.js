import jwt from "jsonwebtoken";
import { validateRequired } from "./envValidator.js";

const ACCESS_TOKEN_AGE = 60 * 15;
const REFRESH_TOKEN_AGE = 60 * 60 * 24 * 7;

// Validate JWT secrets are configured at module load time
const jwtSecret = validateRequired("JWT_SECRET", "JWT_SECRET is required for signing access tokens");
const jwtRefreshSecret = validateRequired("JWT_REFRESH_SECRET", "JWT_REFRESH_SECRET is required for signing refresh tokens");

export const generateAccessToken = (user) =>
  jwt.sign(
    {
      sub: user._id,
      email: user.email,
      name: user.name,
      tokenVersion: user.tokenVersion ?? user.refreshTokenVersion ?? 0
    },
    jwtSecret,
    { expiresIn: ACCESS_TOKEN_AGE }
  );

export const generateRefreshToken = (user) =>
  jwt.sign(
    {
      sub: user._id,
      v: user.refreshTokenVersion
    },
    jwtRefreshSecret,
    { expiresIn: REFRESH_TOKEN_AGE }
  );

export const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: REFRESH_TOKEN_AGE * 1000
};
