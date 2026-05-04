import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: String,
    expirationTime: Number,
    keys: {
      p256dh: String,
      auth: String
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    bio: { type: String, default: "" },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    refreshTokenVersion: { type: Number, default: 0 },
    pushSubscription: pushSubscriptionSchema
  },
  { timestamps: true }
);

userSchema.virtual("tokenVersion").get(function tokenVersionGetter() {
  return this.refreshTokenVersion;
});

export const User = mongoose.model("User", userSchema);
