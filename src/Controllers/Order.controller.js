/*  
1. Requesting a Rental (Create Order)
This is the entry point when a renter clicks "Book Now."

Trigger: The Renter submits desired start and end dates.

Validation: The controller checks if the requested dates are valid (start date isn't in the past) and confirms the product has available stock.

Calculation: It calculates the total rental duration in days, multiplies it by the pricePerDay, and adds the damageFund to set the total transaction value.

Action: It creates the order with a Pending status. No stock is deducted yet, as the lender hasn't approved the request.





2. The Lender Dashboard (Get Incoming Orders)
Lenders need a centralized view to manage their business operations.

Trigger: The Lender opens their dashboard.

Action: The controller fetches all orders where the logged-in user is listed as the lender.

Delivery: It sorts these orders by status so the lender sees Pending requests at the top, followed by Active rentals out in the field, and Completed history at the bottom.




3. The Renter Dashboard (Get My Rentals)
Renters need to track what they have booked, what they currently possess, and pickup locations.

Trigger: The Renter opens their rental history.

Action: The controller fetches all orders tied to their user ID.

Delivery: It populates the product details (images, name) and the lender's details (specifically the storeAddress for pickup) so the renter has all logistical information in one place.




4. The State Machine (Update Order Status)
This is the most critical function. It handles the lifecycle of the rental and enforces inventory rules.

Approval (Pending -> Active): When a lender approves a request, the controller changes the status to Active. It must immediately reach into the Product database and decrease the available stock by 1. If stock hits 0, it switches the product's isAvailable flag to false.

Rejection (Pending -> Cancelled): If the lender declines, the status simply changes to Cancelled. No stock changes occur.

Completion (Active -> Completed): When the renter returns the spare part and the lender verifies it is undamaged, the status updates to Completed. The controller must then increase the product's stock by 1 and flip isAvailable back to true if it was previously false.

*/

// order controller

// ---------- IMPORTS ----------
import mongoose from "mongoose";
import Order from "../Schemas/Order.schema.js";
import Product from "../Schemas/Product.schema.js";
import User from "../Schemas/User.schema.js";
import { v2 as cloudinary } from "cloudinary";

// ---------- CONTROLLER FUNCTIONS ----------

const createOrder = async (req, res) => {
  try {
    const { productId, rentalStartDate, rentalEndDate } = req.body;
    const renterId = req.user._id; // Assuming user ID is available in the request

    // Validate required fields
    if (!productId || !rentalStartDate || !rentalEndDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Fetch product details
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check stock availability
    if (product.stock <= 0) {
      return res.status(400).json({ message: "Product is out of stock" });
    }

    // Calculate total cost
    let rentalDays = Math.ceil(
      (new Date(rentalEndDate) - new Date(rentalStartDate)) /
        (1000 * 60 * 60 * 24),
    );
    if (rentalDays === 0) rentalDays = 1; // Same-day rental counts as 1 day
    const totalCost = rentalDays * product.pricePerDay + product.damageFund;

    // Create order
    const order = new Order({
      product: productId,
      renter: renterId,
      lender: product.owner, // Assuming the product has a lender field
      rentalStartDate,
      rentalEndDate,
      totalCost,
      status: "Pending",
    });

    await order.save();

    res.status(201).json({ message: "Order created successfully", order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const getIncomingOrders = async (req, res) => {
  try {
    const lenderId = req.user._id; // Assuming user ID is available in the request

    // Fetch orders where the logged-in user is the lender
    const orders = await Order.find({ lender: lenderId }).sort({
      createdAt: -1, // Sort by creation date (newest first)
    });

    res.status(200).json({ message: "Incoming orders fetched", orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const getMyRentals = async (req, res) => {
  try {
    const renterId = req.user._id; // Assuming user ID is available in the request

    // Fetch orders where the logged-in user is the renter
    const rentals = await Order.find({ renter: renterId })
      .populate("product", "name imageUrl") // Populate product details
      .populate("lender", "storeAddress"); // Populate lender details

    res.status(200).json({ message: "My rentals fetched", rentals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    // 1. Extract the 'action' variable alongside newStatus
    const { orderId, newStatus, action } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (String(order.lender) !== String(req.user._id)) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this order" });
    }

    // 2. NEW: Handle standalone Payment Verification
    if (action === "verify_payment") {
      if (order.status === "Pending") {
        return res.status(400).json({
          message: "You must accept the order before verifying the payment.",
        });
      }
      order.paymentStatus = "Completed";
      await order.save({ validateModifiedOnly: true });
      return res
        .status(200)
        .json({ message: "Payment verified successfully", order });
    }

    // 3. Handle standard status transitions
    switch (newStatus) {
      case "Active":
        if (order.status !== "Pending") {
          return res
            .status(400)
            .json({ message: "Order is no longer pending." });
        }
        const product = await Product.findById(order.product);
        if (product.stock <= 0) {
          return res.status(400).json({
            message: "Product out of stock! Complete past returns first.",
          });
        }
        product.stock -= 1;
        if (product.stock === 0) product.isAvailable = false;
        await product.save();

        order.status = "Active";
        // REMOVED: order.paymentStatus = "Completed"; (Payment is now handled separately!)
        break;

      case "Cancelled":
        if (order.status !== "Pending") {
          return res
            .status(400)
            .json({ message: "Only pending orders can be cancelled." });
        }
        order.status = "Cancelled";
        break;

      case "Completed":
        if (order.status !== "Return Pending" && order.status !== "Active") {
          return res
            .status(400)
            .json({ message: "Order must be returned by renter first." });
        }
        const completedProduct = await Product.findById(order.product);

        const endD = new Date(order.rentalEndDate);
        const actualD = new Date(order.actualReturnDate || new Date());
        if (actualD < endD) {
          const unusedTime = endD - actualD;
          const unusedDays = Math.floor(unusedTime / (1000 * 60 * 60 * 24));
          if (unusedDays > 0) {
            const refundAmount = unusedDays * completedProduct.pricePerDay;
            order.notes = `Early Return: Refund Renter Rs. ${refundAmount}`;
            order.paymentStatus = "Refund Owed";
          }
        }

        completedProduct.stock += 1;
        if (completedProduct.stock > 0) completedProduct.isAvailable = true;
        await completedProduct.save();

        order.status = "Completed";
        order.damageFundStatus = "Refunded";
        break;

      default:
        return res.status(400).json({ message: "Invalid status transition" });
    }

    await order.save({ validateModifiedOnly: true });
    res.status(200).json({ message: "Order status updated", order });
  } catch (error) {
    console.error("Status Update Error:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    res.status(500).json({ message: "Server error updating status." });
  }
};
const getLenderStats = async (req, res) => {
  try {
    // 1. Get the target lender's ID from the URL (e.g., /api/orders/stats/64f1a2b...)
    const targetLenderId = req.params.lenderId;

    // 2. Check who is making the request (using the protect middleware)
    // If the logged-in user's ID matches the target ID, they are the owner.
    const isOwner = req.user && req.user.id === targetLenderId;

    // 3. Perform the aggregation for completed orders
    const stats = await Order.aggregate([
      {
        $match: {
          lender: new mongoose.Types.ObjectId(targetLenderId),
          status: "Completed",
        },
      },
      {
        $group: {
          _id: null,
          totalSuccessfulRentals: { $sum: 1 },
          totalGrossRevenue: { $sum: "$totalCost" },
        },
      },
    ]);

    // 4. Default baseline if they have no completed orders yet
    let responseData = { totalRentals: 0 };

    if (stats.length > 0) {
      responseData.totalRentals = stats[0].totalSuccessfulRentals;

      // 5. Privacy Check: Only attach revenue if the requester is the Lender themselves
      if (isOwner) {
        responseData.totalRevenue = stats[0].totalGrossRevenue;
      }
    }

    res.status(200).json({
      success: true,
      message: "Lender statistics fetched successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Lender Stats Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error calculating stats" });
  }
};

// NEW: Renter uploads payment screenshot
const uploadPaymentProof = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (String(order.renter) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (req.file) {
      // Assuming you imported cloudinary at the top
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "udharo_payments",
      });
      order.paymentProofImage = result.secure_url;
      order.paymentStatus = "Partial"; // Changes status so lender knows to check it
      await order.save();

      return res.status(200).json({ message: "Payment proof uploaded", order });
    }

    res.status(400).json({ message: "No image provided" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// NEW: Renter initiates the return process
const initiateReturn = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (String(order.renter) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (order.status !== "Active") {
      return res
        .status(400)
        .json({ message: "Only active orders can be returned" });
    }

    order.status = "Return Pending";
    order.actualReturnDate = new Date(); // Locks in the exact day they returned it!

    await order.save();
    res.status(200).json({
      message: "Return initiated. Waiting for lender approval.",
      order,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// EXPORT CONTROLLER FUNCTIONS

export {
  getLenderStats,
  createOrder,
  getIncomingOrders,
  getMyRentals,
  updateOrderStatus,
  uploadPaymentProof,
  initiateReturn,
};
