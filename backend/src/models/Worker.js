const mongoose = require("mongoose");

const workerSchema = new mongoose.Schema(
  {
    
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [150, "Name too long"],
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone too long"],
      match: [
        /^[0-9+\-\s()]*$/,
        "Phone contains invalid characters",
      ],
      default: "",
    },

    role: {
      type: String,
      trim: true,
      maxlength: [100, "Role too long"],
      default: "",
    },

    department:{
      type: String,
      trim: true,
      maxlength: [100,"too long department"],
      default: "",
    },

    joiningDate: {
      type: Date,
      required: [true, "Joining date is required"],
    },

    status: {
      type: String,
      enum: {
        values: ["Active", "Inactive"],
        message: "{VALUE} is not a valid status",
      },
      default: "Active",
    },

    payType: {
      type: String,
      enum: {
        values: ["Fixed", "Variable"],
        message: "{VALUE} is not a valid pay type",
      },
      required: [true, "Pay type is required"],
      default: "Fixed",
    },

    fixedPay: {
      amount: {
        type: Number,
        min: [0, "Fixed pay cannot be negative"],
        max: [1000000000, "Fixed pay too large"],
        default: null,
      },

      cycle: {
        type: String,
        enum: {
          values: ["Daily", "Weekly", "Monthly"],
          message: "{VALUE} is not a valid payment cycle",
        },
        default: "Monthly",
      },
    },
    
    variablePay: {
      ratePerKg: {
        type: Number,
        min: [0, "Rate cannot be negative"],
        default: null,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;
        delete ret.isDeleted;
        delete ret.notes;
        return ret;
      },
    },  
  }
);


const attendanceSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: [true, "Date is required"],
      unique: true,
      index: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"],
    },

    allPresent: {
      type: Boolean,
      default: true,
    },

    // Kept for backward compatibility — derived from records on save.
    absentWorkers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Worker",
      },
    ],

    // Per-worker detail: status + login/logout times.
    records: [
      {
        worker: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Worker",
          required: true,
        },
        status: {
          type: String,
          enum: ["Present", "Absent"],
          default: "Present",
        },
        loginTime: {
          type: String,
          default: null,
          match: [/^\d{2}:\d{2}$/, "loginTime must be HH:mm"],
        },
        logoutTime: {
          type: String,
          default: null,
          match: [/^\d{2}:\d{2}$/, "logoutTime must be HH:mm"],
        },
      },
    ],

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
     timestamps: true ,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;
        return ret;
      },
    },
  }
);

const Worker = mongoose.model("Worker", workerSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = { Worker, Attendance };