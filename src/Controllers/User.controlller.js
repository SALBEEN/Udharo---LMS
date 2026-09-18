// user login setup here
import User from "../Schemas/User.schema.js";
import admin from "firebase-admin";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// ----------------- LOGOUT -------------------

export const Signup = async (req, res) => {
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
    message: "User logged in successfully.",
    token: token,
  });
};

export { Login };
