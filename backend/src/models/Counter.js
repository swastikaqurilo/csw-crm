const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const Counter = mongoose.model("Counter", counterSchema);

const getNextSequence = async (key, session = null) => {
  if (!key || typeof key !== "string") {
    throw new Error("getNextSequence: key is required");
  }

  const options = { new: true, upsert: true, setDefaultsOnInsert: true };
  if (session) options.session = session;

  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    options
  );

  if (!doc) {
    throw new Error(`getNextSequence failed for key: ${key}`);
  }

  return doc.seq;
};

module.exports = { Counter, getNextSequence };