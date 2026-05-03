import { Conversation } from "../models/Conversation.model.js";
import { Message } from "../models/Message.model.js";
import { User } from "../models/User.model.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";
import { getIo, emitToConversation } from "../socket/socket.handler.js";
import { sendPushNotification } from "../services/notification.service.js";

const messagePopulate = [
  { path: "sender", select: "name profilePic bio" },
  { path: "replyTo", populate: { path: "sender", select: "name profilePic" } }
];

const verifyParticipant = (conversation, userId) =>
  conversation.participants.some((p) => p.toString() === userId.toString());

const loadMessageWithPopulate = (messageId) => Message.findById(messageId).populate(messagePopulate);

const toDateBoundary = (value, boundary) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const hasTime = raw.includes("T");
  const date = new Date(hasTime ? raw : `${raw}${boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z"}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getMessagesByConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);

    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!verifyParticipant(conversation, req.user._id)) return res.status(403).json({ message: "Forbidden" });

    const q = req.query.q?.trim();
    const sender = req.query.sender?.trim();
    const type = req.query.type?.trim();
    const pinned = req.query.pinned;
    const from = req.query.from;
    const to = req.query.to;
    const hasFile = req.query.hasFile;
    const filter = { conversation: conversation._id, deletedFor: { $ne: req.user._id } };

    if (q) {
      filter.$or = [
        { content: { $regex: q, $options: "i" } },
        { fileName: { $regex: q, $options: "i" } }
      ];
    }
    if (sender) filter.sender = sender;
    if (type && type !== "all") filter.type = type;
    if (pinned === "true") filter.pinned = true;
    if (hasFile === "true") filter.fileUrl = { $ne: "" };
    if (from || to) {
      const fromDate = toDateBoundary(from, "start");
      const toDate = toDateBoundary(to, "end");
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = fromDate;
      if (toDate) filter.createdAt.$lte = toDate;

      if (!fromDate && from) return res.status(400).json({ message: "Invalid from date" });
      if (!toDate && to) return res.status(400).json({ message: "Invalid to date" });
    }

    const messages = await Message.find(filter).populate(messagePopulate).sort({ createdAt: 1 }).limit(200);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, type = "text", replyTo, clientId = "" } = req.body;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!verifyParticipant(conversation, req.user._id)) return res.status(403).json({ message: "Forbidden" });

    let fileUrl = "";
    let fileName = "";
    let finalType = type;

    if (req.file) {
      const resourceType = req.file.mimetype.startsWith("image/") ? "image" : "raw";
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, "chatwave/messages", resourceType);
      fileUrl = uploaded.secure_url;
      fileName = req.file.originalname;
      finalType = req.file.mimetype.startsWith("image/") ? "image" : "file";
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      content: content || "",
      type: finalType,
      fileUrl,
      fileName,
      clientId,
      replyTo: replyTo || null,
      seenBy: [req.user._id]
    });

    conversation.lastMessage = message._id;
    await conversation.save();

    const populated = await loadMessageWithPopulate(message._id);
    emitToConversation(conversation._id.toString(), "new_message", populated);

    const recipients = conversation.participants.filter((p) => p.toString() !== req.user._id.toString());
    const users = await User.find({ _id: { $in: recipients } }).select("pushSubscription");

    users.forEach((user) => {
      sendPushNotification(user.pushSubscription, {
        title: "New message",
        body: content || fileName || "Media message"
      });
    });

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const toggleReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: "emoji required" });

    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const conversation = await Conversation.findById(message.conversation).select("participants");
    if (!conversation || !verifyParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const uid = req.user._id.toString();
    const reaction = message.reactions.find((r) => r.emoji === emoji);
    if (!reaction) {
      message.reactions.push({ emoji, users: [req.user._id] });
    } else {
      const has = reaction.users.some((u) => u.toString() === uid);
      if (has) reaction.users = reaction.users.filter((u) => u.toString() !== uid);
      else reaction.users.push(req.user._id);
      if (reaction.users.length === 0) {
        message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
      }
    }

    await message.save();
    const populated = await loadMessageWithPopulate(message._id);
    emitToConversation(message.conversation.toString(), "message_updated", populated);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const togglePin = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const conversation = await Conversation.findById(message.conversation).select("participants");
    if (!conversation || !verifyParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    message.pinned = !message.pinned;
    message.pinnedAt = message.pinned ? new Date() : null;
    message.pinnedBy = message.pinned ? req.user._id : null;
    await message.save();

    const populated = await loadMessageWithPopulate(message._id);
    emitToConversation(message.conversation.toString(), "message_updated", populated);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Can delete only own messages" });
    }

    message.deletedFor = Array.from(new Set([...message.deletedFor.map(String), req.user._id.toString()]));
    await message.save();

    const io = getIo();
    io.to(message.conversation.toString()).emit("message_deleted", { messageId: message._id, userId: req.user._id });

    res.json({ message: "Deleted for self" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const markMessageSeen = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (!message.seenBy.some((id) => id.toString() === req.user._id.toString())) {
      message.seenBy.push(req.user._id);
      await message.save();
    }

    const io = getIo();
    io.to(message.conversation.toString()).emit("message_seen", {
      messageId: message._id,
      seenBy: message.seenBy
    });

    res.json({ message: "Seen updated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
