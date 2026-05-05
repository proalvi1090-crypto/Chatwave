import streamifier from "streamifier";
import { v2 as cloudinary } from "cloudinary";
import { validateRequired } from "./envValidator.js";

cloudinary.config({
  cloud_name: validateRequired("CLOUDINARY_CLOUD_NAME", "Cloudinary cloud name is required for file uploads"),
  api_key: validateRequired("CLOUDINARY_API_KEY", "Cloudinary API key is required for file uploads"),
  api_secret: validateRequired("CLOUDINARY_API_SECRET", "Cloudinary API secret is required for file uploads")
});

export const uploadBufferToCloudinary = (buffer, folder, resourceType = "auto") =>
  new Promise((resolve, reject) => {
    /**
     * @param {Error | string | { message?: string }} err
     * @param {unknown} result
     */
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => {
        if (err) {
          const errorMessage = typeof err === "string" ? err : err?.message || "Upload failed";
          return reject(new Error(errorMessage));
        }
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
