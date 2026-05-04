import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { useChatStore } from "../../store/chatStore";

const getUserStatusText = (user) => {
  if (user.bio) return user.bio;
  if (user.isOnline) return "Online now";
  if (user.lastSeen) return `Last seen ${dayjs(user.lastSeen).fromNow?.() || dayjs(user.lastSeen).format("DD MMM")}`;
  return "Tap to start a chat";
};

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const { searchUsers, searchResults, openOrCreatePrivateChat } = useChatStore();

  const onChange = (value) => {
    setQuery(value);
    searchUsers(value);
  };

  useEffect(() => {
    const focusInput = () => inputRef.current?.focus();
    globalThis.addEventListener("chatwave:focus-search", focusInput);
    return () => globalThis.removeEventListener("chatwave:focus-search", focusInput);
  }, []);

  return (
    <div>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search teammate"
        className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#818cf8]/60 focus:ring-4 focus:ring-[#818cf8]/10"
      />
      {query && (
        <div className="mt-2 max-h-56 overflow-auto rounded-2xl border border-white/10 bg-[#0f1320]/95 p-2 shadow-[0_18px_35px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          {searchResults.map((user) => (
            <button
              key={user._id}
              onClick={() => {
                openOrCreatePrivateChat(user._id);
                setQuery("");
              }}
              className="block w-full rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-white/10 hover:bg-white/5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{user.name}</div>
                  <div className="truncate text-xs text-white/55">{getUserStatusText(user)}</div>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${user.isOnline ? "bg-emerald-400" : "bg-slate-400"}`} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
