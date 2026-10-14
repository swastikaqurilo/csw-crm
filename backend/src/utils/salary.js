const mongoose = require("mongoose");

const SALARY_DAY_DIVISOR = 30;

const SIZES = ["2kg", "5kg", "8kg", "10kg"];

const REEL_WEIGHTS = {
  "2kg": 2,
  "5kg": 5,
  "8kg": 8,
  "10kg": 10,
};

const isValidId = (value) => mongoose.isValidObjectId(value);

const safeString = (value, max = 1000) => {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, max);
};

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const calculateNetSalary = (basicSalary, allowances = 0, deductions = 0) => {
  const basic = Number(basicSalary) || 0;
  const allowance = Number(allowances) || 0;
  const deduction = Number(deductions) || 0;

  return Math.max(0, basic + allowance - deduction);
};

const calculatePaymentStatus = (netSalary, paidAmount, advanceAmount = 0) => {
  const totalPaid = Number(paidAmount || 0) + Number(advanceAmount || 0);

  if (totalPaid <= 0) return "Pending";
  if (totalPaid >= netSalary) return "Paid";
  return "Partial";
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getDateString = (date) => {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDaysBetween = (start, end) => {
  const days = [];

  const current = startOfDay(start);
  const last = startOfDay(end);

  while (current <= last) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
};

const isSunday = (d) => new Date(d).getDay() === 0;

const isWorkingDay = (d) => !isSunday(d);

const toMinutes = (value) => {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.getHours() * 60 + value.getMinutes();
  }

  const str = String(value).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
};

module.exports = {
  SALARY_DAY_DIVISOR,
  SIZES,
  REEL_WEIGHTS,

  isValidId,
  safeString,

  roundMoney,
  calculateNetSalary,
  calculatePaymentStatus,

  startOfDay,
  endOfDay,
  getDateString,
  getDaysBetween,
  isWorkingDay,

  toMinutes,
};