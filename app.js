import express from "express";

const app = express();

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

app.use("/api/v1/user", userRoutes);

// ======================================================

//export the app and the server will import it

export default app;
