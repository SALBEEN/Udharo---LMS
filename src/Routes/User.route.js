import express from "express";
import { Signup } from "../Controllers/User.controlller.js";
import { Login } from "../Controllers/User.controlller.js";

const router = express.Router();

router.post("/signup", Signup);
router.post("/login", Login);

export default router;
