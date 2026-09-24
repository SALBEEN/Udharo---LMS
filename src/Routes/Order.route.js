import express from "express";
import {
  createOrder,
  getIncomingOrders,
  getMyRentals,
  updateOrderStatus,
  getLenderStats,
  initiateReturn,
  uploadPaymentProof,
} from "../Controllers/Order.controller.js";
import { verifyJWT } from "../Middlewares/auth.middleware.js";
import { upload } from "../Middlewares/cloudinary.middleware.js";

const router = express.Router();

router.post("/create", verifyJWT, createOrder);
router.get("/incoming-orders", verifyJWT, getIncomingOrders);
router.get("/my-rentals", verifyJWT, getMyRentals);
router.patch("/status", verifyJWT, updateOrderStatus);
router.get("/stats/:lenderId", verifyJWT, getLenderStats);
router.patch("/initiate-return", verifyJWT, initiateReturn);
router.patch(
  "/:orderId/payment-proof",
  verifyJWT,
  upload.single("image"),
  uploadPaymentProof,
);

export default router;
