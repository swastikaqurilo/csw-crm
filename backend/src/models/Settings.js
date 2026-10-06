const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true, immutable: true },

    seller: {
      name:        { type: String, required: true, trim: true, maxlength: 150 },
      legalName:   { type: String, trim: true, maxlength: 150 },
      address:     { type: String, required: true, trim: true, maxlength: 300 },
      addressLine2:{ type: String, trim: true, maxlength: 300 },
      city:        { type: String, trim: true, maxlength: 100 },
      state:       { type: String, required: true, trim: true, maxlength: 100 },
      stateCode:   { type: String, required: true, trim: true, maxlength: 2 },
      pincode:     { type: String, trim: true, maxlength: 10 },
      country:     { type: String, default: 'India', trim: true },
      gstin:       { type: String, required: true, trim: true, uppercase: true, maxlength: 15 },
      pan:         { type: String, trim: true, uppercase: true, maxlength: 10 },
      cin:         { type: String, trim: true, uppercase: true, maxlength: 21 },
      msme:        { type: String, trim: true, maxlength: 30 },
      phone:       { type: String, trim: true, maxlength: 20 },
      email:       { type: String, trim: true, lowercase: true, maxlength: 150 },
      website:     { type: String, trim: true, maxlength: 200 },
      logoUrl:     { type: String, trim: true, maxlength: 500 },
      signatureUrl:{ type: String, trim: true, maxlength: 500 },
    },

    bank: {
      accountName:   { type: String, trim: true, maxlength: 150 },
      accountNumber: { type: String, trim: true, maxlength: 30 },
      bankName:      { type: String, trim: true, maxlength: 150 },
      ifsc:          { type: String, trim: true, uppercase: true, maxlength: 11 },
      branch:        { type: String, trim: true, maxlength: 150 },
      upiId:         { type: String, trim: true, maxlength: 100 },
    },

    invoice: {
      prefix:            { type: String, default: 'INV', trim: true, maxlength: 10 },
      defaultHsn:        { type: String, default: '7217', trim: true, maxlength: 20 },
      defaultGstRate:    { type: Number, default: 18, min: 0, max: 28 },
      taxMode:           { type: String, enum: ['IGST', 'CGST_SGST'], default: 'CGST_SGST' },
      defaultDueDays:    { type: Number, default: 30, min: 0, max: 365 },
      roundOffEnabled:   { type: Boolean, default: true },
      termsAndConditions:{ type: String, trim: true, maxlength: 3000 },
      declaration:       { type: String, trim: true, maxlength: 3000 },
      footerNote:        { type: String, trim: true, maxlength: 500 },
    },

    numbering: {
      orderPrefix:   { type: String, default: 'ORD', trim: true, maxlength: 10 },
      paymentPrefix: { type: String, default: 'PAY', trim: true, maxlength: 10 },
    },

    preferences: {
      currency:           { type: String, default: 'INR', uppercase: true, trim: true, maxlength: 3 },
      timezone:           { type: String, default: 'Asia/Kolkata', trim: true },
      dateFormat:         { type: String, default: 'DD MMM YYYY', trim: true },
      financialYearStart: { type: String, default: '04-01', trim: true, maxlength: 5 },
      lowStockThreshold:  { type: Number, default: 10, min: 0, max: 100000 },
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);