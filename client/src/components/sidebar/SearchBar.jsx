import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { useChatStore } from "../../store/chatStore";

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
    window.addEventListener("chatwave:focus-search", focusInput);
    return () => window.removeEventListener("chatwave:focus-search", focusInput);
  }, []);

  return (
    <div>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search teammate"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-sky-400/60 focus:ring-4 focus:ring-sky-400/10"
      />
      {query && (
        <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-white/10 bg-[#121621] p-2 shadow-[0_18px_35px_rgba(0,0,0,0.25)]">
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
                  <div className="truncate text-xs text-white/55">
                    {user.bio || (user.isOnline ? "Online now" : user.lastSeen ? `Last seen ${dayjs(user.lastSeen).fromNow?.() || dayjs(user.lastSeen).format("DD MMM")}` : "Tap to start a chat")}
                  </div>
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
