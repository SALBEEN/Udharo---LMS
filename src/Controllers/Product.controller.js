/*
 
 // todo for the product controllers


1. Create Product ("List an Item")
Target Audience: Lenders only.

Business Logic:

Receives the text data (name, price, category, etc.) and an array of image files from the frontend.

Validates that the user is actually a Lender.

Triggers the Cloudinary utility to upload all provided images and retrieves their URLs.

Automatically attaches the logged-in user's ID as the lender.

Saves the new product to the database.



2. Get All Products ("Catalog & Discovery")
Target Audience: Everyone (Public/Renters).

Business Logic:

Fetches products from the database to display on the main feed.

Crucial Feature: Must include Filtering, Sorting, and Pagination. Renters need to be able to filter by category (e.g., "Power Tools"), sort by pricePerDay, and only see items where isAvailable is true. Pagination ensures you only load 20 items at a time instead of crashing the app by loading thousands at once.



3. Get Single Product ("Product Details Page")
Target Audience: Everyone.

Business Logic:

Fetches a specific product using its ID.

Crucial Feature: It needs to "populate" the lender's information. When a renter looks at a drill, the controller should pull the Lender's name and storeAddress from the User database so the renter knows exactly where they are picking the item up.




4. Update Product ("Edit Listing")
Target Audience: The specific Lender who owns the item.

Business Logic:

Allows modifying the price, description, stock, condition, or images.

Crucial Security Feature (Authorization): The controller must check if the logged-in user's ID matches the lender ID on the product. A lender should never be able to edit another lender's product.




5. Toggle Availability ("Quick Status Change")
Target Audience: The specific Lender who owns the item.

Business Logic:

A lightweight, dedicated function that simply flips isAvailable from true to false (or vice versa).

If a piece of equipment breaks in the shop, the Lender needs a one-click button to hide it from the platform without having to go through the full "Edit Listing" screen.



6. Delete Product ("Remove Listing")
Target Audience: The specific Lender who owns the item.

Business Logic:

Removes the item from the database (again, strictly verifying ownership first).

PM Advice: In a rental system, if a product has been rented before, hard-deleting it can break past rental receipts. You might want this function to perform a "Soft Delete" (e.g., setting isArchived: true) instead of completely erasing it from MongoDB.. 


// lender -- who own prioducts and can list their products for rent
// renter -- who can rent the products listed by lenders

*/

// ----------------- Imports -----------------
import Product from "../Schemas/Product.schema.js";
import { cloudinary } from "../Middlewares/cloudinary.middleware.js";
import { asyncHandler } from "../Utilities/AsyncHandler.utilities.js";
import User from "../Schemas/User.schema.js";

// ----------------- Controller Functions -----------------
const createProduct = asyncHandler(async (req, res) => {
  const { name, description, pricePerDay, category, damageFund, stock } =
    req.body;

  // Validate required fields
  if (!name || !description || !pricePerDay || !category || !damageFund) {
    return res.status(400).json({
      success: false,
      message:
        "Missing required fields: name, description, pricePerDay, category, damageFund",
    });
  }

  // Check if the user is a lender
  const user = await User.findById(req.user._id);
  if (!user || user.role !== "lender") {
    return res.status(403).json({
      success: false,
      message: "Only lenders can create products.",
    });
  }

  // Handle image upload to Cloudinary
  let imageUrl = "";
  if (req.file) {
    const result = await cloudinary.uploader.upload(req.file.path);
    imageUrl = result.secure_url;
  } else {
    return res.status(400).json({
      success: false,
      message: "Product image is required.",
    });
  }

  // Create the product
  const newProduct = new Product({
    name,
    description,
    pricePerDay,
    category,
    damageFund,
    stock: stock || 1, // Default to 1 if not provided
    imageUrl,
    owner: req.user._id,
  });

  await newProduct.save();

  res.status(201).json({
    success: true,
    message: "Product created successfully.",
    product: newProduct,
  });
});

export { createProduct };

const getAllProducts = asyncHandler(async (req, res) => {
  const { category, sortByPrice, page = 1, limit = 20 } = req.query;

  const filter = { isAvailable: true };
  if (category) {
    filter.category = category;
  }

  let sort = {};
  if (sortByPrice) {
    sort.pricePerDay = sortByPrice === "asc" ? 1 : -1;
  }

  const products = await Product.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate("owner", "name storeAddress");

  res.status(200).json({
    success: true,
    message: "Products fetched successfully.",
    products,
  });
});

export { getAllProducts };
