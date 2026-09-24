import express from "express";
import multer from "multer";
import { upload } from "../Middlewares/cloudinary.middleware.js";

import {
  createProduct,
  getAllProducts,
  getSingleProduct,
  updateProduct,
  toggleAvailability,
  deleteProduct,
  getMyProducts,
} from "../Controllers/Product.controller.js";
import { verifyJWT } from "../Middlewares/auth.middleware.js";

const router = express.Router();

router.post("/create", verifyJWT, upload.single("image"), createProduct);
router.get("/all", getAllProducts);

router.get("/my-inventory", verifyJWT, getMyProducts);

router.get("/:id", getSingleProduct);

router.put("/:id", verifyJWT, upload.single("image"), updateProduct);
router.patch("/:id/toggle-availability", verifyJWT, toggleAvailability);
router.delete("/:id", verifyJWT, deleteProduct);

export default router;
