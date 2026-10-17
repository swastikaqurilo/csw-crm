require("dotenv").config();
const mongoose = require("mongoose");
const Contact = require("../models/Contacts");
const ProductStock = require("../models/ProductStock");
const SyncOperation = require("../models/SyncOperation");

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log("[migration] connected");

  const c1 = await Contact.updateMany(
    { deletedAt: { $exists: false } },
    { $set: { deletedAt: null } }
  );
  console.log(`[migration] Contact deletedAt backfilled: ${c1.modifiedCount}`);

  const c2 = await Contact.updateMany(
    { version: { $exists: false } },
    { $set: { version: 1 } }
  );
  console.log(`[migration] Contact version backfilled: ${c2.modifiedCount}`);

  const p1 = await ProductStock.updateMany(
    { deletedAt: { $exists: false } },
    { $set: { deletedAt: null } }
  );
  console.log(`[migration] ProductStock deletedAt backfilled: ${p1.modifiedCount}`);

  const p2 = await ProductStock.updateMany(
    { version: { $exists: false } },
    { $set: { version: 1 } }
  );
  console.log(`[migration] ProductStock version backfilled: ${p2.modifiedCount}`);

  await Contact.syncIndexes();
  await ProductStock.syncIndexes();
  await SyncOperation.syncIndexes();
  console.log("[migration] indexes synced");

  await mongoose.disconnect();
  console.log("[migration] done");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});