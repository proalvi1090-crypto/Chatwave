import { Router } from "express";
import {
  deleteMessage,
  getMessagesByConversation,
  markMessageSeen,
  sendMessage,
  togglePin,
  toggleReaction
} from "../controllers/message.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/:conversationId", getMessagesByConversation);
router.post("/", upload.single("file"), sendMessage);
router.delete("/:id", deleteMessage);
router.put("/:id/seen", markMessageSeen);
router.put("/:id/reactions", toggleReaction);
router.put("/:id/pin", togglePin);

export default router;
