import { Conversation } from "../models/Conversation.model.js";
import { Message } from "../models/Message.model.js";
import { User } from "../models/User.model.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";
import { getIo, emitToConversation } from "../socket/socket.handler.js";
import { sendPushNotification } from "../services/notification.service.js";
import {
  MAX_MESSAGES_PER_QUERY,
  ERROR_MESSAGES,
  HTTP_STATUS,
  CLOUDINARY_RESOURCE_TYPES,
  MESSAGE_TYPES,
  SOCKET_EVENTS
} from "../utils/constants.js";
import {
  sendNotFound,
  sendForbidden,
  sendBadRequest,
  sendSuccessResponse,
  handleCatchError
} from "../utils/responseHandler.js";
import {
  extractMessageFilters,
  buildMessageFilter,
  buildDateFilter
} from "../utils/queryHelpers.js";

const messagePopulate = [
  { path: "sender", select: "name profilePic bio" },
  { path: "replyTo", populate: { path: "sender", select: "name profilePic" } }
];

/**
 * Verify if user is a participant in the conversation
 */
const verifyParticipant = (conversation, userId) =>
  conversation.participants.some((p) => p.toString() === userId.toString());

/**
 * Load message with all populated fields
 */
const loadMessageWithPopulate = (messageId) => Message.findById(messageId).populate(messagePopulate);

/**
 * Determine resource type for Cloudinary based on MIME type
 */
const getCloudinaryResourceType = (mimeType) =>
  mimeType.startsWith("image/") ? CLOUDINARY_RESOURCE_TYPES.IMAGE : CLOUDINARY_RESOURCE_TYPES.RAW;

/**
 * Determine message type (text/image/file)
 */
const determineMessageType = (mimeType) =>
  mimeType.startsWith("image/") ? MESSAGE_TYPES.IMAGE : MESSAGE_TYPES.FILE;

export const getMessagesByConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);

    if (!conversation) {
      return sendNotFound(res, ERROR_MESSAGES.CONVERSATION_NOT_FOUND);
    }
    if (!verifyParticipant(conversation, req.user._id)) {
      return sendForbidden(res, ERROR_MESSAGES.FORBIDDEN);
    }

    // Extract and validate filter parameters
    const filters = extractMessageFilters(req.query);
    const { filter: dateFilter, error: dateError } = buildDateFilter(filters.fromDate, filters.toDate);

    if (dateError) {
      return sendBadRequest(res, dateError);
    }

    // Build complete filter
    const filter = buildMessageFilter(filters, conversation._id, req.user._id);
    if (dateFilter.createdAt) {
      filter.createdAt = dateFilter.createdAt;
    }

    const messages = await Message.find(filter)
      .populate(messagePopulate)
      .sort({ createdAt: 1 })
      .limit(MAX_MESSAGES_PER_QUERY);

    return sendSuccessResponse(res, HTTP_STATUS.OK, messages);
  } catch (err) {
    return handleCatchError(err, res, "GetMessagesByConversation");
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, type = MESSAGE_TYPES.TEXT, replyTo, clientId = "" } = req.body;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return sendNotFound(res, ERROR_MESSAGES.CONVERSATION_NOT_FOUND);
    }
    if (!verifyParticipant(conversation, req.user._id)) {
      return sendForbidden(res, ERROR_MESSAGES.FORBIDDEN);
    }

    let fileUrl = "";
    let fileName = "";
    let finalType = type;

    if (req.file) {
      const resourceType = getCloudinaryResourceType(req.file.mimetype);
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, "chatwave/messages", resourceType);
      fileUrl = uploaded.secure_url;
      fileName = req.file.originalname;
      finalType = determineMessageType(req.file.mimetype);
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
    emitToConversation(conversation._id.toString(), SOCKET_EVENTS.NEW_MESSAGE, populated);

    const recipients = conversation.participants.filter((p) => p.toString() !== req.user._id.toString());
    const users = await User.find({ _id: { $in: recipients } }).select("pushSubscription");

    users.forEach((user) => {
      sendPushNotification(user.pushSubscription, {
        title: "New message",
        body: content || fileName || "Media message"
      });
    });

    return sendSuccessResponse(res, HTTP_STATUS.CREATED, populated);
  } catch (err) {
    return handleCatchError(err, res, "SendMessage");
  }
};

export const toggleReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return sendBadRequest(res, ERROR_MESSAGES.EMOJI_REQUIRED);
    }

    const message = await Message.findById(id);
    if (!message) {
      return sendNotFound(res, ERROR_MESSAGES.MESSAGE_NOT_FOUND);
    }

    const conversation = await Conversation.findById(message.conversation).select("participants");
    if (!conversation || !verifyParticipant(conversation, req.user._id)) {
      return sendForbidden(res, ERROR_MESSAGES.FORBIDDEN);
    }

    const uid = req.user._id.toString();
    const reaction = message.reactions.find((r) => r.emoji === emoji);

    if (!reaction) {
      message.reactions.push({ emoji, users: [req.user._id] });
    } else {
      const has = reaction.users.some((u) => u.toString() === uid);
      if (has) {
        reaction.users = reaction.users.filter((u) => u.toString() !== uid);
      } else {
        reaction.users.push(req.user._id);
      }
      if (reaction.users.length === 0) {
        message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
      }
    }

    await message.save();
    const populated = await loadMessageWithPopulate(message._id);
    emitToConversation(message.conversation.toString(), SOCKET_EVENTS.MESSAGE_EDITED, populated);

    return sendSuccessResponse(res, HTTP_STATUS.OK, populated);
  } catch (err) {
    return handleCatchError(err, res, "ToggleReaction");
  }
};

export const togglePin = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return sendNotFound(res, ERROR_MESSAGES.MESSAGE_NOT_FOUND);
    }

    const conversation = await Conversation.findById(message.conversation).select("participants");
    if (!conversation || !verifyParticipant(conversation, req.user._id)) {
      return sendForbidden(res, ERROR_MESSAGES.FORBIDDEN);
    }

    message.pinned = !message.pinned;
    message.pinnedAt = message.pinned ? new Date() : null;
    message.pinnedBy = message.pinned ? req.user._id : null;
    await message.save();

    const populated = await loadMessageWithPopulate(message._id);
    emitToConversation(message.conversation.toString(), SOCKET_EVENTS.MESSAGE_EDITED, populated);

    return sendSuccessResponse(res, HTTP_STATUS.OK, populated);
  } catch (err) {
    return handleCatchError(err, res, "TogglePin");
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return sendNotFound(res, ERROR_MESSAGES.MESSAGE_NOT_FOUND);
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return sendForbidden(res, "Can delete only own messages");
    }

    message.deletedFor = Array.from(new Set([...message.deletedFor.map(String), req.user._id.toString()]));
    await message.save();

    const io = getIo();
    io.to(message.conversation.toString()).emit(SOCKET_EVENTS.MESSAGE_DELETED, {
      messageId: message._id,
      userId: req.user._id
    });

    return sendSuccessResponse(res, HTTP_STATUS.OK, null, "Deleted for self");
  } catch (err) {
    return handleCatchError(err, res, "DeleteMessage");
  }
};

export const markMessageSeen = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return sendNotFound(res, ERROR_MESSAGES.MESSAGE_NOT_FOUND);
    }

    if (!message.seenBy.some((id) => id.toString() === req.user._id.toString())) {
      message.seenBy.push(req.user._id);
      await message.save();
    }

    const io = getIo();
    io.to(message.conversation.toString()).emit(SOCKET_EVENTS.MESSAGE_SEEN, {
      messageId: message._id,
      seenBy: message.seenBy
    });

    return sendSuccessResponse(res, HTTP_STATUS.OK, null, "Seen updated");
  } catch (err) {
    return handleCatchError(err, res, "MarkMessageSeen");
  }
};
