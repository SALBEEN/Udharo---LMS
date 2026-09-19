// utils/uploadImage.js
import { cloudinary } from "../Middlewares/cloudinary.middleware.js";
import streamifier from "streamifier";

const uploadToCloudinary = (fileBuffer, folderName) => {
  return new Promise((resolve, reject) => {
    // Create the upload stream
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folderName }, // e.g., 'udharo_profiles' or 'udharo_equipment'
      (error, result) => {
        if (error) return reject(error);
        resolve(result); // Returns the URL and metadata from Cloudinary
      },
    );

    // Convert the Multer buffer to a stream and pipe it to Cloudinary
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

export { uploadToCloudinary };
