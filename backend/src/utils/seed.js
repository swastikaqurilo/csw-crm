const mongoose = require("mongoose");
require("dotenv").config();

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/csw-crm";

async function clearAll() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected →", MONGO_URI);

    const db = mongoose.connection.db;

    // List every collection in the current database
    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
      console.log("No collections found. Nothing to delete.");
    } else {
      console.log(`Found ${collections.length} collections. Clearing...\n`);

      for (const { name } of collections) {
        const result = await db.collection(name).deleteMany({});
        console.log(`  ✓ ${name}: deleted ${result.deletedCount} documents`);
      }
    }

    console.log("\n========================================");
    console.log("       ALL COLLECTIONS CLEARED");
    console.log("========================================");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("\nDELETE ERROR:");
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

clearAll();