import jwt from "jsonwebtoken";

const ACCESS_TOKEN_AGE = 60 * 15;
const REFRESH_TOKEN_AGE = 60 * 60 * 24 * 7;

export const generateAccessToken = (user) =>
  jwt.sign(
    {
      sub: user._id,
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_AGE }
  );

export const generateRefreshToken = (user) =>
  jwt.sign(
    {
      sub: user._id,
      v: user.refreshTokenVersion
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_AGE }
  );

export const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: REFRESH_TOKEN_AGE * 1000
};
