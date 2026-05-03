import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { connectDb } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import messageRoutes from "./routes/message.routes.js";
import { initSocket } from "./socket/socket.handler.js";
import { initRedis } from "./services/redis.service.js";
import { initWebPush } from "./services/notification.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from project root and allow server/.env to override for local-only setup.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const app = express();
const server = http.createServer(app);

const configuredOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isLanDevOrigin = (origin) => {
  if (!origin || process.env.NODE_ENV === "production") return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(origin);
};

const corsOrigin = (origin, callback) => {
  if (!origin || configuredOrigins.includes(origin) || isLanDevOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error("Not allowed by CORS"));
};

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true
  }
});

app.use(
  cors({
    origin: corsOrigin,
    credentials: true
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);

const start = async () => {
  await connectDb();
  await initRedis();
  initWebPush();
  initSocket(io);

  const port = Number(process.env.PORT) || 5000;
  server.listen(port, () => console.log(`Server running on port ${port}`));
};

start().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
