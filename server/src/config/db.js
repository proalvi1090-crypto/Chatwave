import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let memoryMongo;

const isAlpine = () => {
  const release = process.env.OS_RELEASE || "";
  return process.platform === "linux" && (release.toLowerCase().includes("alpine") || release.toLowerCase().includes("id=alpine"));
};

export const connectDb = async () => {
  const configuredUri = process.env.MONGODB_URI;

  if (configuredUri) {
    try {
      await mongoose.connect(configuredUri);
      console.log("MongoDB connected");
      return;
    } catch (err) {
      if (isAlpine()) {
        throw new Error(
          `MongoDB connection failed (${err.message}). In-memory MongoDB fallback is not supported on Alpine; configure a reachable MONGODB_URI (e.g. mongodb://mongo:27017/chatwave).`
        );
      }

      console.warn(`MongoDB connection failed (${err.message}). Falling back to in-memory MongoDB.`);
    }
  }

  memoryMongo = await MongoMemoryServer.create();
  await mongoose.connect(memoryMongo.getUri(), { dbName: "chatwave" });
  console.log("MongoDB in-memory connected");
};
