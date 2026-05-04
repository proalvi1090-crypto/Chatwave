import dayjs from "dayjs";
import { motion } from "framer-motion";
import Avatar from "../ui/Avatar";
import { useChatStore } from "../../store/chatStore";
import { BellOff, Star } from "lucide-react";

const getConversationTitle = (conversation, currentUserId) => {
  if (conversation.isGroup) return conversation.name || "Unnamed Group";
  return conversation.participants?.find((participant) => participant._id !== currentUserId)?.name || "Private chat";
};

const getConversationDirectUser = (conversation, currentUserId) => {
  if (conversation.isGroup) return null;
  return conversation.participants?.find((participant) => participant._id !== currentUserId) || null;
};

const getConversationPresenceText = (directUser) => {
  if (!directUser) return "";
  if (directUser.isOnline) return "Online";
  if (directUser.lastSeen) return `Last seen ${dayjs(directUser.lastSeen).format("DD MMM, HH:mm")}`;
  return "Offline";
};

export default function ConversationList() {
  const { conversations, activeConversation, setActiveConversation } = useChatStore();
  const currentUserId = localStorage.getItem("userId");

  const sortedConversations = [...conversations].sort((a, b) => {
    const aFav = a.favoriteBy?.some((id) => String(id) === String(currentUserId));
    const bFav = b.favoriteBy?.some((id) => String(id) === String(currentUserId));
    if (aFav !== bFav) return aFav ? -1 : 1;
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  });

  return (
    <div className="space-y-1">
      {sortedConversations.map((conversation) => {
        const directUser = getConversationDirectUser(conversation, currentUserId);
        const title = getConversationTitle(conversation, currentUserId);
        const directPresence = getConversationPresenceText(directUser);

        return (
          <motion.button
            key={conversation._id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setActiveConversation(conversation)}
            className={`group w-full rounded-xl border px-3 py-2.5 text-left transition ${
              activeConversation?._id === conversation._id
                ? "border-[#a5b4fc]/50 bg-white/10 shadow-[0_20px_45px_rgba(79,70,229,0.16)] backdrop-blur-xl dark:border-[#a5b4fc]/35 dark:bg-white/10"
                : "border-transparent bg-transparent hover:border-white/10 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <Avatar src={conversation.isGroup ? conversation.groupIcon : directUser?.profilePic} name={title} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</div>
                  {directUser ? <span className={`h-2 w-2 rounded-full ${directUser.isOnline ? "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.7)]" : "bg-slate-400"}`} /> : null}
                  {conversation.favoriteBy?.some((id) => String(id) === String(currentUserId)) ? (
                    <Star size={12} className="shrink-0 fill-amber-400 text-amber-500" />
                  ) : null}
                  {conversation.mutedBy?.some((id) => String(id) === String(currentUserId)) ? (
                    <BellOff size={12} className="shrink-0 text-slate-400" />
                  ) : null}
                </div>
                <div className="truncate text-xs text-slate-600 dark:text-slate-300">
                  {conversation.lastMessage?.content || conversation.lastMessage?.fileName || "No messages yet"}
                </div>
                {!conversation.isGroup && directUser ? <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{directPresence}</div> : null}
              </div>
              <div className="flex flex-col items-end gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <span>{conversation.updatedAt ? dayjs(conversation.updatedAt).format("HH:mm") : ""}</span>
                {conversation.unreadCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                  </span>
                ) : null}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
