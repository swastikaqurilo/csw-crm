const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "payment-2026"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

const getNextSequence = async (key, session = null) => {
  const options = { new: true, upsert: true };
  if (session) options.session = session;

  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    options
  );
  return doc.seq;
};

module.exports = { Counter, getNextSequence };
