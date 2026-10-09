const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

dotenv.config();

const app = express();

const enquiryRoutes = require("./routes/enquiryRoutes");
const contactRoutes = require("./routes/contactRoutes");
const followUpRoutes = require("./routes/followUpRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const revenueRoutes = require("./routes/revenueRoutes");
const workerRoutes = require("./routes/workerRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const accountingRoutes = require("./routes/accountingRoutes");
const rawMaterialRoutes = require("./routes/rawMaterialRoutes");
const settingRoutes = require("./routes/settingRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const salaryRoutes = require("./routes/salaryRoutes");

const authRoutes = require("./routes/authRoutes");
const { protect } = require("./middleware/auth");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://csw-crm.vercel.app",
      "http://192.168.88.6:5173",
      "https://4nq08695-5173.inc1.devtunnels.ms"
    ],
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CSW CRM API is running",
  });
});

// Public auth routes
app.use("/api/auth", authRoutes);

// All business routes require authentication
app.use("/api/enquiries", protect, enquiryRoutes);
app.use("/api/contacts", protect, contactRoutes);
app.use("/api/follow-ups", protect, followUpRoutes);
app.use("/api/products", protect, productRoutes);
app.use("/api/order", protect, orderRoutes);
app.use("/api/payment", protect, paymentRoutes);
app.use("/api/revenue", protect, revenueRoutes);
app.use("/api/workers", protect, workerRoutes);
app.use("/api/expense", protect, expenseRoutes);
app.use("/api/accounting", protect, accountingRoutes);
app.use("/api/raw-material", protect, rawMaterialRoutes);
app.use("/api/settings", protect, settingRoutes);
app.use("/api/notifications", protect, notificationRoutes);
app.use("/api/salaries", protect, salaryRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Central error handler (ValidationError, CastError, duplicate key, etc.)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`CSW CRM API running on http://0.0.0.0:${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Failed to start server:", error);
      process.exit(1);
    });
}

module.exports = app;
