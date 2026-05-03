import Avatar from "../ui/Avatar";
import { BellOff, BellRing, Star } from "lucide-react";
import { useChatStore } from "../../store/chatStore";

export default function GroupInfo({ conversation }) {
  const { toggleFavoriteConversation, toggleMuteConversation, setWallpaper } = useChatStore();
  const currentUserId = localStorage.getItem("userId");

  if (!conversation) {
    return (
      <div className="rounded-[1.4rem] border border-white/10 bg-[#121621] p-4 text-white shadow-[0_20px_45px_rgba(0,0,0,0.25)]">
        <h3 className="font-display text-lg font-semibold">Chat insights</h3>
        <p className="mt-2 text-sm text-white/55">Open a conversation to see participants, group info, and quick context here.</p>
      </div>
    );
  }

  const isMuted = conversation.mutedBy?.some((id) => String(id) === String(currentUserId));
  const isFavorite = conversation.favoriteBy?.some((id) => String(id) === String(currentUserId));

  const Preferences = (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white">
      <p className="text-xs uppercase tracking-[0.25em] text-white/45">Personalize</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => toggleFavoriteConversation(conversation._id)}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ${isFavorite ? "bg-amber-400/20 text-amber-100" : "bg-white/5 text-white/70"}`}
        >
          <Star size={12} className={isFavorite ? "fill-amber-400" : ""} /> {isFavorite ? "Favorite" : "Mark favorite"}
        </button>
        <button
          type="button"
          onClick={() => toggleMuteConversation(conversation._id)}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ${isMuted ? "bg-red-400/20 text-red-100" : "bg-white/5 text-white/70"}`}
        >
          {isMuted ? <BellOff size={12} /> : <BellRing size={12} />} {isMuted ? "Muted" : "Mute"}
        </button>
      </div>

      <div className="mt-3">
        <p className="text-xs text-white/45">Wallpaper</p>
        <select
          value={conversation.wallpaper || "aurora"}
          onChange={(e) => setWallpaper(conversation._id, e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-[#0f131b] px-2 py-1.5 text-sm text-white"
        >
          <option value="aurora">Aurora</option>
          <option value="sunset">Sunset</option>
          <option value="forest">Forest</option>
        </select>
      </div>
    </div>
  );

  if (!conversation.isGroup) {
    const currentUserId = localStorage.getItem("userId");
    const participant = conversation.participants?.find((entry) => entry._id !== currentUserId) || conversation.participants?.[0];
    return (
      <div className="rounded-[1.4rem] border border-white/10 bg-[#121621] p-4 text-white shadow-[0_20px_45px_rgba(0,0,0,0.25)]">
        <div className="mb-3 flex items-center gap-3">
          <Avatar src={participant?.profilePic} name={participant?.name || conversation.name || "Direct chat"} size="lg" />
          <div>
            <h3 className="font-display text-lg font-semibold">{participant?.name || conversation.name || "Direct chat"}</h3>
            <p className="text-xs text-white/55">Private conversation</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
          <p className="font-medium">Quick notes</p>
          <p className="mt-1 text-xs text-white/55">Use this space for pinned context, task links, or callouts once you extend the project.</p>
        </div>
        {Preferences}
      </div>
    );
  }

  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-[#121621] p-4 text-white shadow-[0_20px_45px_rgba(0,0,0,0.25)]">
      <div className="mb-3 flex items-center gap-3">
        <Avatar src={conversation.groupIcon} name={conversation.name} size="lg" />
        <div>
          <h3 className="font-display text-lg font-semibold">{conversation.name}</h3>
          <p className="text-xs text-white/55">{conversation.participants?.length || 0} members</p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
        <p className="text-xs uppercase tracking-[0.25em] text-white/45">Admin</p>
        <p className="mt-1 font-medium">{conversation.admin?.name || "Unknown"}</p>
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
        <p className="text-xs uppercase tracking-[0.25em] text-white/45">Members</p>
        <div className="mt-2 space-y-2">
          {conversation.participants?.map((participant) => (
            <div key={participant._id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5">
              <span className="truncate font-medium">{participant.name}</span>
              <span className={`h-2.5 w-2.5 rounded-full ${participant.isOnline ? "bg-emerald-400" : "bg-slate-500"}`} />
            </div>
          ))}
        </div>
      </div>
      {Preferences}
    </div>
  );
}
