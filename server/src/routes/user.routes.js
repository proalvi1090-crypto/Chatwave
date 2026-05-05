import { Router } from "express";
import {
  getUserById,
  savePushSubscription,
  searchUsers,
  updateProfile
} from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import { validateQuery, validateParams, validateBody } from "../middleware/validation.middleware.js";
import {
  searchUsersSchema,
  objectIdSchema,
  updateUserSchema
} from "../utils/validationSchemas.js";

const router = Router();

router.use(requireAuth);
router.get("/search", validateQuery(searchUsersSchema), searchUsers);
router.get("/:id", validateParams(objectIdSchema), getUserById);
router.put("/profile", upload.single("profilePic"), validateBody(updateUserSchema), updateProfile);
router.post("/push-subscription", savePushSubscription);

export default router;
