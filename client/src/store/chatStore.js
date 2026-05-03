import { create } from "zustand";
import { toast } from "sonner";
import api from "../lib/axios";

const DOWNLOAD_HISTORY_KEY = "chatwave.download.history";

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const loadDownloadHistory = () => safeParse(localStorage.getItem(DOWNLOAD_HISTORY_KEY) || "[]", []);

const persistDownloadHistory = (items) => {
  localStorage.setItem(DOWNLOAD_HISTORY_KEY, JSON.stringify(items));
};

const buildFilterQuery = (filters) => {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  if (filters.pinnedOnly) params.set("pinned", "true");
  if (filters.sender && filters.sender !== "all") params.set("sender", filters.sender);
  if (filters.hasFile) params.set("hasFile", "true");
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
};

const upsertConversation = (conversations, conversation) => {
  const exists = conversations.some((item) => item._id === conversation._id);
  return exists
    ? conversations.map((item) => (item._id === conversation._id ? conversation : item))
    : [conversation, ...conversations];
};

export const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  searchResults: [],
  typingUsers: {},
  replyingTo: null,
  pendingPayloads: {},
  retryQueue: [],
  threadRootId: null,
  messageFilters: {
    q: "",
    type: "all",
    pinnedOnly: false,
    sender: "all",
    hasFile: false,
    from: "",
    to: ""
  },
  downloadHistory: loadDownloadHistory(),
  loadConversations: async () => {
    const { data } = await api.get("/conversations");
    const next = Array.isArray(data) ? data : [];
    set({ conversations: next });
    return next;
  },
  loadMessages: async (conversationId) => {
    const id = conversationId || get().activeConversation?._id;
    if (!id) return [];

    const query = buildFilterQuery(get().messageFilters);
    const url = query ? `/messages/${id}?${query}` : `/messages/${id}`;
    const { data } = await api.get(url);
    const next = Array.isArray(data) ? data : [];
    set({ messages: next });
    return next;
  },
  setActiveConversation: async (conversation) => {
    if (!conversation) {
      set({
        activeConversation: null,
        replyingTo: null,
        threadRootId: null,
        messages: []
      });
      return;
    }

    set({
      activeConversation: { ...conversation, unreadCount: 0 },
      replyingTo: null,
      threadRootId: null,
      conversations: get().conversations.map((item) =>
        item._id === conversation._id ? { ...item, unreadCount: 0 } : item
      )
    });
  },
  clearActiveConversation: () => {
    set({
      activeConversation: null,
      replyingTo: null,
      threadRootId: null,
      messages: []
    });
  },
  setMessageFilters: async (partial) => {
    set({ messageFilters: { ...get().messageFilters, ...partial } });
  },
  setReplyingTo: (message) => {
    set({ replyingTo: message || null });
  },
  setThreadRootId: (messageId) => {
    set({ threadRootId: messageId || null });
  },
  updateMessage: (message) => {
    const id = message?._id?.toString?.() || message?._id;
    const clientId = message?.clientId;
    set({
      messages: get().messages.map((item) => {
        const itemId = item?._id?.toString?.() || item?._id;
        if (itemId === id) return { ...item, ...message, failed: false, sending: false, temp: false };
        if (clientId && item.clientId && item.clientId === clientId) {
          return { ...item, ...message, failed: false, sending: false, temp: false };
        }
        return item;
      })
    });
  },
  sendMessage: async (payload) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const replyToId = get().replyingTo?._id || payload.replyTo || null;
    const userId = localStorage.getItem("userId");

    const optimisticMessage = {
      _id: tempId,
      clientId: tempId,
      content: payload.content || "",
      type: payload.file ? (payload.file.type?.startsWith("image/") ? "image" : "file") : "text",
      fileName: payload.file?.name || "",
      sender: { _id: userId, name: "You" },
      createdAt: new Date().toISOString(),
      replyTo: get().messages.find((item) => item._id === replyToId) || null,
      seenBy: userId ? [userId] : [],
      reactions: [],
      pinned: false,
      sending: true,
      failed: false,
      temp: true,
      _localFile: payload.file || null
    };

    set({
      messages: [...get().messages, optimisticMessage],
      replyingTo: null,
      pendingPayloads: {
        ...get().pendingPayloads,
        [tempId]: {
          payload: { ...payload, replyTo: replyToId, clientId: tempId },
          attempts: 0
        }
      }
    });

    const sendOnce = async (pendingId) => {
      const pending = get().pendingPayloads[pendingId];
      if (!pending) return;

      const form = new FormData();
      Object.entries(pending.payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") form.append(key, value);
      });

      try {
        const { data } = await api.post("/messages", form);
        set({
          messages: get().messages.map((item) => (item._id === pendingId ? { ...data, sending: false, failed: false, temp: false } : item)),
          retryQueue: get().retryQueue.filter((id) => id !== pendingId)
        });

        const nextPending = { ...get().pendingPayloads };
        delete nextPending[pendingId];
        set({ pendingPayloads: nextPending });
      } catch {
        const nextAttempts = (pending.attempts || 0) + 1;
        toast.error("Message failed, retrying automatically");
        set({
          messages: get().messages.map((item) => (item._id === pendingId ? { ...item, sending: false, failed: true } : item)),
          pendingPayloads: {
            ...get().pendingPayloads,
            [pendingId]: { ...pending, attempts: nextAttempts }
          },
          retryQueue: get().retryQueue.includes(pendingId) ? get().retryQueue : [...get().retryQueue, pendingId]
        });

        const wait = Math.min(15000, 2500 * nextAttempts);
        setTimeout(() => {
          const message = get().messages.find((item) => item._id === pendingId);
          if (!message || !message.failed) return;
          get().retryFailedMessage(pendingId);
        }, wait);
      }
    };

    await sendOnce(tempId);
  },
  retryFailedMessage: async (messageId) => {
    const pending = get().pendingPayloads[messageId];
    if (!pending) return;

    set({ messages: get().messages.map((item) => (item._id === messageId ? { ...item, sending: true, failed: false } : item)) });

    const form = new FormData();
    Object.entries(pending.payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") form.append(key, value);
    });

    try {
      const { data } = await api.post("/messages", form);
      const nextPending = { ...get().pendingPayloads };
      delete nextPending[messageId];

      set({
        pendingPayloads: nextPending,
        retryQueue: get().retryQueue.filter((id) => id !== messageId),
        messages: get().messages.map((item) => (item._id === messageId ? { ...data, failed: false, sending: false, temp: false } : item))
      });
      toast.success("Message delivered");
    } catch {
      const nextAttempts = (pending.attempts || 0) + 1;
      toast.error("Retry failed");
      set({
        pendingPayloads: {
          ...get().pendingPayloads,
          [messageId]: { ...pending, attempts: nextAttempts }
        },
        messages: get().messages.map((item) => (item._id === messageId ? { ...item, failed: true, sending: false } : item))
      });
    }
  },
  retryAllFailedMessages: async () => {
    const queue = [...get().retryQueue];
    for (const id of queue) {
      // Sequential retries avoid multiple concurrent uploads during reconnect.
      // eslint-disable-next-line no-await-in-loop
      await get().retryFailedMessage(id);
    }
  },
  addIncomingMessage: (message) => {
    const state = get();
    const incomingId = message?._id?.toString?.() || message?._id;
    const incomingClientId = message?.clientId;
    const conversationId = message?.conversation?._id || message?.conversation;
    const myId = localStorage.getItem("userId");
    const senderId = message?.sender?._id || message?.sender;
    const isMine = String(senderId) === String(myId);
    const isActive = String(state.activeConversation?._id) === String(conversationId);

    const existsById = state.messages.some((m) => (m._id?.toString?.() || m._id) === incomingId);
    if (existsById) return;

    const matchTemp = incomingClientId
      ? state.messages.find((m) => m.clientId && m.clientId === incomingClientId)
      : null;

    if (matchTemp) {
      set({
        messages: state.messages.map((m) => (m.clientId === incomingClientId ? { ...message, failed: false, sending: false, temp: false } : m)),
        conversations: state.conversations.map((conversation) =>
          String(conversation._id) === String(conversationId)
            ? {
                ...conversation,
                lastMessage: message,
                updatedAt: message.createdAt || conversation.updatedAt,
                unreadCount: isActive || isMine ? 0 : (conversation.unreadCount || 0) + 1
              }
            : conversation
        )
      });
      return;
    }

    set({
      messages: [...state.messages, message],
      conversations: state.conversations.map((conversation) =>
        String(conversation._id) === String(conversationId)
          ? {
              ...conversation,
              lastMessage: message,
              updatedAt: message.createdAt || conversation.updatedAt,
              unreadCount: isActive || isMine ? 0 : (conversation.unreadCount || 0) + 1
            }
          : conversation
      )
    });
  },
  applySeenUpdate: ({ messageId, seenBy }) => {
    set({
      messages: get().messages.map((message) =>
        message._id === messageId ? { ...message, seenBy: seenBy || message.seenBy } : message
      )
    });
  },
  markSeen: async (messageId) => {
    if (!messageId) return;
    try {
      await api.put(`/messages/${messageId}/seen`);
    } catch {
      // Ignore transient failures for read-receipt updates.
    }
  },
  toggleReaction: async (messageId, emoji) => {
    const { data } = await api.put(`/messages/${messageId}/reactions`, { emoji });
    get().updateMessage(data);
  },
  togglePin: async (messageId) => {
    const { data } = await api.put(`/messages/${messageId}/pin`);
    get().updateMessage(data);
  },
  recordDownload: (message) => {
    const next = [
      {
        id: `${message._id}-${Date.now()}`,
        messageId: message._id,
        fileName: message.fileName || message.content || "Attachment",
        fileUrl: message.fileUrl,
        type: message.type,
        downloadedAt: new Date().toISOString()
      },
      ...get().downloadHistory.filter((item) => item.messageId !== message._id)
    ].slice(0, 100);

    persistDownloadHistory(next);
    set({ downloadHistory: next });
  },
  clearDownloadHistory: () => {
    persistDownloadHistory([]);
    set({ downloadHistory: [] });
  },
  searchUsers: async (q) => {
    if (!q.trim()) return set({ searchResults: [] });
    const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
    set({ searchResults: data });
  },
  openOrCreatePrivateChat: async (participantId) => {
    const { data } = await api.post("/conversations", { participantId });
    const found = get().conversations.some((c) => c._id === data._id);
    set({
      conversations: found ? get().conversations : [data, ...get().conversations],
      activeConversation: data
    });
  },
  setTyping: (conversationId, userId, value) => {
    const key = `${conversationId}:${userId}`;
    const typingUsers = { ...get().typingUsers };
    if (value) typingUsers[key] = true;
    else delete typingUsers[key];
    set({ typingUsers });
  },
  updateUserPresence: (userId, isOnline, lastSeen = null) => {
    const patchUser = (user) => {
      if (!user || user._id !== userId) return user;
      return { ...user, isOnline, lastSeen: lastSeen || user.lastSeen };
    };

    const conversations = get().conversations.map((conversation) => ({
      ...conversation,
      participants: (conversation.participants || []).map(patchUser)
    }));

    const activeConversation = get().activeConversation
      ? {
          ...get().activeConversation,
          participants: (get().activeConversation.participants || []).map(patchUser)
        }
      : null;

    set({ conversations, activeConversation });
  },
  updateConversationPreferences: async (conversationId, preferences) => {
    const { data } = await api.patch(`/conversations/${conversationId}/preferences`, preferences);
    set({
      conversations: upsertConversation(get().conversations, data),
      activeConversation: get().activeConversation?._id === data._id ? data : get().activeConversation
    });
  },
  toggleFavoriteConversation: async (conversationId) => {
    const uid = localStorage.getItem("userId");
    const conversation = get().conversations.find((item) => item._id === conversationId);
    const isFav = conversation?.favoriteBy?.some((id) => String(id) === String(uid));
    await get().updateConversationPreferences(conversationId, { favorite: !isFav });
  },
  toggleMuteConversation: async (conversationId) => {
    const uid = localStorage.getItem("userId");
    const conversation = get().conversations.find((item) => item._id === conversationId);
    const isMuted = conversation?.mutedBy?.some((id) => String(id) === String(uid));
    await get().updateConversationPreferences(conversationId, { muted: !isMuted });
  },
  setWallpaper: async (conversationId, wallpaper) => {
    await get().updateConversationPreferences(conversationId, { wallpaper });
  }
}));
