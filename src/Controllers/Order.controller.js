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
    const { productId, rentalStartDate, rentalEndDate, quantity } = req.body;
    const renterId = req.user._id;

    if (!productId || !rentalStartDate || !rentalEndDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const reqQuantity = quantity || 1;
    if (product.stock < reqQuantity) {
      return res.status(400).json({ message: "Product is out of stock" });
    }

    let rentalDays = Math.ceil(
      (new Date(rentalEndDate) - new Date(rentalStartDate)) /
        (1000 * 60 * 60 * 24),
    );
    if (rentalDays === 0) rentalDays = 1;

    // NEW: Calculate specific cost splits
    const rentalCost = rentalDays * product.pricePerDay * reqQuantity;
    const securityDeposit = product.damageFund * reqQuantity;
    const totalCost = rentalCost + securityDeposit;

    const order = new Order({
      product: productId,
      renter: renterId,
      lender: product.owner,
      rentalStartDate,
      rentalEndDate,
      rentalCost, // Saved to DB
      securityDeposit, // Saved to DB
      totalCost,
      status: "Pending",
    });

    await order.save();
    res.status(201).json({ message: "Order created successfully", order });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const getIncomingOrders = async (req, res) => {
  try {
    const lenderId = req.user._id;
    const orders = await Order.find({ lender: lenderId })
      .populate("product", "name imageUrl")
      .populate("renter", "name phoneNumber") // Fetches Renter's phone number
      .sort({ createdAt: -1 });

    res.status(200).json({ message: "Incoming orders fetched", orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const getMyRentals = async (req, res) => {
  try {
    const renterId = req.user._id;
    const rentals = await Order.find({ renter: renterId })
      .populate("product", "name imageUrl")
      .populate("lender", "name storeAddress phoneNumber"); // Fetches Lender's phone number

    res.status(200).json({ message: "My rentals fetched", rentals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const getLenderStats = async (req, res) => {
  try {
    const targetLenderId = req.params.lenderId;
    const isOwner = req.user && req.user.id === targetLenderId;

    // Advanced Aggregation: Perfectly calculates real earnings
    const stats = await Order.aggregate([
      {
        $match: {
          lender: new mongoose.Types.ObjectId(targetLenderId),
          status: { $in: ["Completed", "Completed (Damaged)"] },
        },
      },
      {
        $group: {
          _id: null,
          totalSuccessfulRentals: { $sum: 1 },
          totalGrossRevenue: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Completed (Damaged)"] },
                { $add: ["$rentalCost", "$securityDeposit"] }, // Keeps deposit if damaged
                "$rentalCost", // Standard return: Only earns the rental fee!
              ],
            },
          },
        },
      },
    ]);

    let responseData = { totalRentals: 0 };
    if (stats.length > 0) {
      responseData.totalRentals = stats[0].totalSuccessfulRentals;
      if (isOwner) responseData.totalRevenue = stats[0].totalGrossRevenue;
    }

    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error calculating stats" });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, newStatus, action, rejectionNote, note } = req.body;

    if (!orderId)
      return res.status(400).json({ message: "Order ID is required" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Identify who is making the request
    const isLender = String(order.lender) === String(req.user._id);
    const isRenter = String(order.renter) === String(req.user._id);

    // ==========================================
    // 1. PAYMENT & SCREENSHOT ACTIONS
    // ==========================================

    // Renter removes their own screenshot
    if (action === "remove_screenshot") {
      if (!isRenter) return res.status(403).json({ message: "Not authorized" });
      order.paymentProofImage = null;
      order.paymentStatus = "Pending";
      order.paymentRejectionNote = "";
      await order.save({ validateModifiedOnly: true });
      return res
        .status(200)
        .json({ message: "Screenshot removed successfully", order });
    }

    // Lender rejects the payment screenshot
    if (action === "reject_payment") {
      if (!isLender)
        return res
          .status(403)
          .json({ message: "Only lenders can reject payments." });
      order.paymentProofImage = null;
      order.paymentStatus = "Rejected";
      order.paymentRejectionNote =
        rejectionNote || "Screenshot was unclear or invalid.";
      await order.save({ validateModifiedOnly: true });
      return res.status(200).json({ message: "Payment rejected", order });
    }

    // Lender verifies payment
    if (action === "verify_payment") {
      if (!isLender)
        return res
          .status(403)
          .json({ message: "Only lenders can verify payments." });
      if (order.status === "Pending") {
        return res.status(400).json({
          message: "You must accept the order before verifying the payment.",
        });
      }
      order.paymentStatus = "Completed";
      order.paymentRejectionNote = "";
      await order.save({ validateModifiedOnly: true });
      return res
        .status(200)
        .json({ message: "Payment verified successfully", order });
    }

    // ==========================================
    // 2. DAMAGE & RETURN ACTIONS
    // ==========================================

    // Lender confirms item returned safely (No Damage)
    if (action === "complete_safe_return") {
      if (!isLender) return res.status(403).json({ message: "Not authorized" });
      if (order.status !== "Return Pending" && order.status !== "Active") {
        return res
          .status(400)
          .json({ message: "Order must be active or return pending." });
      }

      const returnedProduct = await Product.findById(order.product);
      returnedProduct.stock += 1;
      returnedProduct.isAvailable = true;
      await returnedProduct.save();

      order.status = "Completed";
      order.damageFundStatus = "Refunded";
      await order.save({ validateModifiedOnly: true });
      return res
        .status(200)
        .json({ message: "Safe return confirmed. Deposit refunded.", order });
    }

    // Lender reports damage
    if (action === "report_damage") {
      if (!isLender) return res.status(403).json({ message: "Not authorized" });

      order.status = "Damage Claimed";
      order.damageReportNote =
        note || "Lender reported damage without details.";
      order.damageFundStatus = "Claimed";
      await order.save({ validateModifiedOnly: true });
      return res
        .status(200)
        .json({ message: "Damage reported. Renter notified.", order });
    }

    // Renter accepts the damage charge
    if (action === "accept_damage_charge") {
      if (!isRenter) return res.status(403).json({ message: "Not authorized" });

      const damagedProduct = await Product.findById(order.product);
      damagedProduct.stock += 1; // Return it to inventory, though lender might need to fix it
      damagedProduct.isAvailable = true;
      await damagedProduct.save();

      order.status = "Completed (Damaged)";
      order.damageFundStatus = "Claimed";
      await order.save({ validateModifiedOnly: true });
      return res
        .status(200)
        .json({ message: "Damage charge accepted.", order });
    }

    // Renter disputes the damage
    if (action === "dispute_damage") {
      if (!isRenter) return res.status(403).json({ message: "Not authorized" });
      order.status = "Disputed";
      order.damageFundStatus = "Disputed";
      await order.save({ validateModifiedOnly: true });
      return res
        .status(200)
        .json({ message: "Damage disputed. Admin notified.", order });
    }

    // ==========================================
    // 3. STANDARD STATUS TRANSITIONS (Accept/Cancel)
    // ==========================================

    // Fallback checks for standard status updates
    const isRenterCancelling = isRenter && newStatus === "Cancelled";
    if (!isLender && !isRenterCancelling && newStatus) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this order" });
    }

    if (newStatus) {
      switch (newStatus) {
        case "Active":
          if (order.status !== "Pending")
            return res
              .status(400)
              .json({ message: "Order is no longer pending." });
          const product = await Product.findById(order.product);
          if (product.stock <= 0)
            return res.status(400).json({ message: "Product out of stock!" });
          product.stock -= 1;
          if (product.stock === 0) product.isAvailable = false;
          await product.save();
          order.status = "Active";
          break;

        case "Cancelled":
          if (order.status !== "Pending")
            return res
              .status(400)
              .json({ message: "Only pending orders can be cancelled." });
          order.status = "Cancelled";
          break;

        case "Completed":
          // Safe fallback if they hit the old manual Complete route
          if (order.status !== "Return Pending" && order.status !== "Active") {
            return res
              .status(400)
              .json({ message: "Order must be returned by renter first." });
          }
          const completedProduct = await Product.findById(order.product);
          completedProduct.stock += 1;
          completedProduct.isAvailable = true;
          await completedProduct.save();

          order.status = "Completed";
          order.damageFundStatus = "Refunded";
          break;

        default:
          return res.status(400).json({ message: "Invalid status transition" });
      }
      await order.save({ validateModifiedOnly: true });
      return res.status(200).json({ message: "Order status updated", order });
    }

    return res
      .status(400)
      .json({ message: "No valid action or status provided." });
  } catch (error) {
    console.error("Status Update Error:", error);
    res.status(500).json({ message: "Server error updating status." });
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
