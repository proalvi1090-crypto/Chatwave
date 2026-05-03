import mongoose from "mongoose";
import { Conversation } from "../models/Conversation.model.js";
import { Message } from "../models/Message.model.js";
import {
  MIN_GROUP_MEMBERS,
  ERROR_MESSAGES,
  HTTP_STATUS,
  CONVERSATION_TYPES
} from "../utils/constants.js";
import {
  sendBadRequest,
  sendNotFound,
  sendForbidden,
  sendSuccessResponse,
  handleCatchError
} from "../utils/responseHandler.js";

const listPopulate = [
  { path: "participants", select: "name profilePic isOnline lastSeen bio" },
  { path: "admin", select: "name profilePic" },
  { path: "lastMessage", populate: { path: "sender", select: "name profilePic" } }
];

/**
 * Get unread message count for a user in a conversation
 */
const getUnreadCount = async (conversationId, userId) =>
  Message.countDocuments({
    conversation: conversationId,
    sender: { $ne: userId },
    seenBy: { $ne: userId },
    deletedFor: { $ne: userId }
  });

/**
 * Enrich conversation with unread count
 */
const withUnreadCount = async (conversation, userId) => {
  const unreadCount = await getUnreadCount(conversation._id, userId);
  const payload = conversation.toObject ? conversation.toObject() : conversation;
  return { ...payload, unreadCount };
};

/**
 * Enrich multiple conversations with unread counts
 */
const withUnreadCounts = (conversations, userId) =>
  Promise.all(conversations.map((c) => withUnreadCount(c, userId)));

/**
 * Populate conversation with detailed data
 */
const populateConversation = (conversation) => Conversation.findById(conversation._id).populate(listPopulate);

export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate(listPopulate)
      .sort({ updatedAt: -1 });

    const payload = await withUnreadCounts(conversations, req.user._id);
    return sendSuccessResponse(res, HTTP_STATUS.OK, payload);
  } catch (err) {
    return handleCatchError(err, res, "GetConversations");
  }
};

export const startPrivateConversation = async (req, res) => {
  try {
    const { participantId } = req.body;
    if (!participantId) {
      return sendBadRequest(res, ERROR_MESSAGES.PARTICIPANT_ID_REQUIRED);
    }

    let conversation = await Conversation.findOne({
      isGroup: CONVERSATION_TYPES.PRIVATE,
      participants: { $all: [req.user._id, participantId], $size: 2 }
    }).populate(listPopulate);

    if (!conversation) {
      conversation = await Conversation.create({
        isGroup: CONVERSATION_TYPES.PRIVATE,
        participants: [req.user._id, participantId]
      });
      conversation = await Conversation.findById(conversation._id).populate(listPopulate);
    }

    const payload = await withUnreadCount(conversation, req.user._id);
    return sendSuccessResponse(res, HTTP_STATUS.CREATED, payload);
  } catch (err) {
    return handleCatchError(err, res, "StartPrivateConversation");
  }
};

export const createGroupConversation = async (req, res) => {
  try {
    const { name, memberIds = [], groupIcon } = req.body;

    if (!name || memberIds.length < MIN_GROUP_MEMBERS) {
      return sendBadRequest(res, ERROR_MESSAGES.GROUP_NAME_REQUIRED);
    }

    const uniqueMembers = Array.from(new Set([...memberIds, req.user._id.toString()]));
    const participants = uniqueMembers.map((id) => new mongoose.Types.ObjectId(id));

    const group = await Conversation.create({
      isGroup: CONVERSATION_TYPES.GROUP,
      name,
      groupIcon: groupIcon || "",
      participants,
      admin: req.user._id
    });

    const populated = await populateConversation(group);
    const payload = await withUnreadCount(populated, req.user._id);
    return sendSuccessResponse(res, HTTP_STATUS.CREATED, payload);
  } catch (err) {
    return handleCatchError(err, res, "CreateGroupConversation");
  }
};

export const getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).populate(listPopulate);

    if (!conversation) {
      return sendNotFound(res, ERROR_MESSAGES.CONVERSATION_NOT_FOUND);
    }

    const hasAccess = conversation.participants.some((p) => p._id.toString() === req.user._id.toString());
    if (!hasAccess) {
      return sendForbidden(res, ERROR_MESSAGES.FORBIDDEN);
    }

    const payload = await withUnreadCount(conversation, req.user._id);
    return sendSuccessResponse(res, HTTP_STATUS.OK, payload);
  } catch (err) {
    return handleCatchError(err, res, "GetConversationById");
  }
};

export const updateGroupConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !conversation.isGroup) {
      return sendNotFound(res, "Group not found");
    }

    if (conversation.admin?.toString() !== req.user._id.toString()) {
      return sendForbidden(res, "Only admin can update group");
    }

    const { name, groupIcon } = req.body;
    if (name !== undefined) conversation.name = name;
    if (groupIcon !== undefined) conversation.groupIcon = groupIcon;

    await conversation.save();
    const populated = await populateConversation(conversation);
    const payload = await withUnreadCount(populated, req.user._id);
    return sendSuccessResponse(res, HTTP_STATUS.OK, payload);
  } catch (err) {
    return handleCatchError(err, res, "UpdateGroupConversation");
  }
};

export const addGroupMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const conversation = await Conversation.findById(id);
    if (!conversation || !conversation.isGroup) {
      return sendNotFound(res, "Group not found");
    }

    if (conversation.admin?.toString() !== req.user._id.toString()) {
      return sendForbidden(res, "Only admin can add member");
    }

    if (!conversation.participants.some((p) => p.toString() === userId)) {
      conversation.participants.push(userId);
      await conversation.save();
    }

    const populated = await populateConversation(conversation);
    const payload = await withUnreadCount(populated, req.user._id);
    return sendSuccessResponse(res, HTTP_STATUS.OK, payload);
  } catch (err) {
    return handleCatchError(err, res, "AddGroupMember");
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation || !conversation.isGroup) {
      return sendNotFound(res, "Group not found");
    }

    const isAdmin = conversation.admin?.toString() === req.user._id.toString();
    const removingSelf = req.user._id.toString() === userId;

    if (!isAdmin && !removingSelf) {
      return sendForbidden(res, "Only admin can remove other members");
    }

    conversation.participants = conversation.participants.filter((p) => p.toString() !== userId);

    if (conversation.admin?.toString() === userId && conversation.participants.length > 0) {
      [conversation.admin] = conversation.participants;
    }

    await conversation.save();
    const populated = await populateConversation(conversation);
    const payload = await withUnreadCount(populated, req.user._id);
    return sendSuccessResponse(res, HTTP_STATUS.OK, payload);
  } catch (err) {
    return handleCatchError(err, res, "RemoveGroupMember");
  }
};

export const updateConversationPreferences = async (req, res) => {
  try {
    const { id } = req.params;
    const { muted, favorite, wallpaper } = req.body;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return sendNotFound(res, ERROR_MESSAGES.CONVERSATION_NOT_FOUND);
    }

    const isParticipant = conversation.participants.some((p) => p.toString() === req.user._id.toString());
    if (!isParticipant) {
      return sendForbidden(res, ERROR_MESSAGES.FORBIDDEN);
    }

    const uid = req.user._id.toString();

    if (muted !== undefined) {
      if (muted && !conversation.mutedBy.some((x) => x.toString() === uid)) {
        conversation.mutedBy.push(req.user._id);
      }
      if (!muted) {
        conversation.mutedBy = conversation.mutedBy.filter((x) => x.toString() !== uid);
      }
    }

    if (favorite !== undefined) {
      if (favorite && !conversation.favoriteBy.some((x) => x.toString() === uid)) {
        conversation.favoriteBy.push(req.user._id);
      }
      if (!favorite) {
        conversation.favoriteBy = conversation.favoriteBy.filter((x) => x.toString() !== uid);
      }
    }

    if (wallpaper !== undefined) {
      conversation.wallpaper = String(wallpaper || "aurora");
    }

    await conversation.save();
    const populated = await populateConversation(conversation);
    const payload = await withUnreadCount(populated, req.user._id);
    return sendSuccessResponse(res, HTTP_STATUS.OK, payload);
  } catch (err) {
    return handleCatchError(err, res, "UpdateConversationPreferences");
  }
};
