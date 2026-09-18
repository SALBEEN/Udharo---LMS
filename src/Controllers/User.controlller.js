// user login setup here
import User from "../Schemas/User.schema.js";

const Signup = async (req, res) => {
  const { name, phoneNumber, password, lenderAddress, storeAddress } = req.body;

  if (!name || !phoneNumber || !password || !lenderAddress || !storeAddress) {
    return res.status(400).json({
      success: false,
      message:
        "All fields (name, phoneNumber, password, lenderAddress, storeAddress) are required.",
    });
  }

  // check if user exists

  const user = await User.findOne({ email });
  if (user) {
    res.status(400);
    throw new Error("User already exists");
  }

  // check if password is correct

  // send response
  res.status(200).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    token: generateToken(user._id),
  });
};
