import dayjs from "dayjs";
import { motion } from "framer-motion";
import Avatar from "../ui/Avatar";
import { CornerUpLeft, Download, Pin, RefreshCw, SmilePlus } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

export default function MessageBubble({ message, me, onOpenThread, threadActive = false }) {
  const { toggleReaction, togglePin, setReplyingTo, retryFailedMessage, recordDownload } = useChatStore();
  const mine = message.sender?._id === me?.id || message.sender?._id === me?._id;
  const hasMedia = message.type === "image" && message.fileUrl;
  const hasFile = message.type === "file" && message.fileUrl;
  const readCount = (message.seenBy || []).length;
  const reactions = message.reactions || [];
  const deliveryMark = message.sending ? "..." : readCount > 1 ? "✓✓" : "✓";

  const handleDownload = () => {
    if (!message.fileUrl) return;
    recordDownload(message);
    window.open(message.fileUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
    >
      {!mine ? <Avatar src={message.sender?.profilePic} name={message.sender?.name || "?"} /> : null}
      <div
        className={`max-w-[86%] rounded-[1.5rem] px-5 py-3 shadow-sm backdrop-blur-md ${
          mine
            ? "brand-gradient border border-brand-100/30 text-white shadow-lg shadow-[#c0c1ff]/20"
            : "layer-2 text-white/90"
        }`}
      >
        {message.pinned ? (
          <div className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] ${mine ? "bg-emerald-100/20" : "bg-white/10"}`}>
            <Pin size={10} /> Pinned
          </div>
        ) : null}
        {message.replyTo && (
          <button
            type="button"
            onClick={onOpenThread}
            className={`mb-2 w-full rounded-xl px-3 py-2 text-left text-xs ${mine ? "bg-white/15" : "bg-black/20"}`}
          >
            Reply to {message.replyTo.sender?.name || "message"}: {message.replyTo.content || message.replyTo.fileName || "Media"}
          </button>
        )}
        {hasMedia ? (
          <img src={message.fileUrl} alt="attachment" className="mb-3 max-h-60 w-full rounded-2xl object-cover" onClick={handleDownload} />
        ) : null}
        {hasFile ? (
          <button type="button" onClick={handleDownload} className={`mb-2 inline-flex rounded-xl px-3 py-2 text-sm font-medium ${mine ? "bg-white/15" : "bg-black/20"}`}>
            {message.fileName || "Open file"}
          </button>
        ) : null}
        {message.content ? <p className="text-sm leading-relaxed">{message.content}</p> : null}

        {reactions.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {reactions.map((reaction) => {
              const selected = reaction.users?.some((id) => String(id) === String(me?.id || me?._id));
              return (
                <button
                  key={`${message._id}-${reaction.emoji}`}
                  type="button"
                  onClick={() => toggleReaction(message._id, reaction.emoji)}
                  className={`rounded-full px-2 py-1 text-xs ${selected ? "bg-amber-200 text-slate-800" : "bg-white/30"}`}
                >
                  {reaction.emoji} {reaction.users?.length || 0}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className={`mt-2 flex flex-wrap items-center gap-2 text-[10px] ${mine ? "text-emerald-100/85" : "text-slate-300/80"}`}>
          <button type="button" onClick={() => setReplyingTo(message)} className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 hover:border-slate-200 hover:bg-black/5 dark:hover:border-slate-700 dark:hover:bg-white/10">
            <CornerUpLeft size={11} /> Reply
          </button>
          <button type="button" onClick={onOpenThread} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${threadActive ? "border-slate-300 bg-black/5 dark:border-slate-600 dark:bg-white/10" : "border-transparent hover:border-slate-200 hover:bg-black/5 dark:hover:border-slate-700 dark:hover:bg-white/10"}`}>
            Thread
          </button>
          <button type="button" onClick={() => toggleReaction(message._id, "👍")} className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 hover:border-slate-200 hover:bg-black/5 dark:hover:border-slate-700 dark:hover:bg-white/10">
            <SmilePlus size={11} /> React
          </button>
          <button type="button" onClick={() => togglePin(message._id)} className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 hover:border-slate-200 hover:bg-black/5 dark:hover:border-slate-700 dark:hover:bg-white/10">
            <Pin size={11} /> {message.pinned ? "Unpin" : "Pin"}
          </button>
          {message.fileUrl ? (
            <button type="button" onClick={handleDownload} className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-black/10 dark:hover:bg-white/10">
              <Download size={11} /> Save
            </button>
          ) : null}
          {message.failed ? (
            <button type="button" onClick={() => retryFailedMessage(message._id)} className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-1 text-red-200">
              <RefreshCw size={11} /> Retry
            </button>
          ) : null}
        </div>

        <div className={`mt-2 text-right text-[10px] ${mine ? "text-emerald-100/70" : "text-slate-300/70"}`}>
          {dayjs(message.createdAt).format("hh:mm A")}
          {mine ? ` • ${deliveryMark} ${readCount > 1 ? `Seen by ${readCount - 1}` : message.sending ? "Sending" : "Sent"}` : ""}
        </div>
      </div>
    </motion.div>
  );
}
