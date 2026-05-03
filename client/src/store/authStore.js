import { create } from "zustand";
import api from "../lib/axios";

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: localStorage.getItem("accessToken") || "",
  loading: false,
  login: async (payload) => {
    set({ loading: true });
    try {
      const { data } = await api.post("/auth/login", payload);
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("userId", data.user.id || data.user._id);
      set({ user: data.user, accessToken: data.accessToken, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },
  register: async (payload) => {
    set({ loading: true });
    try {
      const { data } = await api.post("/auth/register", payload);
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("userId", data.user.id || data.user._id);
      set({ user: data.user, accessToken: data.accessToken, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },
  refresh: async () => {
    try {
      const { data } = await api.post("/auth/refresh-token");
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("userId", data.user.id || data.user._id);
      set({ user: data.user, accessToken: data.accessToken });
    } catch (err) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userId");
      set({ user: null, accessToken: "" });
    }
  },
  logout: async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userId");
      set({ user: null, accessToken: "" });
    }
  }
}));
