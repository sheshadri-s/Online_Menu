const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch((err) => {
  console.error(`MongoDB connection error: ${err.message}`);
  process.exit(1); // Exit the process with failure if the connection fails
});

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const Razorpay = require('razorpay');

// Initialize environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });

// Create Express app
const app = express();
const port = process.env.PORT || 5000;

// Middleware setup
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Cart model
const cartSchema = new mongoose.Schema({
  userId: String, // Add userId to identify which user the cart belongs to
  name: String,
  price: Number,
  image: String,
  quantity: { type: Number, default: 1 }
});


const Cart = mongoose.model('Cart', cartSchema);

// Category model
const CategorySchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

const Category = mongoose.model('Category', CategorySchema);

// Product model
const ProductSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  }
}, {
  timestamps: true
});

const Product = mongoose.model('Product', ProductSchema);

// Define the Order schema
const orderSchema = new mongoose.Schema({
  name: String,
  mobile: String,
  totalAmount: Number,
  products: Array,
  date: { type: Date, default: Date.now },
});

// Create the Order model
const Order = mongoose.model('Order', orderSchema);

const adminSchema = new mongoose.Schema({
  adminId: { type: String, required: true },
  password: { type: String, required: true },
});

// Create the Admin model
const Admin = mongoose.model('Admin', adminSchema);

// Function to set initial admin credentials
async function setInitialAdminCredentials() {
  try {
    // Check if admin credentials already exist
    const adminExists = await Admin.findOne({ adminId: 'Admin' });
    if (!adminExists) {
      // If not, create the admin credentials
      const newAdmin = new Admin({ adminId: '', password: '' });
      await newAdmin.save();
      console.log('Admin credentials set successfully.');
    } else {
      console.log('Admin credentials already exist.');
    }
  } catch (error) {
    console.error('Error setting admin credentials:', error);
  }
}

// Function to validate admin credentials
async function validateAdminCredentials(adminId, password) {
  try {
    const admin = await Admin.findOne({ adminId, password });
    return !!admin; // Returns true if credentials are correct, false otherwise
  } catch (error) {
    console.error('Error validating admin credentials:', error);
    return false;
  }
}

module.exports = { setInitialAdminCredentials, validateAdminCredentials };


app.post('/validate-admin', async (req, res) => {
  const { adminId, password } = req.body;
  const isValid = await validateAdminCredentials(adminId, password);
  res.json({ isValid });
});


app.post('/submitOrder', async (req, res) => {
  const { name, mobile, amount, products } = req.body;
  
  try {
      const newOrder = new Order({
          name,
          mobile,
          totalAmount: amount,
          products,
          status: 'Undelivered'
      });
      
      await newOrder.save();
      res.status(201).json({ message: 'Order saved successfully', order: newOrder });
  } catch (error) {
      res.status(500).json({ message: 'Failed to save order', error });
  }
});


// Fetch orders
app.get('/getOrders', async (req, res) => {
  try {
    const orders = await Order.find();
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

// Example Express.js route to update order status
app.post('/updateOrderStatus/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (status !== 'Delivered') {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'Delivered') {
      return res.status(400).json({ message: 'Order is already delivered' });
    }

    order.status = status;
    await order.save();
    res.status(200).json({ message: 'Order status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update status' });
  }
});



// Routes for Categories
app.post('/addCategories', upload.single('categoryImage'), async (req, res) => {
  const { name } = req.body;
  const image = req.file ? req.file.path : '';
  try {
    const newCategory = new Category({ name, image });
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add category' });
  }
});

app.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Update category
app.put('/categories/:id', upload.single('categoryImage'), async (req, res) => {
  try {
    const { name } = req.body;
    const image = req.file ? req.file.path : null; // Check if there's an image

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      { name, imageUrl: image },
      { new: true }
    );

    res.status(200).json(updatedCategory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});
// Delete category
app.delete('/categories/:id', async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});


// Routes for Products
app.post('/addProducts', upload.single('productImage'), async (req, res) => {
  const { name, price, category } = req.body;
  const image = req.file ? req.file.path : '';
  try {
    const newProduct = new Product({ name, price, image, category });
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// GET /products
app.get('/products', async (req, res) => {
  try {
    const { category, available } = req.query;
    const query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (available) {
      query.available = available === 'true'; // Convert query string to boolean
    }
    
    const products = await Product.find(query);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
});



app.get('/products/:categoryId', async (req, res) => {
  const { categoryId } = req.params;
  try {
    const products = await Product.find({ category: categoryId });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});


app.delete('/products/:productId', async (req, res) => {
  const { productId } = req.params;
  try {
    const result = await Product.findByIdAndDelete(productId);
    if (!result) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(200).json({ message: 'Product removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.put('/products/:id', upload.single('productImage'), async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, price } = req.body;
    const updateData = { name, price };

    if (req.file) {
      // Handle file upload
      updateData.image = req.file.filename;
    }

    const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, { new: true });
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update product', error });
  }
});

app.patch('/products/:productId', async (req, res) => {
  const { productId } = req.params;
  const { available } = req.body;
  try {
    const product = await Product.findByIdAndUpdate(productId, { available }, { new: true });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product availability' });
  }
});

//Payment
// Configure Razorpay SDK
const razorpay = new Razorpay({
  key_id: 'rzp_live_eHl1IKa1mogqyP',
  key_secret: '59ZVbFLT54EgMi9n7EtJh7cD'
});

// Create order route
app.post('/pay', async (req, res) => {
  try {
    // Extract the amount from the request body
    const { amount } = req.body;

    // Ensure the amount is in paise
    const amountInPaise = Math.round(parseFloat(amount) * 100);

    const options = {
      amount: amountInPaise, // Use the dynamic amount in paise
      currency: 'INR',
      receipt: 'receipt#1',
      payment_capture: 1 // Automatically capture payment
    };

    // Assuming you have Razorpay set up
    const razorpayInstance = new Razorpay({ key_id: 'rzp_live_eHl1IKa1mogqyP', key_secret: '59ZVbFLT54EgMi9n7EtJh7cD' });

    // Create order
    const order = await razorpayInstance.orders.create(options);
    
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error('Payment Error:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

setInitialAdminCredentials();

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
