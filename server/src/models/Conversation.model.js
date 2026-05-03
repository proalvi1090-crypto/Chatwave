import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    isGroup: { type: Boolean, default: false },
    name: { type: String, default: "" },
    groupIcon: { type: String, default: "" },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    favoriteBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    wallpaper: { type: String, default: "aurora" }
  },
  { timestamps: true }
);

export const Conversation = mongoose.model("Conversation", conversationSchema);
