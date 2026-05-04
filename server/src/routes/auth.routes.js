import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, refreshToken, register } from "../controllers/auth.controller.js";

const router = Router();

const authRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: "Too many auth requests, please try again later." }
});

router.post("/register", authRateLimit, register);
router.post("/login", authRateLimit, login);
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);

export default router;
