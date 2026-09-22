import express from "express";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173", // Allow your Vite frontend
    credentials: true, // Allow cookies/authorization headers if needed
  }),
);

app.use(express.json());

// app.defaultConfiguration();

// implement the cors and other necessary attributes and methods there

// initialize the multer so that the app can works with image files

// import multer from "multer";

// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

// app.use(upload.single("image"));
// ======================================================
// setup all route and internal api
import userRoutes from "./src/Routes/User.route.js";
import productRoutes from "./src/Routes/Product.route.js";
import orderRoutes from "./src/Routes/Order.route.js";

app.use("/api/v1/user", userRoutes);
app.use("/api/v1/product", productRoutes);
app.use("/api/v1/order", orderRoutes);

// ======================================================

// ======================================================

//export the app and the server will import it

export default app;
