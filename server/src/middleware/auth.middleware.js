import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [, token] = authHeader.split(" ");

    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-password");

    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (payload.tokenVersion !== user.tokenVersion) return res.status(401).json({ message: "Token is no longer valid" });

    req.user = user;
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Auth token verification failed:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};
