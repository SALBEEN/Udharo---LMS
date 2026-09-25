import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const app = express();

// ======================================================
// CORS Configuration (Supports local development & production)
// ======================================================
const allowedOrigins = [
  "http://localhost:5173", // Local Vite frontend
  process.env.FRONTEND_URL, // Production frontend URL (set in environment variables)
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        return callback(new Error("Blocked by CORS policy"), false);
      }
      return callback(null, true);
    },
    credentials: true, // Allow cookies/authorization headers
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================================================
// Multer Setup for Image Files
// ======================================================
const storage = multer.memoryStorage();
export const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Optional: limit file size to 5MB
});

// ======================================================
// Routes and Internal APIs
// ======================================================
import userRoutes from "./src/Routes/User.route.js";
import productRoutes from "./src/Routes/Product.route.js";
import orderRoutes from "./src/Routes/Order.route.js";

app.use("/api/v1/user", userRoutes);
app.use("/api/v1/product", productRoutes);
app.use("/api/v1/order", orderRoutes);

// ======================================================
// Export the app for the server entry point (e.g., server.js)
// ======================================================
export default app;
