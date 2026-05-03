import { io } from "socket.io-client";

const deriveSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  return undefined;
};

export const createSocket = (token) =>
  io(deriveSocketUrl(), {
    path: import.meta.env.VITE_SOCKET_PATH || "/socket.io",
    auth: { token },
    autoConnect: true,
    transports: ["websocket", "polling"]
  });
