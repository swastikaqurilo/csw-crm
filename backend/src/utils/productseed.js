require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const ProductProduction = require("../models/Product");

const day = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};

const RATES = { rate2kg: 185, rate5kg: 460, rate8kg: 740, rate10kg: 920 };

const DATA = [
  { date: day(6), qty2kg: 120, qty5kg: 80,  qty8kg: 45, qty10kg: 30, ...RATES, notes: "Regular day shift production" },
  { date: day(5), qty2kg: 140, qty5kg: 75,  qty8kg: 50, qty10kg: 28, ...RATES, notes: "Slight dip in 5kg output" },
  { date: day(4), qty2kg: 110, qty5kg: 95,  qty8kg: 60, qty10kg: 35, ...RATES, notes: "Bigger 8kg batch for a bulk order" },
  { date: day(3), qty2kg: 130, qty5kg: 90,  qty8kg: 55, qty10kg: 40, ...RATES, notes: "Full capacity day" },
  { date: day(2), qty2kg: 100, qty5kg: 70,  qty8kg: 40, qty10kg: 25, ...RATES, notes: "Half day - maintenance" },
  { date: day(1), qty2kg: 145, qty5kg: 100, qty8kg: 65, qty10kg: 42, ...RATES, notes: "Strong day, all machines running" },
  { date: day(0), qty2kg: 90,  qty5kg: 60,  qty8kg: 35, qty10kg: 20, ...RATES, notes: "Day in progress" },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/csw-crm");
    console.log("MongoDB connected");

    const cleared = await ProductProduction.deleteMany({});
    console.log(`Cleared ${cleared.deletedCount} existing entries`);

    const docs = await ProductProduction.insertMany(DATA);
    console.log(`Inserted ${docs.length} production entries:`);

    for (const d of docs) {
      const reels = d.qty2kg + d.qty5kg + d.qty8kg + d.qty10kg;
      const kg = d.qty2kg * 2 + d.qty5kg * 5 + d.qty8kg * 8 + d.qty10kg * 10;
      const value = d.qty2kg * d.rate2kg + d.qty5kg * d.rate5kg + d.qty8kg * d.rate8kg + d.qty10kg * d.rate10kg;
      console.log(`  ${d.date.toISOString().slice(0,10)}  ${String(reels).padStart(4)} reels  ${String(kg).padStart(5)} kg  Rs.${value.toLocaleString("en-IN")}`);
    }

    console.log("\nDone.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
})();