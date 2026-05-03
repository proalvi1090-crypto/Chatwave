import { useEffect, useMemo, useRef, useState } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { motion } from "framer-motion";
import { Paperclip, Smile, Send, X } from "lucide-react";
import Button from "../ui/Button";
import { useChatStore } from "../../store/chatStore";
import { useSocketStore } from "../../store/socketStore";

export default function InputBox() {
  const [content, setContent] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [file, setFile] = useState(null);
  const typingRef = useRef(false);

  const { activeConversation, sendMessage, replyingTo, setReplyingTo } = useChatStore();
  const { socket } = useSocketStore();

  const canSend = useMemo(() => activeConversation && (content.trim() || file), [activeConversation, content, file]);

  useEffect(() => {
    if (!socket || !activeConversation) return;

    if (content.trim() && !typingRef.current) {
      typingRef.current = true;
      socket.emit("typing_start", activeConversation._id);
    }

    if (!content.trim() && typingRef.current) {
      typingRef.current = false;
      socket.emit("typing_stop", activeConversation._id);
    }
  }, [content, socket, activeConversation]);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSend) return;

    try {
      await sendMessage({
        conversationId: activeConversation._id,
        content,
        file,
        replyTo: replyingTo?._id || null
      });
    } catch {
      // Optimistic queue handles retries and failed state badges.
    }

    if (socket) socket.emit("typing_stop", activeConversation._id);
    setContent("");
    setFile(null);
    typingRef.current = false;
  };

  return (
    <form onSubmit={submit} className="relative border-t border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
      {showEmoji && (
        <div className="absolute bottom-14 left-2 z-20">
          <Picker
            data={data}
            previewPosition="none"
            onEmojiSelect={(emojiData) => setContent((prev) => prev + (emojiData?.native || ""))}
          />
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-1.5"
      >
        {replyingTo ? (
          <div className="flex items-center justify-between rounded-xl border border-white/20 bg-white/60 px-2.5 py-1 text-xs shadow-sm dark:bg-slate-900/50">
            <div className="min-w-0 pr-3">
              <p className="text-xs uppercase tracking-[0.2em] opacity-60">Replying</p>
              <p className="truncate font-medium">{replyingTo.content || replyingTo.fileName || "Attachment"}</p>
            </div>
            <button type="button" onClick={() => setReplyingTo(null)} className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Cancel reply">
              <X size={16} />
            </button>
          </div>
        ) : null}

        {file ? (
          <div className="flex items-center justify-between rounded-xl border border-white/20 bg-white/60 px-2.5 py-1 text-xs shadow-sm dark:bg-slate-900/50">
            <div className="min-w-0 pr-3">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-xs opacity-70">{Math.ceil(file.size / 1024)} KB</p>
            </div>
            <button type="button" onClick={() => setFile(null)} className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Remove file">
              <X size={16} />
            </button>
          </div>
        ) : null}
        <div className="flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button type="button" onClick={() => setShowEmoji((p) => !p)} className="rounded-lg bg-white p-1.5 transition hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600" aria-label="Emoji picker">
            <Smile size={16} />
          </button>
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type a message"
            className="flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400"
          />
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
            <Paperclip size={14} />
            <span className="hidden lg:inline">Attach</span>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
          </label>
          <Button type="submit" disabled={!canSend} className="rounded-lg bg-[#3390ec] px-2.5 py-1.5 text-sm text-white hover:bg-[#2f85da] disabled:cursor-not-allowed disabled:opacity-50">
            <span className="hidden md:inline">Send</span>
            <Send size={15} className="md:hidden" />
          </Button>
        </div>
      </motion.div>
    </form>
  );
}
