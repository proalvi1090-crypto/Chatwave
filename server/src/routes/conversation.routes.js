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

const router = Router();

router.use(requireAuth);

router.get("/", getConversations);
router.post("/", startPrivateConversation);
router.post("/group", createGroupConversation);
router.get("/:id", getConversationById);
router.put("/:id/group", updateGroupConversation);
router.patch("/:id/preferences", updateConversationPreferences);
router.post("/:id/members", addGroupMember);
router.delete("/:id/members/:userId", removeGroupMember);

export default router;
