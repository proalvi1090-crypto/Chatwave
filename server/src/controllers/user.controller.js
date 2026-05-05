import { User } from "../models/User.model.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";
import { escapeRegex } from "../utils/envValidator.js";
import {
  isLocalDbDisabled,
  getLocalUserStore
} from "../utils/localStore.js";
import { sanitizeObjectId } from "../utils/sanitize.js";

const localUserStore = getLocalUserStore();

export const searchUsers = async (req, res) => {
  try {
    const q = req.query.q?.trim() || "";

    if (!q) return res.json([]);

    if (isLocalDbDisabled()) {
      const currentUserId = req.user._id?.toString?.() || String(req.user._id);
      const users = Array.from(localUserStore.values())
        .filter((user) => {
          const userId = user._id?.toString?.() || String(user._id);
          return userId !== currentUserId;
        })
        .filter((user) => {
          const normalizedQuery = q.toLowerCase();
          const name = (user.name || "").toLowerCase();
          const email = (user.email || "").toLowerCase();
          return name.includes(normalizedQuery) || email.includes(normalizedQuery);
        })
        .slice(0, 20)
        .map((user) => ({
          _id: user._id,
          name: user.name,
          profilePic: user.profilePic || "",
          bio: user.bio || "",
          isOnline: user.isOnline ?? false,
          lastSeen: user.lastSeen || new Date()
        }));

      return res.json(users);
    }

    // Escape special regex characters to prevent ReDoS attacks
    const escapedQuery = escapeRegex(q);

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [
            { name: { $regex: escapedQuery, $options: "i" } },
            { email: { $regex: escapedQuery, $options: "i" } }
          ]
        }
      ]
    })
      .select("name profilePic bio isOnline lastSeen")
      .limit(20);

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const id = sanitizeObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ID format" });

    if (isLocalDbDisabled()) {
      const user = localUserStore.get(id) || null;

      if (!user) return res.status(404).json({ message: "User not found" });

      return res.json({
        _id: user._id,
        name: user.name,
        profilePic: user.profilePic || "",
        bio: user.bio || "",
        isOnline: user.isOnline ?? false,
        lastSeen: user.lastSeen || new Date()
      });
    }

    const user = await User.findById(id).select("name profilePic bio isOnline lastSeen");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    if (isLocalDbDisabled()) {
      const currentUserId = req.user._id?.toString?.() || String(req.user._id);
      const user = localUserStore.get(currentUserId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { name, bio } = req.body;

      if (name) user.name = name;
      if (bio !== undefined) user.bio = bio;

      if (req.file) {
        const uploaded = await uploadBufferToCloudinary(req.file.buffer, "chatwave/profile", "image");
        user.profilePic = uploaded.secure_url;
      }

      localUserStore.set(currentUserId, user);

      return res.json({
        _id: user._id,
        name: user.name,
        profilePic: user.profilePic || "",
        bio: user.bio || "",
        isOnline: user.isOnline ?? false,
        lastSeen: user.lastSeen || new Date()
      });
    }

    const { name, bio } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (bio !== undefined) updates.bio = bio;

    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, "chatwave/profile", "image");
      updates.profilePic = uploaded.secure_url;
    }

    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select(
      "name profilePic bio isOnline lastSeen"
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const savePushSubscription = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ message: "Valid push subscription with endpoint is required" });
    }
    await User.findByIdAndUpdate(req.user._id, { pushSubscription: subscription });
    res.json({ message: "Subscription saved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
