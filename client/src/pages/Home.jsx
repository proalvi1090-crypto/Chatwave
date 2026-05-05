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
    <div className="min-h-[100dvh] w-full p-2 md:p-4">
      <CreateGroup open={groupOpen} onClose={() => setGroupOpen(false)} />
      <div className="mx-auto flex h-[calc(100dvh-1rem)] md:h-[calc(100dvh-2rem)] max-w-7xl flex-col overflow-hidden rounded-[1.5rem] border border-white/10 layer-1 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-chatdark-bright/40 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 label-caps text-white">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />{" "}
              ChatWave Pro
            </div>
            <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-1.5 label-caps text-white/70 md:flex">
              Workspace
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

        <div className="grid flex-1 min-h-0 gap-0 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={`relative flex min-h-0 flex-col overflow-hidden border-r border-white/5 bg-black/10 p-4 text-white z-10 ${activeConversation ? "hidden lg:flex" : "flex"}`}>
          <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_20%_0%,rgba(192,193,255,0.15),transparent_60%)]" />
          <div className="relative mb-4 mt-2 flex items-center justify-between gap-4">
            <div>
              <p className="label-caps text-brand-100/60 mb-1">User Profile</p>
              <h2 className="font-display text-xl font-semibold leading-tight text-white">{user?.name || "User"}</h2>
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
              className="flex w-full items-center justify-center gap-2 rounded-full brand-gradient px-4 py-3 text-sm font-bold text-white shadow-md transition hover:scale-[1.02]"
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
