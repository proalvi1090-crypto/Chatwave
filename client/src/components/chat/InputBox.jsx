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
    <form onSubmit={submit} className="relative border-t border-white/10 bg-black/20 p-2 md:p-4 backdrop-blur-xl">
      {showEmoji && (
        <div className="absolute bottom-20 left-4 z-20">
          <Picker
            data={data}
            previewPosition="none"
            theme="dark"
            onEmojiSelect={(emojiData) => setContent((prev) => prev + (emojiData?.native || ""))}
          />
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mx-auto flex max-w-4xl flex-col gap-2"
      >
        {replyingTo ? (
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm shadow-sm backdrop-blur-md">
            <div className="min-w-0 pr-3">
              <p className="label-caps mb-0.5 text-brand-100/60">Replying to {replyingTo.sender?.name || "message"}</p>
              <p className="truncate font-medium text-white">{replyingTo.content || replyingTo.fileName || "Attachment"}</p>
            </div>
            <button type="button" onClick={() => setReplyingTo(null)} className="rounded-full bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Cancel reply">
              <X size={16} />
            </button>
          </div>
        ) : null}

        {file ? (
          <div className="flex items-center justify-between rounded-2xl border border-brand-100/30 bg-brand-200/10 px-4 py-2 text-sm shadow-sm backdrop-blur-md">
            <div className="min-w-0 pr-3">
              <p className="truncate font-medium text-white">{file.name}</p>
              <p className="text-xs text-white/60">{Math.ceil(file.size / 1024)} KB</p>
            </div>
            <button type="button" onClick={() => setFile(null)} className="rounded-full bg-white/10 p-1.5 text-white/70 hover:bg-white/20 hover:text-white" aria-label="Remove file">
              <X size={16} />
            </button>
          </div>
        ) : null}
        <div className="flex min-h-[56px] items-center gap-1.5 rounded-full border border-white/10 bg-black/40 p-1.5 shadow-inner backdrop-blur-xl">
          <button type="button" onClick={() => setShowEmoji((p) => !p)} className="rounded-full bg-white/5 p-2.5 text-white/80 transition hover:bg-white/20 hover:text-white" aria-label="Emoji picker">
            <Smile size={18} />
          </button>
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Message..."
            className="flex-1 bg-transparent px-3 py-2 text-[15px] font-medium text-white outline-none placeholder:text-white/40"
          />
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/5 p-2.5 text-sm font-semibold text-white/80 shadow-sm transition hover:bg-white/20 hover:text-white md:px-4 md:py-2.5">
            <Paperclip size={16} />
            <span className="hidden md:inline">Attach</span>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
          </label>
          <Button type="submit" disabled={!canSend} className="h-full rounded-full brand-gradient px-4 py-2 font-bold text-white shadow-lg shadow-[#c0c1ff]/20 disabled:cursor-not-allowed disabled:opacity-50 md:px-6">
            <span className="hidden md:inline">Send</span>
            <Send size={16} className="md:hidden" />
          </Button>
        </div>
      </motion.div>
    </form>
  );
}
