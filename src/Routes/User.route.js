import express from "express";
import {
  refreshToken,
  logoutUser,
  Signup,
  Login,
  uploadProfileImage,
  VerifyEmailOtp,
  requestPasswordReset,
  resetPassword,
} from "../Controllers/User.controller.js";
import { verifyJWT } from "../Middlewares/auth.middleware.js";

const router = express.Router();

router.post("/signup", Signup);
router.post("/verify-email-otp", VerifyEmailOtp);
router.post("/login", Login);
router.post("/logout", logoutUser);
router.post("/refresh", verifyJWT, refreshToken);
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);

export default router;
