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
import { validateBody, validateParams, validateQuery } from "../middleware/validation.middleware.js";
import {
  searchMessagesSchema,
  sendMessageSchema,
  objectIdSchema,
  reactToMessageSchema,
  pinMessageSchema,
  conversationIdParamSchema
} from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth);

router.get("/:conversationId", validateParams(conversationIdParamSchema), validateQuery(searchMessagesSchema), getMessagesByConversation);
router.post("/", upload.single("file"), validateBody(sendMessageSchema), sendMessage);
router.delete("/:id", validateParams(objectIdSchema), deleteMessage);
router.put("/:id/seen", validateParams(objectIdSchema), markMessageSeen);
router.put("/:id/reactions", validateParams(objectIdSchema), validateBody(reactToMessageSchema), toggleReaction);
router.put("/:id/pin", validateParams(objectIdSchema), validateBody(pinMessageSchema), togglePin);

export default router;
