import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";
import { Conversation } from "../models/Conversation.model.js";
import { Message } from "../models/Message.model.js";
import { getRedisClient } from "../services/redis.service.js";

let ioRef;
const userSockets = new Map();

const addUserSocket = (userId, socketId) => {
  const sockets = userSockets.get(userId) || new Set();
  sockets.add(socketId);
  userSockets.set(userId, sockets);
};

const removeUserSocket = (userId, socketId) => {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) userSockets.delete(userId);
};

export const emitToUser = (userId, event, payload) => {
  const sockets = userSockets.get(userId.toString());
  if (!sockets || !ioRef) return;
  sockets.forEach((socketId) => ioRef.to(socketId).emit(event, payload));
};

export const emitToConversation = async (conversationId, event, payload) => {
  if (!ioRef) return;
  ioRef.to(conversationId).emit(event, payload);
};

export const getIo = () => ioRef;

const markOnline = async (userId) => {
  const redis = getRedisClient();
  if (redis?.status === "ready") await redis.set(`online:${userId}`, "1");

  await User.findByIdAndUpdate(userId, { isOnline: true });
  ioRef.emit("user_online", userId);
};

const markOffline = async (userId) => {
  const redis = getRedisClient();
  if (redis?.status === "ready") await redis.del(`online:${userId}`);

  const lastSeen = new Date();
  await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
  ioRef.emit("user_offline", { userId, lastSeen });
};

export const initSocket = (io) => {
  ioRef = io;

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.sub;
      next();
    } catch (err) {
      console.error("Socket auth error:", err.message);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId.toString();
    addUserSocket(userId, socket.id);
    await markOnline(userId);

    socket.on("join_conversation", async (conversationId) => {
      const conversation = await Conversation.findById(conversationId).select("participants");
      if (!conversation) return;

      const isMember = conversation.participants.some((id) => id.toString() === userId);
      if (!isMember) return;

      socket.join(conversationId);
    });

    socket.on("send_message", async ({ conversationId, content, type = "text", replyTo = null }) => {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      const isMember = conversation.participants.some((id) => id.toString() === userId);
      if (!isMember) return;

      const message = await Message.create({
        content,
        type,
        sender: userId,
        conversation: conversationId,
        replyTo,
        seenBy: [userId]
      });

      conversation.lastMessage = message._id;
      await conversation.save();

      const populated = await Message.findById(message._id)
        .populate({ path: "sender", select: "name profilePic bio" })
        .populate({ path: "replyTo", populate: { path: "sender", select: "name profilePic" } });

      io.to(conversationId).emit("new_message", populated);
    });

    socket.on("typing_start", (conversationId) => {
      socket.to(conversationId).emit("user_typing", { userId, conversationId });
    });

    socket.on("typing_stop", (conversationId) => {
      socket.to(conversationId).emit("user_stop_typing", { userId, conversationId });
    });

    socket.on("mark_seen", async (messageId) => {
      const message = await Message.findById(messageId);
      if (!message) return;

      if (!message.seenBy.some((id) => id.toString() === userId)) {
        message.seenBy.push(userId);
        await message.save();
      }

      io.to(message.conversation.toString()).emit("message_seen", {
        messageId: message._id,
        seenBy: message.seenBy
      });
    });

    socket.on("call_offer", ({ toUserId, conversationId, type = "audio", offer, fromUserName }) => {
      if (!toUserId || !offer) return;
      emitToUser(toUserId, "incoming_call_offer", {
        fromUserId: userId,
        fromUserName: fromUserName || "Unknown",
        conversationId,
        type,
        offer
      });
    });

    socket.on("call_ring", ({ toUserId, conversationId, type = "audio", fromUserName }) => {
      if (!toUserId) return;
      emitToUser(toUserId, "incoming_call_ring", {
        fromUserId: userId,
        fromUserName: fromUserName || "Unknown",
        conversationId,
        type
      });
    });

    socket.on("call_accept", ({ toUserId, type = "audio" }) => {
      if (!toUserId) return;
      emitToUser(toUserId, "incoming_call_accept", {
        fromUserId: userId,
        type
      });
    });

    socket.on("call_answer", ({ toUserId, answer }) => {
      if (!toUserId || !answer) return;
      emitToUser(toUserId, "incoming_call_answer", {
        fromUserId: userId,
        answer
      });
    });

    socket.on("call_ice_candidate", ({ toUserId, candidate }) => {
      if (!toUserId || !candidate) return;
      emitToUser(toUserId, "incoming_call_ice_candidate", {
        fromUserId: userId,
        candidate
      });
    });

    socket.on("call_end", ({ toUserId, reason = "ended" }) => {
      if (!toUserId) return;
      emitToUser(toUserId, "incoming_call_end", {
        fromUserId: userId,
        reason
      });
    });

    socket.on("disconnect", async () => {
      removeUserSocket(userId, socket.id);
      if (!userSockets.has(userId)) {
        await markOffline(userId);
      }
    });
  });
};
