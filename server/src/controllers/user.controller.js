import { User } from "../models/User.model.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";

export const searchUsers = async (req, res) => {
  try {
    const q = req.query.q?.trim() || "";

    if (!q) return res.json([]);

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } }
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
    const user = await User.findById(req.params.id).select("name profilePic bio isOnline lastSeen");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
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
    await User.findByIdAndUpdate(req.user._id, { pushSubscription: req.body.subscription });
    res.json({ message: "Subscription saved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
