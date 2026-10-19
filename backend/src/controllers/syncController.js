const mongoose = require("mongoose");
const Contact = require("../models/Contacts");
const ProductStock = require("../models/ProductStock");

const MAX_PAGE = 500;
const DEFAULT_PAGE = 200;
const EPOCH = new Date(0);

const CONTACT_PROJECTION = {
  __v: 0,
};

const PRODUCT_PROJECTION = {
  __v: 0,
  movementLog: 0,
};

function parseDate(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date;
}

function parseLimit(value) {
  if (value === undefined) {
    return DEFAULT_PAGE;
  }

  if (!/^\d+$/.test(String(value))) {
    return null;
  }

  const limit = Number(value);

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE) {
    return null;
  }

  return limit;
}

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(token) {
  if (typeof token !== "string" || token.length > 2048) {
    throw new Error("Invalid cursor");
  }

  let payload;

  try {
    payload = JSON.parse(
      Buffer.from(token, "base64url").toString("utf8")
    );
  } catch {
    throw new Error("Invalid cursor");
  }

  const since = parseDate(payload.since);
  const upperBound = parseDate(payload.upperBound);
  const lastUpdatedAt = parseDate(payload.lastUpdatedAt);

  if (
    !since ||
    !upperBound ||
    !lastUpdatedAt ||
    !mongoose.isValidObjectId(payload.lastId) ||
    since > upperBound ||
    lastUpdatedAt < since ||
    lastUpdatedAt > upperBound
  ) {
    throw new Error("Invalid cursor");
  }

  return {
    since,
    upperBound,
    lastUpdatedAt,
    lastId: new mongoose.Types.ObjectId(payload.lastId),
  };
}

function createBadRequest(res, message) {
  return res.status(400).json({
    success: false,
    message,
  });
}

async function deltaFeed(Model, projection, req, res) {
  const limit = parseLimit(req.query.limit);

  if (limit === null) {
    return createBadRequest(
      res,
      `limit must be an integer between 1 and ${MAX_PAGE}`
    );
  }

  let since;
  let upperBound;
  let lastUpdatedAt = null;
  let lastId = null;

  if (req.query.cursor !== undefined) {
    if (req.query.since !== undefined) {
      return createBadRequest(
        res,
        "Provide cursor or since, not both"
      );
    }

    let cursor;

    try {
      cursor = decodeCursor(req.query.cursor);
    } catch {
      return createBadRequest(res, "Invalid sync cursor");
    }

    ({ since, upperBound, lastUpdatedAt, lastId } = cursor);
  } else {
    since = req.query.since
      ? parseDate(req.query.since)
      : EPOCH;

    if (!since) {
      return createBadRequest(res, "Invalid since timestamp");
    }

    upperBound = new Date();

    if (since > upperBound) {
      return createBadRequest(
        res,
        "since cannot be in the future"
      );
    }
  }

  const filter = {
    updatedAt: {
      $gte: since,
      $lte: upperBound,
    },
  };

  if (lastUpdatedAt && lastId) {
    filter.$or = [
      { updatedAt: { $gt: lastUpdatedAt, $lte: upperBound } },
      {
        updatedAt: lastUpdatedAt,
        _id: { $gt: lastId },
      },
    ];
  }

  const docs = await Model.find(filter, projection)
    .sort({ updatedAt: 1, _id: 1 })
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
  const lastDoc = docs[docs.length - 1];

  const nextCursor =
    hasMore && lastDoc
      ? encodeCursor({
          since: since.toISOString(),
          upperBound: upperBound.toISOString(),
          lastUpdatedAt: lastDoc.updatedAt.toISOString(),
          lastId: String(lastDoc._id),
        })
      : null;

  return {
    serverTime: upperBound,
    checkpoint: hasMore
      ? null
      : upperBound.toISOString(),
    nextCursor,
    hasMore,
    records,
    tombstones,
  };
}

async function getContactsDelta(req, res, next) {
  try {
    const payload = await deltaFeed(
      Contact,
      CONTACT_PROJECTION,
      req,
      res
    );

    if (payload) {
      return res.json(payload);
    }
  } catch (error) {
    next(error);
  }
}

async function getProductsDelta(req, res, next) {
  try {
    const payload = await deltaFeed(
      ProductStock,
      PRODUCT_PROJECTION,
      req,
      res
    );

    if (payload) {
      return res.json(payload);
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getContactsDelta,
  getProductsDelta,
};
