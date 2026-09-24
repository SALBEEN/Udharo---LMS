import express from "express";
import { Signup } from "../Controllers/User.controller.js";
import { Login } from "../Controllers/User.controller.js";
import { refreshToken } from "../Controllers/User.controller.js";
import { verifyJWT } from "../Middlewares/auth.middleware.js";
import { uploadProfileImage } from "../Controllers/User.controller.js";
import { VerifyEmailOtp } from "../Controllers/User.controller.js";

const router = express.Router();

router.post("/signup", Signup);
router.post("/verify-email-otp", VerifyEmailOtp);
router.post("/login", Login);
router.post("/refresh", verifyJWT, refreshToken);
router.post("/upload-profile-image", verifyJWT, uploadProfileImage);

export default router;
