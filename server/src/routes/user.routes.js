import { Router } from "express";
import {
  getUserById,
  savePushSubscription,
  searchUsers,
  updateProfile
} from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = Router();

router.use(requireAuth);
router.get("/search", searchUsers);
router.get("/:id", getUserById);
router.put("/profile", upload.single("profilePic"), updateProfile);
router.post("/push-subscription", savePushSubscription);

export default router;
