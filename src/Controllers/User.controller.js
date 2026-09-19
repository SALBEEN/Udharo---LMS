// ----------------- IMPORTS -------------------
import User from "../Schemas/User.schema.js";
import admin from "firebase-admin";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// ----------------- LOGOUT -------------------

const Signup = async (req, res) => {
  const { idToken, name, password, role, lenderAddress, storeAddress } =
    req.body;

  if (!idToken) {
    return res
      .status(401)
      .json({ success: false, message: "Missing Firebase ID Token." });
  }
  // ======================================

  // only for testing purpose, if the idToken is "test-token", we will use a
  //  standard test number instead of verifying with Firebase
  //  Admin SDK. This is useful for testing with Postman or other
  // tools without needing to generate a real Firebase ID token.
  let verifiedPhoneNumber;

  if (idToken === "test-token") {
    console.log("⚠️ Using Postman Test Token");
    verifiedPhoneNumber = "+9779800000000"; // Standard test number
  }
  // --- REAL FIREBASE VERIFICATION ---
  else {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    verifiedPhoneNumber = decodedToken.phone_number;
  }
  // ======================================

  // verift the ID token using Firebase Admin SDK
  //   const decodedToken = await admin.auth().verifyIdToken(idToken);
  //   const verifiedPhoneNumber = decodedToken.phone_number;

  /// check the input field

  if (!name || !password || !role) {
    return res.status(400).json({
      success: false,
      message: "Name, phoneNumber, password, and role are required.",
    });
  }

  if (role !== "lender" && role !== "renter") {
    return res.status(400).json({
      success: false,
      message: 'Role must be either "lender" or "renter".',
    });
  }

  if (role === "lender") {
    if (!storeAddress) {
      return res.status(400).json({
        success: false,
        message: "Store address is required for lenders.",
      });
    }
  }

  if (role === "renter") {
    if (!lenderAddress) {
      return res.status(400).json({
        success: false,
        message: "Lender address is required for renters.",
      });
    }
  }

  // hashing the password and phone number before saving to the database
  const hashedPassword = await bcrypt.hash(password, 10);
  const hashedPhoneNumber = await bcrypt.hash(verifiedPhoneNumber, 10);

  // save the user to the databa

  const user = new User({
    name,
    phoneNumber: hashedPhoneNumber,
    password: hashedPassword,
    role,
    lenderAddress: role === "lender" ? lenderAddress : undefined,
    storeAddress: role === "lender" ? storeAddress : undefined,
  });

  await user.save();

  const token = jwt.sign(
    { id: user._id, role: user.role, phoneNumber: user.phoneNumber },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE_IN,
    },
  );

  // send response
  res.status(200).json({
    _id: user._id,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    success: true,
    message: "User registered successfully.",
    token: token,
  });
};

// --------------- LOGIN -------------------

const Login = async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    return res.status(400).json({
      success: false,
      message: "Phone number and password are required.",
    });
  }

  // find the user by phone number
  const user = await User.findOne({ phoneNumber });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  // compare the password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: "Invalid password.",
    });
  }

  // generate JWT token

  const accessToken = jwt.sign(
    { id: user._id, role: user.role, phoneNumber: user.phoneNumber },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE_IN,
    },
  );

  const refreshToken = jwt.sign(
    { id: user._id, role: user.role, phoneNumber: user.phoneNumber },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE_IN,
    },
  );

  // set the refresh token in the cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // set to true in production
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // send response
  res.status(200).json({
    _id: user._id,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    success: true,
    accessToken: accessToken,
    message: "User logged in successfully.",
  });
};

// ----------------- REFRESH TOKEN -------------------

const refreshToken = async (req, res) => {
  try {
    // 1. Grab the refresh token from the HttpOnly cookie
    const token = req.cookies.refreshToken;

    // 2. If no token exists, they are completely logged out
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No refresh token provided. Please log in.",
      });
    }

    // 3. Verify the refresh token
    jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) {
        // Token is expired or tampered with
        return res.status(403).json({
          success: false,
          message: "Invalid or expired refresh token. Please log in again.",
        });
      }

      // 4. Token is valid! Issue a new short-lived Access Token
      // 'decoded' contains the payload you signed during login (e.g., userId)
      const newAccessToken = jwt.sign(
        { userId: decoded.userId, role: decoded.role },
        process.env.JWT_SECRET,
        { expiresIn: "15m" },
      );

      // 5. Send the new access token back to the frontend
      res.status(200).json({
        success: true,
        accessToken: newAccessToken,
      });
    });
  } catch (error) {
    console.error("Refresh Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during token refresh." });
  }
};

// ------------------- LOG OUT ------------------

const logoutUser = (req, res) => {
  // Clear the HttpOnly cookie
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.status(200).json({ success: true, message: "Logged out successfully." });
};

// ------------------ UPLOAD PROFILE IMAGE -------------------

const uploadProfileImage = async (req, res) => {
  try {
    // 1. Check if a file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Please select an image.",
      });
    }

    // 2. Upload to Cloudinary (using your wrapper function)
    const result = await uploadToCloudinary(req.file.buffer, "udharo_profiles");

    // 3. Update the database
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: result.secure_url },
      { new: true }, // Returns the newly updated document
    ).select("-password"); // Hide password from response

    // 4. Send ONE success response
    return res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully.",
      user: updatedUser,
    });
  } catch (error) {
    // 5. Send ONE error response if anything fails
    console.error("Upload Profile Image Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during profile image upload.",
    });
  }
};

// ------------------ EXPORTS -------------------
export { refreshToken, logoutUser, Signup, Login, uploadProfileImage };
