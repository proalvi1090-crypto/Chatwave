import { Router } from "express";
import {
  addGroupMember,
  createGroupConversation,
  getConversationById,
  getConversations,
  removeGroupMember,
  startPrivateConversation,
  updateConversationPreferences,
  updateGroupConversation
} from "../controllers/conversation.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validateBody, validateParams } from "../middleware/validation.middleware.js";
import {
  createGroupSchema,
  updateGroupSchema,
  addGroupMemberSchema,
  startConversationSchema,
  updatePreferencesSchema,
  objectIdSchema,
  removeGroupMemberParamSchema
} from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth);

router.get("/", getConversations);
router.post("/", validateBody(startConversationSchema), startPrivateConversation);
router.post("/group", validateBody(createGroupSchema), createGroupConversation);
router.get("/:id", validateParams(objectIdSchema), getConversationById);
router.put("/:id/group", validateParams(objectIdSchema), validateBody(updateGroupSchema), updateGroupConversation);
router.patch("/:id/preferences", validateParams(objectIdSchema), validateBody(updatePreferencesSchema), updateConversationPreferences);
router.post("/:id/members", validateParams(objectIdSchema), validateBody(addGroupMemberSchema), addGroupMember);
router.delete("/:id/members/:userId", validateParams(removeGroupMemberParamSchema), removeGroupMember);

export default router;
