import { useEffect, useRef, useState } from "react";
import { Moon, Sun, LogOut, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import { useSocketStore } from "../store/socketStore";
import useWebPush from "../hooks/useWebPush";
import SearchBar from "../components/sidebar/SearchBar";
import ConversationList from "../components/sidebar/ConversationList";
import ChatWindow from "../components/chat/ChatWindow";
import CreateGroup from "../components/group/CreateGroup";

export default function Home() {
  const [dark, setDark] = useState(true);
  const [groupOpen, setGroupOpen] = useState(false);
  const [showTopMenu, setShowTopMenu] = useState(false);
  const topMenuRef = useRef(null);
  const { user, logout, accessToken } = useAuthStore();
  const {
    loadConversations,
    activeConversation,
    clearActiveConversation,
    addIncomingMessage,
    setTyping,
    updateMessage,
    applySeenUpdate,
    updateUserPresence,
    retryAllFailedMessages
  } = useChatStore();
  const { socket, connect, disconnect } = useSocketStore();
  useWebPush(user, import.meta.env.VITE_VAPID_PUBLIC_KEY);

  useEffect(() => {
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [dark]);

  useQuery({
    queryKey: ["conversations"],
    queryFn: loadConversations,
    staleTime: 45 * 1000
  });

  useEffect(() => {
    connect(accessToken);
    return () => disconnect();
  }, [connect, disconnect, accessToken]);

  useEffect(() => {
    if (!socket) return;

    const sound = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
    );
    const handleNewMessage = (msg) => {
      addIncomingMessage(msg);
      sound.play().catch(() => {});
    };
    const handleTypingStart = ({ userId, conversationId }) => setTyping(conversationId, userId, true);
    const handleTypingStop = ({ userId, conversationId }) => setTyping(conversationId, userId, false);
    const handleMessageUpdated = (message) => updateMessage(message);
    const handleMessageSeen = (payload) => applySeenUpdate(payload);
    const handleUserOnline = (userId) => updateUserPresence(userId, true, null);
    const handleUserOffline = ({ userId, lastSeen }) => updateUserPresence(userId, false, lastSeen);

    socket.on("new_message", handleNewMessage);
    socket.on("user_typing", handleTypingStart);
    socket.on("user_stop_typing", handleTypingStop);
    socket.on("message_updated", handleMessageUpdated);
    socket.on("message_seen", handleMessageSeen);
    socket.on("user_online", handleUserOnline);
    socket.on("user_offline", handleUserOffline);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("user_typing", handleTypingStart);
      socket.off("user_stop_typing", handleTypingStop);
      socket.off("message_updated", handleMessageUpdated);
      socket.off("message_seen", handleMessageSeen);
      socket.off("user_online", handleUserOnline);
      socket.off("user_offline", handleUserOffline);
    };
  }, [socket, addIncomingMessage, setTyping, updateMessage, applySeenUpdate, updateUserPresence]);

  useEffect(() => {
    if (socket && activeConversation?._id) {
      socket.emit("join_conversation", activeConversation._id);
    }
  }, [socket, activeConversation]);

  useEffect(() => {
    const handleOnline = () => {
      retryAllFailedMessages();
    };

    globalThis.addEventListener("online", handleOnline);
    return () => globalThis.removeEventListener("online", handleOnline);
  }, [retryAllFailedMessages]);

  useEffect(() => {
    const closeMenuOnOutside = (event) => {
      if (topMenuRef.current && !topMenuRef.current.contains(event.target)) {
        setShowTopMenu(false);
      }
    };
    globalThis.addEventListener("mousedown", closeMenuOnOutside);
    return () => globalThis.removeEventListener("mousedown", closeMenuOnOutside);
  }, []);

  const focusSidebarSearch = () => {
    globalThis.dispatchEvent(new Event("chatwave:focus-search"));
    toast.success("Search is ready");
  };

  const toggleTheme = () => {
    setDark((prev) => !prev);
    toast.success(dark ? "Light mode enabled" : "Dark mode enabled");
  };

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_12%_8%,rgba(99,102,241,0.28),transparent_28%),radial-gradient(circle_at_82%_8%,rgba(124,58,237,0.22),transparent_26%),linear-gradient(145deg,#070814_0%,#0b1020_42%,#11162a_100%)] p-1 md:p-2.5">
      <CreateGroup open={groupOpen} onClose={() => setGroupOpen(false)} />
      <div className="panel-frame mx-auto flex h-[calc(100dvh-0.5rem)] max-w-[1600px] flex-col overflow-hidden rounded-[28px] border border-white/10 text-white">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-3 py-2.5 text-white/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.75)]" />{" "}
              ChatWave Workspace
            </div>
            <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 md:flex">
              Premium messaging interface
            </div>
          </div>
          <div className="relative flex items-center gap-2 text-white/70" ref={topMenuRef}>
            <button
              type="button"
              onClick={focusSidebarSearch}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10"
            >
              Search
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10"
            >
              Theme
            </button>
            <button
              type="button"
              onClick={() => setShowTopMenu((prev) => !prev)}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10"
            >
              More
            </button>
            {showTopMenu ? (
              <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-white/10 bg-[#121621] p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    focusSidebarSearch();
                    setShowTopMenu(false);
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                >
                  Search teammate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroupOpen(true);
                    setShowTopMenu(false);
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                >
                  Create group
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setShowTopMenu(false);
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid flex-1 min-h-0 gap-0 overflow-hidden lg:grid-cols-[352px_minmax(0,1fr)]">
        <aside className={`relative flex min-h-0 flex-col overflow-hidden border-0 border-r border-r-white/10 bg-white/5 p-3 text-white backdrop-blur-xl ${activeConversation ? "hidden lg:block" : "block"}`}>
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.35),transparent_42%),linear-gradient(90deg,rgba(79,70,229,0.2),transparent)]" />
          <div className="relative mb-3 mt-1 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">Workspace</p>
              <h2 className="font-display text-xl font-semibold leading-tight text-white">{user?.name || "User"}</h2>
              <p className="text-xs text-white/60">Glassmorphism • Manrope • Indigo Violet</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleTheme}
                className="rounded-full border border-white/10 bg-white/5 p-2.5 text-white shadow-sm transition hover:bg-white/10"
                aria-label="Toggle theme"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                onClick={logout}
                className="rounded-full border border-white/10 bg-white/5 p-2.5 text-white shadow-sm transition hover:bg-white/10"
                aria-label="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col space-y-3 pt-2">
            <SearchBar />
            <button
              onClick={() => setGroupOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#6366f1] via-[#7c3aed] to-[#8b5cf6] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <Users size={16} /> Create Group
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <ConversationList />
            </div>
          </div>
        </aside>

        <main className={`min-h-0 min-w-0 flex-col bg-transparent ${activeConversation ? "flex" : "hidden lg:flex"}`}>
          <ChatWindow onBack={clearActiveConversation} />
        </main>
        </div>
      </div>
    </div>
  );
}
