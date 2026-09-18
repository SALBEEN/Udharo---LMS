// import the app here and using the db make a execution path
import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./src/DB/db.config.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    console.log("✅ Connected to MongoDB successfully.");

    // 2. Start the Express server ONLY after the DB connects
    app.listen(PORT, () => {
      console.log(`🚀 Server is listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("❌ Database connection failed:", error.message);
    // Exit the process with failure if DB doesn't connect
    process.exit(1);
  });
