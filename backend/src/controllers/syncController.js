const Contact = require("../models/Contacts");
const ProductStock = require("../models/ProductStock");

const MAX_PAGE = 500;

const CONTACT_PROJECTION = { __v: 0 };
const PRODUCT_PROJECTION = { __v: 0, movementLog: 0 };

function parseSince(raw) {
  if (!raw) return new Date(0);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

async function deltaFeed(Model, projection, since, limit) {
  const serverTime = new Date();
  const docs = await Model.find(
    { updatedAt: { $gt: since, $lte: serverTime } },
    projection
  )
    .sort({ updatedAt: 1 })
    .limit(limit)
    .lean();

  const records = [];
  const tombstones = [];
  for (const doc of docs) {
    if (doc.deletedAt) {
      tombstones.push({
        _id: doc._id,
        deletedAt: doc.deletedAt,
        updatedAt: doc.updatedAt,
        version: doc.version,
      });
    } else {
      records.push(doc);
    }
  }

  const hasMore = docs.length === limit;
  const checkpoint = docs.length ? docs[docs.length - 1].updatedAt : since;

  return { serverTime, checkpoint, hasMore, records, tombstones };
}

async function getContactsDelta(req, res, next) {
  try {
    const since = parseSince(req.query.since);
    const limit = Math.min(parseInt(req.query.limit || "200", 10), MAX_PAGE);
    const payload = await deltaFeed(Contact, CONTACT_PROJECTION, since, limit);
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

async function getProductsDelta(req, res, next) {
  try {
    const since = parseSince(req.query.since);
    const limit = Math.min(parseInt(req.query.limit || "200", 10), MAX_PAGE);
    const payload = await deltaFeed(ProductStock, PRODUCT_PROJECTION, since, limit);
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

module.exports = { getContactsDelta, getProductsDelta };