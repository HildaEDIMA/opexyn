import { create } from "zustand";
import api from "../services/api";

const useAuthStore = create((set, get) => ({
  client: null,
  token: localStorage.getItem("token") || null,
  isLoading: false,
  error: null,

  // Synchronise le token depuis localStorage
  syncToken: () => {
    const token = localStorage.getItem("token");
    set({ token });
    return token;
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post("/auth/register", data);
      set({ isLoading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.detail || "Registration error", isLoading: false });
      return false;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const form = new FormData();
      form.append("username", email);
      form.append("password", password);
      const res = await api.post("/auth/login", form);
      localStorage.setItem("token", res.data.access_token);
      set({ token: res.data.access_token, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.detail || "Login error", isLoading: false });
      return false;
    }
  },

  fetchMe: async () => {
    try {
      // Synchronise d'abord le token
      const token = localStorage.getItem("token");
      if (!token) return;
      set({ token });
      
      const res = await api.get("/auth/me");
      set({ client: res.data });
    } catch {
      set({ client: null });
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ client: null, token: null });
    window.location.href = "/";
  },
}));

export default useAuthStore;