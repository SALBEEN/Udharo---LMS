import jwt from "jsonwebtoken";
import User from "../Schemas/User.schema.js";
import { asyncHandler } from "../Utilities/AsyncHandler.utilities.js";
import { ApiError } from "../Utilities/ApiError.utilities.js";

const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    // FIX: Check for 'id' first (how it's signed), fallback to '_id'
    const userId = decodedToken?.id || decodedToken?._id;

    console.log("🔍 Decoded token payload ID:", userId);

    const user = await User.findById(userId).select("-password -refreshToken");

    if (!user) {
      console.log("❌ User not found in database for ID:", userId);
      throw new ApiError(401, "Invalid Access Token");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Access Token Expired");
    } else if (error.name === "JsonWebTokenError") {
      throw new ApiError(401, "Invalid Access Token");
    } else {
      // Preserve custom ApiErrors like 401 instead of overwriting them with 500
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, error.message || "Internal Server Error");
    }
  }
});

export { verifyJWT };
