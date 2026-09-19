import express from "express";
import { Signup } from "../Controllers/User.controller.js";
import { Login } from "../Controllers/User.controller.js";
import { refreshToken } from "../Controllers/User.controller.js";

const router = express.Router();

router.post("/signup", Signup);
router.post("/login", Login);
router.post("/refresh", refreshToken);

export default router;
