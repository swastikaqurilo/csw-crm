import {
  nowIso,
  getCachedByModuleAndId,
  upsertDedicatedRecord,
  removeDedicatedRecord,
  httpRowsForBasePath,
  listKeyOf,
} from "./cache.js";

import { getCachedWorker } from "./workers.js";

const BASE_PATH = "/salaries";

const money = (value) =>
  Math.round((Number(value) || 0) * 100) / 100;

const getId = (value) =>
  String(value?._id ?? value ?? "");

const getSalaryFromResponse = (response) => {
  const body = response?.data;

  return (
    body?.data?.salary ||
    body?.salary ||
    body?.data ||
    null
  );
};

function calculateStatus(salary) {
  const net = money(salary.netSalary);
  const paid = money(salary.paidAmount);
  const advance = money(salary.advanceAmount);

  if (net <= 0) return "Pending";
  if (paid + advance >= net) return "Paid";
  if (paid + advance > 0) return "Partial";

  return "Pending";
}

function normalizeSalary(salary) {
  if (!salary) return salary;

  const next = { ...salary };

  next.basicSalary = money(next.basicSalary);
  next.allowances = money(next.allowances);
  next.deductions = money(next.deductions);

  next.netSalary = money(
    next.basicSalary + next.allowances - next.deductions
  );

  next.paidAmount = money(next.paidAmount);
  next.advanceAmount = money(next.advanceAmount);

  next.payments = Array.isArray(next.payments)
    ? next.payments
    : [];

  next.advances = Array.isArray(next.advances)
    ? next.advances
    : [];

  next.paymentStatus = calculateStatus(next);

  return next;
}

async function getSalary(id) {
  return getCachedByModuleAndId(
    "salaries",
    BASE_PATH,
    id
  );
}

function getDateOnly(value) {
  const date = String(value ?? "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid salary period date.");
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Invalid salary period date.");
  }

  return date;
}

export async function getMissingAttendanceDates(
  periodStart,
  periodEnd
) {
  const start = getDateOnly(periodStart);
  const end = getDateOnly(periodEnd);

  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);

  if (startDate > endDate) {
    throw new Error("Salary period start cannot be after its end.");
  }

  // Backend salary calculations exclude Sundays.
  const requiredDates = [];

  for (
    const current = new Date(startDate);
    current <= endDate;
    current.setUTCDate(current.getUTCDate() + 1)
  ) {
    if (current.getUTCDay() === 0) continue;

    requiredDates.push(
      current.toISOString().slice(0, 10)
    );
  }

  const { db, openDb } = await import("../db/database.js");

  await openDb();

  const cacheKeys = requiredDates.map((date) => [
    "http",
    `/workers/attendance?${JSON.stringify({ date })}`,
  ]);

  if (!cacheKeys.length) return [];

  const cachedRows = await db.cachedRecords
    .where("[module+recordId]")
    .anyOf(cacheKeys)
    .toArray();

  const cachedDates = new Set(
    cachedRows.map((row) => {
      try {
        return JSON.parse(
          row.recordId.split("?").slice(1).join("?")
        ).date;
      } catch {
        return null;
      }
    })
  );

  return requiredDates.filter(
    (date) => !cachedDates.has(date)
  );
}


/* -------------------------------------------------------
   Cache updates
------------------------------------------------------- */

async function patchSalaryCaches(id, updater) {
  const { db, openDb } = await import("../db/database.js");

  await openDb();

  const strId = String(id);
  const httpRows = await httpRowsForBasePath(BASE_PATH);

  await db.transaction(
    "rw",
    db.cachedRecords,
    async () => {
      const dedicated = await db.cachedRecords
        .where("[module+recordId]")
        .equals(["salaries", strId])
        .first();

      if (dedicated?.data) {
        const updated = updater(dedicated.data);

        if (updated) {
          await db.cachedRecords.put({
            ...dedicated,
            data: updated,
            updatedAt: nowIso(),
          });
        } else {
          await db.cachedRecords.delete(dedicated.localId);
        }
      }

      const changedRows = [];

      for (const row of httpRows) {
        const key = listKeyOf(row.data);
        if (!key || !Array.isArray(row.data?.[key])) continue;

        const currentList = row.data[key];

        const nextList = currentList
          .map((item) => {
            if (String(item?._id) !== strId) return item;
            return updater(item);
          })
          .filter(Boolean);

        changedRows.push({
          ...row,
          data: {
            ...row.data,
            [key]: nextList,
          },
          updatedAt: nowIso(),
        });
      }

      if (changedRows.length) {
        await db.cachedRecords.bulkPut(changedRows);
      }
    }
  );
}

async function addSalaryToCaches(salary) {
  if (!salary?._id) return;

  const { db, openDb } = await import("../db/database.js");

  await openDb();

  const httpRows = await httpRowsForBasePath(BASE_PATH);

  await db.transaction(
    "rw",
    db.cachedRecords,
    async () => {
      for (const row of httpRows) {
        const key = listKeyOf(row.data);
        if (!key || !Array.isArray(row.data?.[key])) continue;

        const current = row.data[key];

        const exists = current.some(
          (item) => String(item?._id) === String(salary._id)
        );

        if (exists) continue;

        const page = Number(row.data?.pagination?.page || 1);

        const nextList = [...current];

        if (page === 1) {
          nextList.unshift(salary);

          nextList.sort(
            (a, b) =>
              String(b.periodStart || "").localeCompare(
                String(a.periodStart || "")
              )
          );
        }

        await db.cachedRecords.put({
          ...row,
          data: {
            ...row.data,
            [key]: nextList,
          },
          updatedAt: nowIso(),
        });
      }
    }
  );
}

async function removeSalaryFromCaches(id) {
  const { db, openDb } = await import("../db/database.js");

  await openDb();

  const httpRows = await httpRowsForBasePath(BASE_PATH);
  const strId = String(id);

  await db.transaction(
    "rw",
    db.cachedRecords,
    async () => {
      for (const row of httpRows) {
        const key = listKeyOf(row.data);
        if (!key || !Array.isArray(row.data?.[key])) continue;

        await db.cachedRecords.put({
          ...row,
          data: {
            ...row.data,
            [key]: row.data[key].filter(
              (item) => String(item?._id) !== strId
            ),
          },
          updatedAt: nowIso(),
        });
      }
    }
  );

  await removeDedicatedRecord("salaries", strId);
}

/* -------------------------------------------------------
   Create salary
------------------------------------------------------- */

export async function applyCreate({ data, operationId }) {
  const workerId = getId(data?.worker);
  const worker = await getCachedWorker(workerId);

  if (!worker) {
    throw new Error(
      "This worker is not available in the local cache. Load workers while online before creating a salary offline."
    );
  }

  const basicSalary = money(data.basicSalary);
  const allowances = money(data.allowances);
  const deductions = money(data.deductions);

  const salary = normalizeSalary({
    ...data,
    _id: `pending:${operationId}`,
    worker,
    payType: worker.payType || "Fixed",
    basicSalary,
    allowances,
    deductions,
    netSalary: basicSalary + allowances - deductions,
    paidAmount: 0,
    advanceAmount: 0,
    payments: [],
    advances: [],
    paymentStatus: "Pending",
    isDeleted: false,
    __pending: true,
    __opId: operationId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  await upsertDedicatedRecord("salaries", salary);
  await addSalaryToCaches(salary);

  return salary;
}

/* -------------------------------------------------------
   Update salary
------------------------------------------------------- */

export async function applyUpdate({ id, data, operationId }) {
  const current = await getSalary(id);

  if (!current) {
    throw new Error("Salary record is not available in the local cache.");
  }

  const updated = normalizeSalary({
    ...current,
    ...data,
    _id: current._id,
    __pending: true,
    __opId: operationId,
    updatedAt: nowIso(),
  });

  if (
    updated.netSalary <
    money(updated.paidAmount + updated.advanceAmount)
  ) {
    throw new Error(
      "Net salary cannot be less than the amount already paid and advanced."
    );
  }

  await upsertDedicatedRecord("salaries", updated);

  await patchSalaryCaches(id, () => updated);

  return updated;
}

/* -------------------------------------------------------
   Delete salary
------------------------------------------------------- */

export async function applyDelete({ id }) {
  const current = await getSalary(id);

  if (!current) {
    throw new Error("Salary record is not available in the local cache.");
  }

  if (
    money(current.paidAmount) > 0 ||
    money(current.advanceAmount) > 0
  ) {
    throw new Error(
      "A salary with payments or advances cannot be deleted."
    );
  }

  await removeSalaryFromCaches(id);

  return { _id: id, deleted: true };
}

/* -------------------------------------------------------
   Record payment
------------------------------------------------------- */

export async function applyPaymentCreate({
  id,
  data,
  operationId,
}) {
  const current = await getSalary(id);

  if (!current) {
    throw new Error("Salary record is not available in the local cache.");
  }

  const amount = money(data.amount);

  const remaining = money(
    current.netSalary -
    current.paidAmount -
    current.advanceAmount
  );

  if (amount <= 0 || amount > remaining) {
    throw new Error("Invalid payment amount.");
  }

  const payment = {
    ...data,
    _id: `pending:${operationId}`,
    amount,
    paymentDate: data.paymentDate || data.date || nowIso(),
    __pending: true,
    __opId: operationId,
  };

  const updated = normalizeSalary({
    ...current,
    payments: [...(current.payments || []), payment],
    paidAmount: money(current.paidAmount + amount),
    lastPaymentDate: payment.date,
    __pending: true,
    __opId: operationId,
    updatedAt: nowIso(),
  });

  await upsertDedicatedRecord("salaries", updated);
  await patchSalaryCaches(id, () => updated);

  return updated;
}

/* -------------------------------------------------------
   Record advance
------------------------------------------------------- */

export async function applyAdvanceCreate({
  id,
  data,
  operationId,
}) {
  const current = await getSalary(id);

  if (!current) {
    throw new Error("Salary record is not available in the local cache.");
  }

  const amount = money(data.amount);

  const remaining = money(
    current.netSalary -
    current.paidAmount -
    current.advanceAmount
  );

  if (amount <= 0 || amount > remaining) {
    throw new Error("Invalid advance amount.");
  }

  const advance = {
    ...data,
    _id: `pending:${operationId}`,
    amount,
    date: data.date || nowIso(),
    __pending: true,
    __opId: operationId,
  };

  const updated = normalizeSalary({
    ...current,
    advances: [...(current.advances || []), advance],
    advanceAmount: money(current.advanceAmount + amount),
    __pending: true,
    __opId: operationId,
    updatedAt: nowIso(),
  });

  await upsertDedicatedRecord("salaries", updated);
  await patchSalaryCaches(id, () => updated);

  return updated;
}

/* -------------------------------------------------------
   Delete advance
------------------------------------------------------- */

export async function applyAdvanceDelete({
  id,
  advanceId,
  operationId,
}) {
  const current = await getSalary(id);

  if (!current) {
    throw new Error("Salary record is not available in the local cache.");
  }

  if (money(current.paidAmount) > 0) {
    throw new Error(
      "An advance cannot be deleted after a salary payment has been recorded."
    );
  }

  const advance = (current.advances || []).find(
    (item) => String(item._id) === String(advanceId)
  );

  if (!advance) {
    throw new Error("Advance record not found.");
  }

  const updated = normalizeSalary({
    ...current,
    advances: current.advances.filter(
      (item) => String(item._id) !== String(advanceId)
    ),
    advanceAmount: money(
      current.advanceAmount - money(advance.amount)
    ),
    __pending: true,
    __opId: operationId,
    updatedAt: nowIso(),
  });

  await upsertDedicatedRecord("salaries", updated);
  await patchSalaryCaches(id, () => updated);

  return updated;
}

/* -------------------------------------------------------
   Reconciliation helpers
------------------------------------------------------- */

async function reconcileSalary({ id, response }) {
  const serverSalary = getSalaryFromResponse(response);

  if (!serverSalary?._id) {
    return null;
  }

  const reconciled = {
    ...serverSalary,
    __pending: false,
    __opId: undefined,
  };

  await upsertDedicatedRecord("salaries", reconciled);

  await patchSalaryCaches(
    id || serverSalary._id,
    () => reconciled
  );

  return reconciled;
}

export async function reconcileCreate({ operationId, response }) {
  const serverSalary = getSalaryFromResponse(response);

  if (!serverSalary?._id) return null;

  const temporaryId = `pending:${operationId}`;

  const reconciled = {
    ...serverSalary,
    __pending: false,
    __opId: undefined,
  };

  await removeDedicatedRecord("salaries", temporaryId);
  await upsertDedicatedRecord("salaries", reconciled);

  const { db, openDb } = await import("../db/database.js");

  await openDb();

  const httpRows = await httpRowsForBasePath(BASE_PATH);

  await db.transaction(
    "rw",
    db.cachedRecords,
    async () => {
      for (const row of httpRows) {
        const key = listKeyOf(row.data);
        if (!key || !Array.isArray(row.data?.[key])) continue;

        const nextList = row.data[key]
          .filter(
            (item) =>
              String(item?._id) !== temporaryId &&
              String(item?._id) !== String(reconciled._id)
          );

        nextList.unshift(reconciled);

        await db.cachedRecords.put({
          ...row,
          data: {
            ...row.data,
            [key]: nextList,
          },
          updatedAt: nowIso(),
        });
      }
    }
  );

  return reconciled;
}

export async function reconcileUpdate({ id, response }) {
  return reconcileSalary({ id, response });
}

export async function reconcilePaymentCreate({ id, response }) {
  return reconcileSalary({ id, response });
}

export async function reconcileAdvanceCreate({ id, response }) {
  return reconcileSalary({ id, response });
}

export async function reconcileAdvanceDelete({ id, response }) {
  return reconcileSalary({ id, response });
}

export async function reconcileDelete({ id }) {
  await removeSalaryFromCaches(id);
  return { _id: id, deleted: true };
}
