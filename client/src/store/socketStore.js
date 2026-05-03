import { create } from "zustand";
import { createSocket } from "../lib/socket";

export const useSocketStore = create((set, get) => ({
  socket: null,
  connect: (token) => {
    if (get().socket || !token) return;
    const socket = createSocket(token);
    set({ socket });
  },
  disconnect: () => {
    if (get().socket) {
      get().socket.disconnect();
      set({ socket: null });
    }
  }
}));
