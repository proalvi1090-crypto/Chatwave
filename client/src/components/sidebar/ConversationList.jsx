import dayjs from "dayjs";
import { motion } from "framer-motion";
import Avatar from "../ui/Avatar";
import { useChatStore } from "../../store/chatStore";
import { BellOff, Star } from "lucide-react";

export default function ConversationList() {
  const { conversations, activeConversation, setActiveConversation } = useChatStore();
  const currentUserId = localStorage.getItem("userId");

  const sortedConversations = [...conversations].sort((a, b) => {
    const aFav = a.favoriteBy?.some((id) => String(id) === String(currentUserId));
    const bFav = b.favoriteBy?.some((id) => String(id) === String(currentUserId));
    if (aFav !== bFav) return aFav ? -1 : 1;
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  });

  const titleOf = (conversation) => {
    if (conversation.isGroup) return conversation.name || "Unnamed Group";
    return conversation.participants?.find((p) => p._id !== localStorage.getItem("userId"))?.name || "Private chat";
  };

  const getDirectParticipant = (conversation) => {
    if (conversation.isGroup) return null;
    return conversation.participants?.find((p) => p._id !== localStorage.getItem("userId")) || null;
  };

  return (
    <div className="space-y-1">
      {sortedConversations.map((conversation) => {
        const directUser = getDirectParticipant(conversation);

        return (
          <motion.button
            key={conversation._id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setActiveConversation(conversation)}
            className={`group w-full rounded-xl border px-3 py-2.5 text-left transition ${
              activeConversation?._id === conversation._id
                ? "border-[#b8d9f9] bg-[#ecf4ff] shadow-sm dark:border-sky-700 dark:bg-sky-950/40"
                : "border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-100/90 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <Avatar src={conversation.isGroup ? conversation.groupIcon : directUser?.profilePic} name={titleOf(conversation)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{titleOf(conversation)}</div>
                  {directUser ? <span className={`h-2 w-2 rounded-full ${directUser.isOnline ? "bg-emerald-400" : "bg-slate-400"}`} /> : null}
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
                {!conversation.isGroup && directUser ? (
                  <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                    {directUser.isOnline ? "Online" : directUser.lastSeen ? `Last seen ${dayjs(directUser.lastSeen).format("DD MMM, HH:mm")}` : "Offline"}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <span>{conversation.updatedAt ? dayjs(conversation.updatedAt).format("HH:mm") : ""}</span>
                {conversation.unreadCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-ocean px-1.5 py-0.5 text-[10px] font-semibold text-white">
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
