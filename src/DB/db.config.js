import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(process.env.DATABASE_URI);
    console.log(
      `Mongo DB connected!! DB Host: ${connectionInstance.connection.host}`,
    );
  } catch (error) {
    console.log("ERROR OCCURED----> : ", error);
    process.exit(1);
  }
};

export default connectDB;
