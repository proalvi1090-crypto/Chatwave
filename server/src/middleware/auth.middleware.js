import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";
import { validateRequired } from "../utils/envValidator.js";
import {
  isLocalDbDisabled,
  getLocalUserById
} from "../utils/localStore.js";

// Validate JWT secret at module load time
const jwtSecret = validateRequired("JWT_SECRET", "JWT_SECRET is required for token verification");

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [, token] = authHeader.split(" ");

    if (!token) return res.status(401).json({ message: "Unauthorized" });

    if (isLocalDbDisabled()) {
      const payload = jwt.verify(token, jwtSecret);

      if (!payload?.sub) {
        return res.status(401).json({ message: "Invalid token" });
      }

      const localUser = getLocalUserById(payload.sub);

      if (!localUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const tokenVersion = localUser.refreshTokenVersion ?? localUser.tokenVersion ?? 0;
      if (payload.tokenVersion !== tokenVersion) {
        return res.status(401).json({ message: "Token is no longer valid" });
      }

      req.user = {
        _id: localUser._id,
        name: localUser.name,
        email: localUser.email,
        profilePic: localUser.profilePic || "",
        bio: localUser.bio || "",
        isOnline: localUser.isOnline ?? false,
        lastSeen: localUser.lastSeen || new Date()
      };
      next();
      return;
    }

    const payload = jwt.verify(token, jwtSecret);

    const user = await User.findById(payload.sub).select("-password");

    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (payload.tokenVersion !== user.tokenVersion) return res.status(401).json({ message: "Token is no longer valid" });

    req.user = user;
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Auth token verification failed:", err.message); // NOSONAR
    return res.status(401).json({ message: "Invalid token" });
  }
};
