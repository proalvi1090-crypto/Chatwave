import { Conversation } from "../models/Conversation.model.js";
import { Message } from "../models/Message.model.js";
import { isDbBufferTimeout } from "../utils/dbHelpers.js";
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

/**
 * Ensure the conversation exists and is a group conversation
 */
const getGroupConversation = async (conversationId) => {
  const conversation = await Conversation.findById(conversationId);
  if (conversation?.isGroup !== true) {
    return null;
  }

  return conversation;
};

/**
 * Check whether the current user is the conversation admin
 */
const isConversationAdmin = (conversation, userId) =>
  conversation?.admin?.toString() === userId.toString();

/**
 * Check whether a user is already part of a conversation
 */
const isConversationParticipant = (conversation, userId) =>
  conversation?.participants?.some((participant) => participant.toString() === userId.toString());

/**
 * Apply a user-scoped preference toggle to a conversation array field
 */
const updateUserScopedList = (items, userId, enabled) => {
  const currentItems = Array.isArray(items) ? items : [];
  const uid = userId.toString();
  const hasItem = currentItems.some((item) => item.toString() === uid);

  if (enabled) {
    return hasItem ? currentItems : [...currentItems, userId];
  }

  return currentItems.filter((item) => item.toString() !== uid);
};

/**
 * Apply conversation preference changes in a single place
 */
const applyConversationPreferences = (conversation, { muted, favorite, wallpaper }, userId) => {
  if (muted !== undefined) {
    conversation.mutedBy = updateUserScopedList(conversation.mutedBy, userId, muted);
  }

  if (favorite !== undefined) {
    conversation.favoriteBy = updateUserScopedList(conversation.favoriteBy, userId, favorite);
  }

  if (wallpaper !== undefined) {
    conversation.wallpaper = String(wallpaper || "aurora");
  }

  return conversation;
};

export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate(listPopulate)
      .sort({ updatedAt: -1 });

    const payload = await withUnreadCounts(conversations, req.user._id);
    return sendSuccessResponse(res, HTTP_STATUS.OK, payload);
  } catch (err) {
    // If DB is unavailable, return empty array instead of crashing
    if (isDbBufferTimeout(err)) {
      console.warn("Database timeout in getConversations, returning empty array");
      return sendSuccessResponse(res, HTTP_STATUS.OK, []);
    }
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
    const participants = uniqueMembers.map(String);

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
    const conversation = await getGroupConversation(req.params.id);
    if (!conversation) {
      return sendNotFound(res, "Group not found");
    }

    if (!isConversationAdmin(conversation, req.user._id)) {
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

    const conversation = await getGroupConversation(id);
    if (!conversation) {
      return sendNotFound(res, "Group not found");
    }

    if (!isConversationAdmin(conversation, req.user._id)) {
      return sendForbidden(res, "Only admin can add member");
    }

    if (!isConversationParticipant(conversation, userId)) {
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
    const conversation = await getGroupConversation(id);

    if (!conversation) {
      return sendNotFound(res, "Group not found");
    }

    const isAdmin = isConversationAdmin(conversation, req.user._id);
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
    const preferences = req.body;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return sendNotFound(res, ERROR_MESSAGES.CONVERSATION_NOT_FOUND);
    }

    const isParticipant = isConversationParticipant(conversation, req.user._id);
    if (!isParticipant) {
      return sendForbidden(res, ERROR_MESSAGES.FORBIDDEN);
    }

    applyConversationPreferences(conversation, preferences, req.user._id);

    await conversation.save();
    const populated = await populateConversation(conversation);
    const payload = await withUnreadCount(populated, req.user._id);
    return sendSuccessResponse(res, HTTP_STATUS.OK, payload);
  } catch (err) {
    return handleCatchError(err, res, "UpdateConversationPreferences");
  }
};
