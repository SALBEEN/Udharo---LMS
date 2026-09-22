// ----------------- IMPORTS -------------------
import User from "../Schemas/User.schema.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// ----------------- SIGNUP -------------------

const Signup = async (req, res) => {
  const {
    name,
    email,
    password,
    phoneNumber,
    role,
    lenderAddress,
    storeAddress,
  } = req.body;

  // 1. Check required input fields
  if (!name || !email || !password || !phoneNumber || !role) {
    return res.status(400).json({
      success: false,
      message: "Name, email, password, phoneNumber, and role are required.",
    });
  }

  if (role !== "lender" && role !== "renter") {
    return res.status(400).json({
      success: false,
      message: 'Role must be either "lender" or "renter".',
    });
  }

  if (role === "lender" && !storeAddress) {
    return res.status(400).json({
      success: false,
      message: "Store address is required for lenders.",
    });
  }

  if (role === "renter" && !lenderAddress) {
    return res.status(400).json({
      success: false,
      message: "Lender address is required for renters.",
    });
  }

  try {
    // 2. Check if user already exists (using plain email or hashing if you prefer)
    // Note: If you hash emails before saving, you'll want to check existence carefully.
    // For standard lookup, storing a hashed email or lowercase email works best.
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists.",
      });
    }

    // 3. Hashing sensitive data (password and phone number)
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPhoneNumber = await bcrypt.hash(phoneNumber, 10);

    // 4. Save the user to the database
    const user = new User({
      name,
      email,
      phoneNumber: hashedPhoneNumber,
      password: hashedPassword,
      role,
      lenderAddress: role === "renter" ? lenderAddress : undefined,
      storeAddress: role === "lender" ? storeAddress : undefined,
    });

    await user.save();

    // 5. Generate JWT Token
    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRE_IN,
      },
    );

    // 6. Send response
    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      success: true,
      message: "User registered successfully.",
      token: token,
    });
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during registration.",
    });
  }
};

// --------------- LOGIN -------------------

const Login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }

  try {
    // 1. Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // 2. Compare the password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid password.",
      });
    }

    // 3. Generate JWT tokens
    const accessToken = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRE_IN,
      },
    );

    const refreshToken = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRE_IN,
      },
    );

    // 4. Set the refresh token in the cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // set to true in production
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // 5. Send response
    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      success: true,
      accessToken: accessToken,
      message: "User logged in successfully.",
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login.",
    });
  }
};

// ----------------- REFRESH TOKEN -------------------

const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No refresh token provided. Please log in.",
      });
    }

    jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: "Invalid or expired refresh token. Please log in again.",
        });
      }

      const newAccessToken = jwt.sign(
        { id: decoded.id, role: decoded.role, email: decoded.email },
        process.env.JWT_SECRET,
        { expiresIn: "15m" },
      );

      return res.status(200).json({
        success: true,
        accessToken: newAccessToken,
      });
    });
  } catch (error) {
    console.error("Refresh Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error during token refresh." });
  }
};

// ------------------- LOG OUT ------------------

const logoutUser = (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res
    .status(200)
    .json({ success: true, message: "Logged out successfully." });
};

// ------------------ UPLOAD PROFILE IMAGE -------------------

const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Please select an image.",
      });
    }

    const result = await uploadToCloudinary(req.file.buffer, "udharo_profiles");

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: result.secure_url },
      { new: true },
    ).select("-password");

    return res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Upload Profile Image Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during profile image upload.",
    });
  }
};

// ------------------ EXPORTS -------------------
export { refreshToken, logoutUser, Signup, Login, uploadProfileImage };
