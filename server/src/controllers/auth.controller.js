import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
  REFRESH_TOKEN_COOKIE_OPTIONS
} from "../utils/token.js";

const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

const isValidEmail = (email) => {
  if (typeof email !== "string") {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const atIndex = normalizedEmail.indexOf("@");

  if (atIndex <= 0 || atIndex !== normalizedEmail.lastIndexOf("@")) {
    return false;
  }

  const localPart = normalizedEmail.slice(0, atIndex);
  const domainPart = normalizedEmail.slice(atIndex + 1);

  if (!localPart || !domainPart || localPart.includes(" ") || domainPart.includes(" ")) {
    return false;
  }

  if (domainPart.startsWith(".") || domainPart.endsWith(".") || !domainPart.includes(".")) {
    return false;
  }

  return true;
};

const validateInput = (name, email, password) => {
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Valid name is required");
  }
  if (!isValidEmail(email)) {
    throw new Error("Valid email address is required");
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
};

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
    validateInput(name, email, password);

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ message: "Email already in use" });

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: name.trim(), email: normalizedEmail, password: hash });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    res.status(201).json({ accessToken, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Validate email format before querying
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Valid email address is required" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "Password is required" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    res.json({ accessToken, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(payload.sub);

    if (!user || user.refreshTokenVersion !== payload.v) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    res.cookie("refreshToken", newRefreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    res.json({ accessToken, user: sanitizeUser(user) });
  } catch (err) {
    res.status(401).json({ message: "Refresh token expired or invalid" });
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
      secure: process.env.NODE_ENV === "production"
    });

    res.json({ message: "Logged out from all devices" });
  } catch (err) {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    res.json({ message: "Logged out" });
  }
};
