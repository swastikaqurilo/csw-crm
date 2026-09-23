const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");

dotenv.config();

const app = express();

const enquiryRoutes = require("./routes/enquiryRoutes");
const contactRoutes = require("./routes/contactRoutes");
const followUpRoutes = require("./routes/followUpRoutes");
const productRoutes = require("./routes/productRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const revenueRoutes = require("./routes/revenueRoutes");

const personRoutes = require("./routes/personRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const accountingRoutes = require("./routes/accountingRoutes");


const authRoutes = require("./routes/authRoutes");
const { protect } = require("./middleware/auth");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://csw-crm.vercel.app",
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


app.use("/api/auth", authRoutes); 
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/follow-ups", followUpRoutes);
app.use("/api/products", productRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/revenue", revenueRoutes);
app.use("/api/people", personRoutes);
app.use("/api/expense", expenseRoutes);
app.use("/api/accounting", accountingRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CSW CRM API running on http://localhost:${PORT}`);
  });
}

module.exports = app;