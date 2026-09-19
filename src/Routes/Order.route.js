import express from "express";
import {
  createOrder,
  getIncomingOrders,
  getMyRentals,
  updateOrderStatus,
} from "../Controllers/Order.controller.js";
import { verifyJWT } from "../Middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create", verifyJWT, createOrder);
router.get("/incoming-orders", verifyJWT, getIncomingOrders);
router.get("/my-rentals", verifyJWT, getMyRentals);
router.patch("/status", verifyJWT, updateOrderStatus);

export default router;
