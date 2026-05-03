import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import MessageBubble from "./MessageBubble";
import InputBox from "./InputBox";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { useSocketStore } from "../../store/socketStore";
import Avatar from "../ui/Avatar";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  ChevronDown,
  FilterX,
  History,
  Images,
  Mic,
  MicOff,
  MoreVertical,
  Phone,
  PhoneOff,
  Search,
  SlidersHorizontal,
  Video
} from "lucide-react";

const getConversationLabel = (conversation, userId) => {
  if (!conversation) return "";
  if (conversation.isGroup) return conversation.name || "Unnamed group";
  return conversation.participants?.find((participant) => participant._id !== userId)?.name || "Private chat";
};

export default function ChatWindow({ onBack }) {
  const [showGallery, setShowGallery] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showOptionsPanel, setShowOptionsPanel] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [callStatus, setCallStatus] = useState("idle");
  const [callType, setCallType] = useState("audio");
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCallUserId, setActiveCallUserId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const quickMenuRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const { user } = useAuthStore();
  const { socket } = useSocketStore();
  const {
    activeConversation,
    messages,
    typingUsers,
    threadRootId,
    messageFilters,
    setMessageFilters,
    setThreadRootId,
    markSeen,
    loadMessages,
    downloadHistory,
    clearDownloadHistory
  } = useChatStore();
  const messagesListRef = useRef(null);
  const safeMessages = Array.isArray(messages) ? messages : [];

  useEffect(() => {
    if (!messagesListRef.current) return;
    messagesListRef.current.scrollTo({
      top: messagesListRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [safeMessages]);

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(event.target)) {
        setShowQuickMenu(false);
      }
    };
    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, []);

  useEffect(() => {
    const myId = user?.id || user?._id;
    safeMessages.forEach((message) => {
      if (!message?._id || String(message.sender?._id) === String(myId) || String(message._id).startsWith("temp-")) return;
      const seen = (message.seenBy || []).some((entry) => String(entry) === String(myId));
      if (!seen) markSeen(message._id);
    });
  }, [safeMessages, user, markSeen]);

  useQuery({
    queryKey: ["messages", activeConversation?._id || "none", messageFilters],
    queryFn: () => loadMessages(activeConversation?._id),
    enabled: Boolean(activeConversation?._id),
    staleTime: 15 * 1000
  });

  const userId = user?.id || user?._id;
  const conversationId = activeConversation?._id;
  const participants = Array.isArray(activeConversation?.participants) ? activeConversation.participants : [];
  const typing = Object.keys(typingUsers).some((key) => key.startsWith(`${conversationId}:`));
  const otherParticipant = participants.find((participant) => participant._id !== userId);
  const typingNames = Object.keys(typingUsers)
    .filter((key) => key.startsWith(`${conversationId}:`))
    .map((key) => key.split(":")[1])
    .filter((id) => String(id) !== String(userId))
    .map((id) => participants.find((participant) => String(participant._id) === String(id))?.name)
    .filter(Boolean);
  const title = getConversationLabel(activeConversation, userId);
  const subtitle = activeConversation?.isGroup
    ? `${participants.length || 0} members`
    : otherParticipant
      ? otherParticipant.isOnline
        ? "Online"
        : otherParticipant.lastSeen
          ? `Last seen ${new Date(otherParticipant.lastSeen).toLocaleString()}`
          : otherParticipant.bio || "Direct conversation"
      : "Direct conversation";
  const remoteUserId = otherParticipant?._id ? String(otherParticipant._id) : null;

  const clearCallMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  const closePeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    pendingCandidatesRef.current = [];
  };

  const finishCall = (reason = "Call ended", notifyRemote = true) => {
    if (notifyRemote && socket && activeCallUserId) {
      socket.emit("call_end", { toUserId: activeCallUserId, reason });
    }
    clearCallMedia();
    closePeerConnection();
    setCallStatus("idle");
    setIncomingCall(null);
    setActiveCallUserId(null);
    setIsMuted(false);
    setIsVideoEnabled(true);
  };

  const createPeerConnection = (targetUserId) => {
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    connection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      remoteStreamRef.current = stream;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    };

    connection.onicecandidate = (event) => {
      if (!event.candidate || !socket || !targetUserId) return;
      socket.emit("call_ice_candidate", {
        toUserId: targetUserId,
        candidate: event.candidate
      });
    };

    peerConnectionRef.current = connection;
    return connection;
  };

  const getUserMedia = async (mode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("media_unsupported");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === "video"
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  };

  const startCall = async (mode) => {
    if (!socket || !remoteUserId) {
      toast.error("No user available for calling");
      return;
    }
    if (activeConversation?.isGroup) {
      toast.error("Group call not enabled yet");
      return;
    }
    socket.emit("call_ring", {
      toUserId: remoteUserId,
      conversationId: activeConversation?._id,
      type: mode,
      fromUserName: user?.name || "Unknown"
    });

    setCallType(mode);
    setCallStatus("calling");
    setActiveCallUserId(remoteUserId);
    setIsVideoEnabled(mode === "video");
    toast.message(`Calling ${otherParticipant?.name || "user"}...`);
  };

  const createAndSendOffer = async (targetUserId, mode) => {
    const stream = await getUserMedia(mode);
    const connection = createPeerConnection(targetUserId);
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    socket.emit("call_offer", {
      toUserId: targetUserId,
      conversationId: activeConversation?._id,
      type: mode,
      offer,
      fromUserName: user?.name || "Unknown"
    });
  };

  const acceptIncomingOffer = async (offerPayload) => {
    const stream = await getUserMedia(offerPayload.type || "audio");
    const targetUserId = offerPayload.fromUserId;
    const connection = createPeerConnection(targetUserId);
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));

    await connection.setRemoteDescription(new RTCSessionDescription(offerPayload.offer));
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    socket.emit("call_answer", {
      toUserId: targetUserId,
      answer
    });

    setCallType(offerPayload.type || "audio");
    setCallStatus("connected");
    setActiveCallUserId(targetUserId);
    setIsVideoEnabled((offerPayload.type || "audio") === "video");
    setIncomingCall(null);

    if (pendingCandidatesRef.current.length) {
      for (const candidate of pendingCandidatesRef.current) {
        // eslint-disable-next-line no-await-in-loop
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
    }
  };

  const acceptIncomingCall = async () => {
    if (!incomingCall || !socket) return;

    if (!incomingCall.offer) {
      socket.emit("call_accept", {
        toUserId: incomingCall.fromUserId,
        type: incomingCall.type || "audio"
      });
      setCallStatus("connecting");
      toast.message("Connecting call...");
      return;
    }

    try {
      await acceptIncomingOffer(incomingCall);
    } catch (error) {
      finishCall("failed", false);
      if (error?.message === "media_unsupported") {
        toast.error("Your browser does not support voice/video calling.");
      } else if (error?.name === "SecurityError") {
        toast.error("Open the app using HTTPS link to allow mic/camera.");
      } else {
        toast.error("Could not accept call. Allow microphone/camera permissions.");
      }
    }
  };

  const declineIncomingCall = () => {
    if (socket && incomingCall?.fromUserId) {
      socket.emit("call_end", { toUserId: incomingCall.fromUserId, reason: "declined" });
    }
    setIncomingCall(null);
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextEnabled = !isVideoEnabled;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsVideoEnabled(nextEnabled);
  };

  useEffect(() => {
    if (!socket) return undefined;

    const onIncomingRing = (payload) => {
      if (!payload?.fromUserId) return;
      if (callStatus !== "idle" || incomingCall) {
        socket.emit("call_end", { toUserId: payload.fromUserId, reason: "busy" });
        return;
      }
      setIncomingCall(payload);
      setCallType(payload.type || "audio");
      setCallStatus("ringing");
      toast.message(`${payload.fromUserName || "Someone"} is calling...`);
    };

    const onIncomingAccept = async ({ fromUserId, type }) => {
      if (!fromUserId || String(fromUserId) !== String(activeCallUserId)) return;
      try {
        await createAndSendOffer(fromUserId, type || callType || "audio");
      } catch (error) {
        finishCall("failed", false);
        socket.emit("call_end", { toUserId: fromUserId, reason: "permission_denied" });
        if (error?.message === "media_unsupported") {
          toast.error("Your browser does not support voice/video calling.");
        } else if (error?.name === "SecurityError") {
          toast.error("Use HTTPS link for voice/video permissions.");
        } else {
          toast.error("Could not start call. Allow microphone/camera permission.");
        }
      }
    };

    const onIncomingOffer = async (payload) => {
      if (!payload?.fromUserId || !payload?.offer) return;
      const acceptedSameCaller = String(incomingCall?.fromUserId) === String(payload.fromUserId) && callStatus === "connecting";
      if (!acceptedSameCaller && callStatus !== "idle") {
        socket.emit("call_end", { toUserId: payload.fromUserId, reason: "busy" });
        return;
      }
      if (acceptedSameCaller) {
        try {
          await acceptIncomingOffer(payload);
        } catch (error) {
          finishCall("failed", false);
          socket.emit("call_end", { toUserId: payload.fromUserId, reason: "permission_denied" });
          if (error?.message === "media_unsupported") {
            toast.error("Your browser does not support voice/video calling.");
          } else if (error?.name === "SecurityError") {
            toast.error("Use HTTPS link for voice/video permissions.");
          } else {
            toast.error("Could not accept call. Allow microphone/camera permissions.");
          }
        }
        return;
      }

      setIncomingCall(payload);
      setCallType(payload.type || "audio");
      setCallStatus("ringing");
    };

    const onIncomingAnswer = async ({ answer, fromUserId }) => {
      if (!answer || !peerConnectionRef.current || String(fromUserId) !== String(activeCallUserId)) return;
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCallStatus("connected");
      toast.success("Call connected");
    };

    const onIncomingIceCandidate = async ({ candidate, fromUserId }) => {
      if (!candidate || String(fromUserId) !== String(activeCallUserId)) return;
      if (!peerConnectionRef.current?.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    };

    const onIncomingCallEnd = ({ fromUserId, reason }) => {
      if (String(fromUserId) !== String(activeCallUserId) && String(fromUserId) !== String(incomingCall?.fromUserId)) return;
      finishCall("ended", false);
      if (reason === "declined") toast.error("Call declined");
      else if (reason === "busy") toast.error("User is busy");
      else if (reason === "permission_denied") toast.error("Other user blocked microphone/camera permission.");
      else toast.message("Call ended");
    };

    socket.on("incoming_call_ring", onIncomingRing);
    socket.on("incoming_call_accept", onIncomingAccept);
    socket.on("incoming_call_offer", onIncomingOffer);
    socket.on("incoming_call_answer", onIncomingAnswer);
    socket.on("incoming_call_ice_candidate", onIncomingIceCandidate);
    socket.on("incoming_call_end", onIncomingCallEnd);

    return () => {
      socket.off("incoming_call_ring", onIncomingRing);
      socket.off("incoming_call_accept", onIncomingAccept);
      socket.off("incoming_call_offer", onIncomingOffer);
      socket.off("incoming_call_answer", onIncomingAnswer);
      socket.off("incoming_call_ice_candidate", onIncomingIceCandidate);
      socket.off("incoming_call_end", onIncomingCallEnd);
    };
  }, [socket, callStatus, incomingCall, activeCallUserId, callType]);

  useEffect(() => {
    return () => {
      finishCall("unmount", false);
    };
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [callStatus, callType]);

  const pinnedCount = safeMessages.filter((message) => message?.pinned).length;
  const mediaMessages = useMemo(
    () => safeMessages.filter((message) => message?.fileUrl && (message.type === "image" || message.type === "file")),
    [safeMessages]
  );
  const threadMessages = useMemo(() => {
    if (!threadRootId) return [];
    return safeMessages.filter((message) => {
      const messageId = String(message._id);
      const replyToId = message.replyTo?._id ? String(message.replyTo._id) : message.replyTo ? String(message.replyTo) : "";
      return messageId === String(threadRootId) || replyToId === String(threadRootId);
    });
  }, [safeMessages, threadRootId]);
  const threadRoot = safeMessages.find((message) => String(message._id) === String(threadRootId));

  const wallpaperClass =
    activeConversation?.wallpaper === "sunset"
      ? "bg-[radial-gradient(circle_at_15%_15%,rgba(255,191,128,0.16),transparent_30%),linear-gradient(160deg,#131722_0%,#171c28_45%,#10131a_100%)]"
      : activeConversation?.wallpaper === "forest"
        ? "bg-[radial-gradient(circle_at_18%_15%,rgba(102,187,106,0.14),transparent_30%),linear-gradient(160deg,#111723_0%,#121b28_45%,#10131a_100%)]"
        : "bg-[radial-gradient(circle_at_18%_15%,rgba(74,222,222,0.12),transparent_30%),linear-gradient(160deg,#121822_0%,#0f131b_50%,#0f1219_100%)]";

  const resetFilters = () => {
    setMessageFilters({ q: "", type: "all", pinnedOnly: false, sender: "all", hasFile: false, from: "", to: "" });
  };

  if (!activeConversation) {
    return (
      <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-white/10 p-6 text-center text-white/60">
        Select or start a conversation
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#10131a] text-white">
      <div className="relative border-b border-white/10 bg-[#151922] px-3 py-2.5 md:px-4 md:py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-white/80 lg:hidden"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
              <span className="text-xs font-medium">Back</span>
            </button>
            <Avatar src={activeConversation.groupIcon} name={title} />
            <div>
              <h2 className="font-display text-lg font-semibold leading-tight md:text-xl">{title}</h2>
              <p className="text-xs text-white/60 md:text-sm">{subtitle}</p>
            </div>
          </div>
          <div className="relative flex items-center gap-2" ref={quickMenuRef}>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
              {typing ? "Typing..." : "Live"}
            </div>
            <button
              type="button"
              onClick={() => startCall("audio")}
              disabled={!remoteUserId || callStatus !== "idle"}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Voice call"
            >
              <Phone size={16} />
            </button>
            <button
              type="button"
              onClick={() => startCall("video")}
              disabled={!remoteUserId || callStatus !== "idle"}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Video call"
            >
              <Video size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowQuickMenu((prev) => !prev)}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70"
              aria-label="Chat options"
            >
              <MoreVertical size={16} />
            </button>
            {showQuickMenu ? (
              <div className="absolute right-0 top-11 z-20 w-52 rounded-xl border border-white/10 bg-[#121621] p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsPanel((v) => !v);
                    setShowQuickMenu(false);
                  }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 ${showOptionsPanel ? "bg-sky-500/15 text-sky-200" : "text-white/80"}`}
                >
                  Message options {showOptionsPanel ? "ON" : "OFF"}
                </button>
                <button type="button" onClick={() => { setShowGallery((v) => !v); setShowQuickMenu(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5">Gallery ({mediaMessages.length})</button>
                <button type="button" onClick={() => { setShowHistory((v) => !v); setShowQuickMenu(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5">Downloads ({downloadHistory.length})</button>
                <button type="button" onClick={() => { resetFilters(); setShowQuickMenu(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5">Reset filters</button>
              </div>
            ) : null}
          </div>
        </div>
        {typing ? (
          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#7dd3fc] md:text-xs">
            <span>{typingNames.length ? `${typingNames.slice(0, 2).join(", ")} typing` : "Someone is typing"}</span>
            <span className="inline-flex gap-0.5">
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#7dd3fc]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#7dd3fc] [animation-delay:120ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#7dd3fc] [animation-delay:240ms]" />
            </span>
          </p>
        ) : null}
      </div>

      {showOptionsPanel ? (
      <div className="border-b border-white/10 bg-[#10131a] px-3 py-2 md:px-4 md:py-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Search size={14} className="text-white/70 opacity-70" />
            <input
              value={messageFilters.q}
              onChange={(e) => setMessageFilters({ q: e.target.value })}
              placeholder="Search messages"
              className="w-[130px] bg-transparent text-sm text-white outline-none placeholder:text-white/40 sm:w-[160px] md:w-[260px] lg:w-[300px]"
            />
          </div>
          <select
            value={messageFilters.type}
            onChange={(e) => setMessageFilters({ type: e.target.value })}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="all">All</option>
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="file">File</option>
          </select>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
          >
            <SlidersHorizontal size={14} /> Filters
            <ChevronDown size={14} className={`transition ${showAdvancedFilters ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setMessageFilters({ pinnedOnly: !messageFilters.pinnedOnly })}
            className={`rounded-xl border px-3 py-2 text-sm ${messageFilters.pinnedOnly ? "border-sky-400/60 bg-sky-400/10 text-sky-200" : "border-white/10 bg-white/5 text-white/80"}`}
          >
            Pinned
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
          >
            <FilterX size={14} /> Reset
          </button>
        </div>

        {showAdvancedFilters ? (
          <div className="mt-2 grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 md:grid-cols-4">
            <select
              value={messageFilters.sender}
              onChange={(e) => setMessageFilters({ sender: e.target.value })}
              className="rounded-xl border border-white/10 bg-[#0f131b] px-3 py-2 text-sm text-white outline-none"
            >
              <option value="all">Any sender</option>
              {participants.map((participant) => (
                <option key={participant._id} value={participant._id}>{participant.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={messageFilters.from}
              onChange={(e) => setMessageFilters({ from: e.target.value })}
              className="rounded-xl border border-white/10 bg-[#0f131b] px-3 py-2 text-sm text-white outline-none"
            />
            <input
              type="date"
              value={messageFilters.to}
              onChange={(e) => setMessageFilters({ to: e.target.value })}
              className="rounded-xl border border-white/10 bg-[#0f131b] px-3 py-2 text-sm text-white outline-none"
            />
            <button
              type="button"
              onClick={() => setMessageFilters({ hasFile: !messageFilters.hasFile })}
              className={`rounded-xl border px-3 py-2 text-sm ${messageFilters.hasFile ? "border-sky-400/60 bg-sky-400/10 text-sky-200" : "border-white/10 bg-[#0f131b] text-white/80"}`}
            >
              With file
            </button>
          </div>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowGallery((prev) => !prev)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80">
            <Images size={12} /> Gallery ({mediaMessages.length})
          </button>
          <button type="button" onClick={() => setShowHistory((prev) => !prev)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80">
            <History size={12} /> Downloads ({downloadHistory.length})
          </button>
          {threadRootId ? (
            <button type="button" onClick={() => setThreadRootId(null)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80">
              <FilterX size={12} /> Exit thread
            </button>
          ) : null}
          {pinnedCount > 0 ? <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs text-amber-200">{pinnedCount} pinned</span> : null}
        </div>
      </div>
      ) : null}

      {incomingCall && callStatus === "ringing" ? (
        <div className="border-b border-sky-400/30 bg-sky-500/10 px-4 py-3 text-white">
          <p className="text-sm font-semibold">{incomingCall.fromUserName || "Someone"} is calling ({incomingCall.type === "video" ? "video" : "voice"})</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={acceptIncomingCall}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
            >
              <Phone size={14} /> Accept
            </button>
            <button
              type="button"
              onClick={declineIncomingCall}
              className="inline-flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white"
            >
              <PhoneOff size={14} /> Decline
            </button>
          </div>
        </div>
      ) : null}

      {callStatus !== "idle" && !incomingCall ? (
        <div className="border-b border-white/10 bg-[#0f1420] px-4 py-3 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{callType === "video" ? "Video call" : "Voice call"}</p>
              <p className="text-xs text-white/60">{callStatus === "calling" ? "Ringing..." : "Connected"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className={`rounded-full border px-3 py-2 text-xs ${isMuted ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-white/10 bg-white/5 text-white/80"}`}
              >
                {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              {callType === "video" ? (
                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`rounded-full border px-3 py-2 text-xs ${!isVideoEnabled ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-white/10 bg-white/5 text-white/80"}`}
                >
                  {isVideoEnabled ? <Camera size={14} /> : <CameraOff size={14} />}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => finishCall("ended", true)}
                className="rounded-full bg-red-500 px-3 py-2 text-xs font-semibold text-white"
              >
                <PhoneOff size={14} />
              </button>
            </div>
          </div>

          {callType === "video" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-28 w-full rounded-xl border border-white/10 bg-black object-cover"
              />
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="h-28 w-full rounded-xl border border-white/10 bg-black object-cover"
              />
            </div>
          ) : (
            <audio ref={remoteVideoRef} autoPlay />
          )}
        </div>
      ) : null}

      {threadRootId ? (
        <div className="border-b border-white/10 bg-[#121621] px-4 py-3 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Reply thread</p>
          <p className="mt-1 truncate text-sm font-medium text-white">{threadRoot?.content || threadRoot?.fileName || "Thread root message"}</p>
          <p className="text-xs text-white/45">{threadMessages.length} messages</p>
        </div>
      ) : null}

      {showGallery ? (
        <div className="max-h-40 overflow-y-auto border-b border-white/10 px-4 py-3">
          <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
            {mediaMessages.map((message) => (
              <a key={`media-${message._id}`} href={message.fileUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-white/10 bg-white/5 p-1">
                {message.type === "image" ? (
                  <img src={message.fileUrl} alt={message.fileName || "image"} className="h-16 w-full rounded-lg object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-16 items-center justify-center rounded-lg bg-white/5 text-xs text-white/70">{message.fileName || "File"}</div>
                )}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {showHistory ? (
        <div className="max-h-40 overflow-y-auto border-b border-white/10 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">Download history</p>
            <button type="button" onClick={clearDownloadHistory} className="text-xs text-red-300">Clear</button>
          </div>
          <div className="space-y-2">
            {downloadHistory.map((entry) => (
              <a key={entry.id} href={entry.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
                <span className="truncate pr-3">{entry.fileName}</span>
                <span className="text-white/45">{new Date(entry.downloadedAt).toLocaleDateString()}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div ref={messagesListRef} className={`min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-5 ${wallpaperClass}`}>
        <div className="mx-auto w-full max-w-[1040px] space-y-1.5">
          {(threadRootId ? threadMessages : safeMessages).map((message) => (
            <MessageBubble
              key={message._id}
              message={message}
              me={user}
              onOpenThread={() => setThreadRootId(message.replyTo?._id || message._id)}
              threadActive={String(threadRootId) === String(message._id)}
            />
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-white/10 bg-[#0f131b]">
        <InputBox />
      </div>
    </div>
  );
}
