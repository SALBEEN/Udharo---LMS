import express from "express";
import {
  createProduct,
  getAllProducts,
  getSingleProduct,
  updateProduct,
  toggleAvailability,
  deleteProduct,
} from "../Controllers/Product.controller.js";
import { verifyJWT } from "../Middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create", verifyJWT, createProduct);
router.get("/all", getAllProducts);
router.get("/:id", getSingleProduct);
router.put("/:id", verifyJWT, updateProduct);
router.patch("/:id/toggle-availability", verifyJWT, toggleAvailability);
router.delete("/:id", verifyJWT, deleteProduct);

export default router;
