import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
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

const configuredOrigins = new Set(
  (process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const isPrivateDevHost = (host) => {
  if (host === "localhost" || host === "127.0.0.1") return true;

  const octetStrings = host.split(".");
  const octets = octetStrings.map((value) => Number.parseInt(value, 10));
  if (octets.length !== 4 || octets.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return false;
  }

  if (octets[0] === 10) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  return false;
};

const isLanDevOrigin = (origin) => {
  if (process.env.NODE_ENV !== "development") return false;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return isPrivateDevHost(parsed.hostname);
  } catch {
    return false;
  }
};

const corsOrigin = (origin, callback) => {
  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      callback(new Error("Not allowed by CORS"));
      return;
    }

    callback(null, true);
    return;
  }

  if (configuredOrigins.has(origin) || isLanDevOrigin(origin)) {
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

try {
  await start();
} catch (err) {
  console.error("Startup failed:", err);
  process.exit(1);
}
