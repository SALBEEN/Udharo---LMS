// ----------------- IMPORTS -------------------
import User from "../Schemas/User.schema.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import sendEmail from "../Utilities/sendEmail.utilities.js";

// ----------------- SIGNUP -------------------

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

  if (!name || !email || !password || !phoneNumber || !role) {
    return res
      .status(400)
      .json({ success: false, message: "All required fields must be filled." });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: "User with this email already exists.",
        });
      }
      // Overwrite pending registration details
      await User.deleteOne({ email });
    }

    // Hash data
    const hashedPassword = await bcrypt.hash(password, 10);
    // const hashedPhoneNumber = await bcrypt.hash(phoneNumber, 10);

    // 1. 👉 OTP is generated and DEFINED here
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const emailOtpExpiresAt = Date.now() + 10 * 60 * 1000;

    // Save user as unverified
    const newUser = new User({
      name,
      email,
      phoneNumber: phoneNumber,
      password: hashedPassword,
      role,
      lenderAddress: role === "renter" ? lenderAddress : undefined,
      storeAddress: role === "lender" ? storeAddress : undefined,
      isEmailVerified: false,
      emailOtp: otp,
      emailOtpExpiresAt,
    });

    await newUser.save();

    // 2. 👉 Email is SENT here (Now it knows what 'otp' is!)
    await sendEmail(
      email,
      "Udharo LMS - Verify Your Account",
      `Welcome to Udharo! Your verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
    );

    console.log(`🔑 Verification OTP for ${email}: ${otp}`);

    return res.status(200).json({
      success: true,
      message:
        "Registration initiated! Please check your email for the verification code.",
    });
  } catch (error) {
    console.error("Signup Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error during registration." });
  }
};

// ----------------- STEP 2: VERIFY OTP & FLAG EMAIL -------------------
const VerifyEmailOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res
      .status(400)
      .json({ success: false, message: "Email and OTP code are required." });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified. Please login.",
      });
    }

    if (!user.emailOtp || user.emailOtp !== otp) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid verification code." });
    }

    if (Date.now() > user.emailOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please sign up again.",
      });
    }

    // Flag email as verified and clear OTP fields
    user.isEmailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpiresAt = undefined;
    await user.save();

    // Generate login token upon successful verification
    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE_IN },
    );

    return res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error during verification." });
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
      success: true,
      token: accessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role, // <--- Make sure this is explicitly being sent!
      },
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

const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // Generate 6-digit OTP & 10-minute expiry (reusing the email verification fields)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOtp = otp;
    user.emailOtpExpiresAt = Date.now() + 10 * 60 * 1000;

    await user.save();

    await sendEmail(
      email,
      "Udharo LMS - Password Reset Code",
      `You requested a password reset. Your OTP code is: ${otp}\n\nIf you did not request this, please ignore this email.`,
    );

    return res.status(200).json({
      success: true,
      message: "Password reset OTP sent to your email.",
    });
  } catch (error) {
    console.error("Request Password Reset Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error sending reset code." });
  }
};

const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (!user.emailOtp || user.emailOtp !== otp) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid reset code." });
    }

    if (Date.now() > user.emailOtpExpiresAt) {
      return res
        .status(400)
        .json({ success: false, message: "Reset code has expired." });
    }

    // Hash new password and clear OTP fields
    user.password = await bcrypt.hash(newPassword, 10);
    user.emailOtp = undefined;
    user.emailOtpExpiresAt = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully! You can now log in.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error resetting password." });
  }
};

// ------------------ EXPORTS -------------------
export {
  refreshToken,
  logoutUser,
  Signup,
  Login,
  uploadProfileImage,
  VerifyEmailOtp,
  requestPasswordReset,
  resetPassword,
};
