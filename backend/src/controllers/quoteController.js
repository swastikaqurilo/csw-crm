const mongoose = require("mongoose");
const Quotation = require("../models/Quote");
const Enquiry = require("../models/Enquiry");
const { getNextSequence } = require("../models/Counter");

const GST_RATE = 0.09; 

const MAX_ITEMS = 50;
const MAX_QTY = 1_000_000;
const MAX_RATE = 10_000_000;

const isValidId = (v) => mongoose.isValidObjectId(v);

const safeString = (v, max = 500) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : "";
};

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

const isDate = (v) => {
  if (!v) return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
};

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitWords(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}
function threeDigitWords(n) {
  if (n < 100) return twoDigitWords(n);
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigitWords(n % 100) : "");
}
function numberToIndianWords(num) {
  if (num === 0) return "Zero";
  let n = Math.floor(num);
  let words = "";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;
  if (crore) words += threeDigitWords(crore) + " Crore ";
  if (lakh) words += threeDigitWords(lakh) + " Lakh ";
  if (thousand) words += threeDigitWords(thousand) + " Thousand ";
  if (hundred) words += threeDigitWords(hundred);
  return words.trim();
}
function amountInWords(value) {
  const rounded = Math.round(value || 0);
  if (rounded === 0) return "Zero Rupees Only";
  return `${numberToIndianWords(rounded)} Rupees Only`;
}
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sanitizeItems(rawItems) {
  if (!Array.isArray(rawItems)) return null;
  if (rawItems.length === 0 || rawItems.length > MAX_ITEMS) return null;

  const cleaned = [];
  for (const item of rawItems) {
    const qty = Number(item.qty);
    const rate = Number(item.rate);
    const discountPct = Math.min(Math.max(Number(item.discountPct) || 0, 0), 100);

    if (!isFiniteNumber(qty) || qty < 0 || qty > MAX_QTY) return null;
    if (!isFiniteNumber(rate) || rate < 0 || rate > MAX_RATE) return null;

    const description = safeString(item.description, 500);
    if (!description) return null;

    const unit = ["kg", "MT", "Bundle", "Coil", "Roll", "Nos"].includes(item.unit)
      ? item.unit
      : "kg";

    cleaned.push({
      description,
      gauge: safeString(item.gauge, 50) || "",
      qty,
      rate,
      discountPct,
      unit,
    });
  }
  return cleaned;
}

function computeTotals(rawItems) {
  const items = rawItems.map((item) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const discountPct = Math.min(Math.max(Number(item.discountPct) || 0, 0), 100);
    const lineBase = qty * rate;
    const lineDiscount = lineBase * (discountPct / 100);
    const lineTotal = round2(lineBase - lineDiscount);
    return {
      description: String(item.description || "").trim(),
      gauge: String(item.gauge || "").trim(),
      qty,
      unit: item.unit || "kg",
      rate,
      discountPct,
      lineTotal,
    };
  });

  const subtotal = round2(items.reduce((s, i) => s + i.qty * i.rate, 0));
  const discountTotal = round2(
    items.reduce((s, i) => s + i.qty * i.rate - i.lineTotal, 0)
  );
  const taxable = round2(subtotal - discountTotal);
  const cgst = round2(taxable * GST_RATE);
  const sgst = round2(taxable * GST_RATE);
  const rawTotal = taxable + cgst + sgst;
  const grandTotal = Math.round(rawTotal);
  const roundOff = round2(grandTotal - rawTotal);

  return { items, subtotal, discountTotal, taxable, cgst, sgst, roundOff, grandTotal };
}

function sanitizeTerms(terms) {
  if (!terms || typeof terms !== "object") return {};
  return {
    payment: safeString(terms.payment, 500) || "",
    delivery: safeString(terms.delivery, 500) || "",
    freight: safeString(terms.freight, 500) || "",
    validity: safeString(terms.validity, 500) || "",
    notes: safeString(terms.notes, 1000) || "",
  };
}

function addEnquiryTimelineEntry(enquiry, text) {
  enquiry.timeline = enquiry.timeline || [];
  enquiry.timeline.push({ text, createdBy: "System", date: new Date() });
}

exports.getQuotations = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    const filter = {};

    if (req.query.status) {
      const allowed = ["Draft", "Sent", "Accepted", "Rejected", "Expired"];
      if (!allowed.includes(req.query.status)) {
        return res.status(400).json({ success: false, message: "Invalid status filter." });
      }
      filter.status = req.query.status;
    }

    if (req.query.enquiryId) {
      if (!isValidId(req.query.enquiryId)) {
        return res.status(400).json({ success: false, message: "Invalid enquiryId." });
      }
      filter.enquiry = req.query.enquiryId;
    }

    const total = await Quotation.countDocuments(filter);

    const quotations = await Quotation.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      data: quotations,
      total,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    console.error("Get quotations error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch quotations." });
  }
};

exports.getQuotationsByEnquiry = async (req, res) => {
  try {
    if (!isValidId(req.params.enquiryId)) {
      return res.status(400).json({ success: false, message: "Invalid enquiry ID." });
    }

    const quotations = await Quotation.find({ enquiry: req.params.enquiryId }).sort({
      createdAt: -1,
    });

    res.json({ success: true, data: quotations });
  } catch (err) {
    console.error("Get quotations by enquiry error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch quotations." });
  }
};

exports.getQuotationById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid quotation ID." });
    }

    const quotation = await Quotation.findById(req.params.id).populate(
      "enquiry",
      "enquiryNumber customerName company status"
    );

    if (!quotation) {
      return res.status(404).json({ success: false, message: "Quotation not found." });
    }

    res.json({ success: true, data: quotation });
  } catch (err) {
    console.error("Get quotation error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch quotation." });
  }
};

exports.createQuotation = async (req, res) => {
  try {
    const {
      enquiryId,
      customerName,
      company,
      gstin,
      billingAddress,
      quoteDate,
      validTill,
      items,
      terms,
    } = req.body;

    if (!enquiryId || !isValidId(enquiryId)) {
      return res.status(400).json({ success: false, message: "Invalid enquiryId." });
    }

    const cleanItems = sanitizeItems(items);
    if (!cleanItems) {
      return res.status(400).json({
        success: false,
        message: `Items must be 1-${MAX_ITEMS} valid entries.`,
      });
    }

    if (!validTill || !isDate(validTill)) {
      return res.status(400).json({ success: false, message: "Valid validTill date is required." });
    }

    const cleanCustomer = safeString(customerName, 200);

    const cleanQuoteDate = quoteDate && isDate(quoteDate) ? new Date(quoteDate) : new Date();

    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Linked enquiry not found." });
    }

    const totals = computeTotals(cleanItems);

    // Atomic sequence per enquiry — safe under concurrent creates
    const seq = await getNextSequence(`quote-${enquiry._id}`);
    const quotationNumber = `QT-${enquiry.enquiryNumber}-${String(seq).padStart(2, "0")}`;

    const quotation = await Quotation.create({
      quotationNumber,
      enquiry: enquiry._id,
      enquiryNumber: enquiry.enquiryNumber,
      customerName: cleanCustomer || safeString(enquiry.customerName, 200),
      company: safeString(company, 200) || safeString(enquiry.company, 200) || "",
      gstin: safeString(gstin, 15) || "",
      billingAddress:
        safeString(billingAddress, 500) || safeString(enquiry.location, 500) || "",
      quoteDate: cleanQuoteDate,
      validTill: new Date(validTill),
      items: totals.items,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxableAmount: totals.taxable,
      cgst: totals.cgst,
      sgst: totals.sgst,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      amountInWords: amountInWords(totals.grandTotal),
      terms: sanitizeTerms(terms),
      status: "Draft",
      createdBy: req.user?._id || null,
    });

    addEnquiryTimelineEntry(
      enquiry,
      `Quotation ${quotationNumber} created as draft — grand total ₹${totals.grandTotal.toLocaleString(
        "en-IN"
      )}.`
    );
    await enquiry.save();

    res.status(201).json({ success: true, data: quotation });
  } catch (err) {
    console.error("Create quotation error:", err);

    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.values(err.errors).map((e) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Quotation number conflict. Please retry.",
      });
    }
    res.status(500).json({ success: false, message: "Failed to create quotation." });
  }
};

exports.updateQuotation = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid quotation ID." });
    }

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: "Quotation not found." });
    }
    if (quotation.status !== "Draft") {
      return res
        .status(400)
        .json({ success: false, message: "Only draft quotations can be edited." });
    }

    const { customerName, company, gstin, billingAddress, quoteDate, validTill, items, terms } =
      req.body;

    if (items !== undefined) {
      const cleanItems = sanitizeItems(items);
      if (!cleanItems) {
        return res.status(400).json({
          success: false,
          message: `Items must be 1-${MAX_ITEMS} valid entries.`,
        });
      }
      const totals = computeTotals(cleanItems);
      quotation.items = totals.items;
      quotation.subtotal = totals.subtotal;
      quotation.discountTotal = totals.discountTotal;
      quotation.taxableAmount = totals.taxable;
      quotation.cgst = totals.cgst;
      quotation.sgst = totals.sgst;
      quotation.roundOff = totals.roundOff;
      quotation.grandTotal = totals.grandTotal;
      quotation.amountInWords = amountInWords(totals.grandTotal);
    }

    if (customerName !== undefined) {
      const v = safeString(customerName, 200);
      if (!v) return res.status(400).json({ success: false, message: "Invalid customerName." });
      quotation.customerName = v;
    }
    if (company !== undefined) quotation.company = safeString(company, 200) || "";
    if (gstin !== undefined) quotation.gstin = safeString(gstin, 15) || "";
    if (billingAddress !== undefined) {
      quotation.billingAddress = safeString(billingAddress, 500) || "";
    }

    if (quoteDate !== undefined) {
      if (!isDate(quoteDate)) {
        return res.status(400).json({ success: false, message: "Invalid quoteDate." });
      }
      quotation.quoteDate = new Date(quoteDate);
    }
    if (validTill !== undefined) {
      if (!isDate(validTill)) {
        return res.status(400).json({ success: false, message: "Invalid validTill." });
      }
      quotation.validTill = new Date(validTill);
    }

    if (terms !== undefined) {
      quotation.terms = {
        ...(quotation.terms ? quotation.terms.toObject() : {}),
        ...sanitizeTerms(terms),
      };
    }

    await quotation.save();

    res.json({ success: true, data: quotation });
  } catch (err) {
    console.error("Update quotation error:", err);

    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.values(err.errors).map((e) => ({
          field: e.path,
          message: e.message,
        })),
      });
    }
    res.status(500).json({ success: false, message: "Failed to update quotation." });
  }
};

exports.sendQuotation = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid quotation ID." });
    }

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: "Quotation not found." });
    }
    if (quotation.status === "Sent" || quotation.status === "Accepted") {
      return res
        .status(400)
        .json({ success: false, message: `Quotation is already ${quotation.status}.` });
    }

    quotation.status = "Sent";
    quotation.sentAt = new Date();
    await quotation.save();

    const enquiry = await Enquiry.findById(quotation.enquiry);
    if (enquiry) {
      enquiry.status = "Quoted";
      addEnquiryTimelineEntry(
        enquiry,
        `Quotation ${quotation.quotationNumber} sent — grand total ₹${quotation.grandTotal.toLocaleString(
          "en-IN"
        )}.`
      );
      await enquiry.save();
    }

    res.json({ success: true, data: quotation });
  } catch (err) {
    console.error("Send quotation error:", err);
    res.status(500).json({ success: false, message: "Failed to send quotation." });
  }
};

exports.updateQuotationStatus = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid quotation ID." });
    }

    const { status } = req.body;
    const allowed = ["Accepted", "Rejected", "Expired"];

    if (!allowed.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: `Status must be one of ${allowed.join(", ")}.` });
    }

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: "Quotation not found." });
    }

    quotation.status = status;
    await quotation.save();

    if (status === "Accepted") {
      const enquiry = await Enquiry.findById(quotation.enquiry);
      if (enquiry) {
        enquiry.status = "Converted";
        addEnquiryTimelineEntry(
          enquiry,
          `Quotation ${quotation.quotationNumber} accepted by the customer.`
        );
        await enquiry.save();
      }
    }

    res.json({ success: true, data: quotation });
  } catch (err) {
    console.error("Update quotation status error:", err);
    res.status(500).json({ success: false, message: "Failed to update status." });
  }
};

exports.deleteQuotation = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid quotation ID." });
    }

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: "Quotation not found." });
    }
    if (quotation.status !== "Draft") {
      return res
        .status(400)
        .json({ success: false, message: "Only draft quotations can be deleted." });
    }

    await quotation.deleteOne();

    res.json({ success: true, message: "Quotation deleted." });
  } catch (err) {
    console.error("Delete quotation error:", err);
    res.status(500).json({ success: false, message: "Failed to delete quotation." });
  }
};