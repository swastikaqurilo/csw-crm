import {
  nowIso,
  getCachedByModuleAndId,
  upsertDedicatedRecord,
  removeDedicatedRecord,
  httpRowsForBasePath,
  listKeyOf,
} from "./cache.js";
import {
  getWorkersFromCache,
  getProductionsFromCache,
  getSalariesFromCache,
} from "./reads.js";

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
  const raw = String(value ?? "");

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00.000Z`);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== raw
    ) {
      throw new Error("Invalid salary period date.");
    }

    return raw;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid salary period date.");
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
    lastPaymentDate: payment.paymentDate,
    __pending: true,
    __opId: operationId,
    updatedAt: nowIso(),
  });

  await upsertDedicatedRecord("salaries", updated);
  await patchSalaryCaches(id, () => updated);

  return updated;
}

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


export async function applyGenerate({ data, operationId }) {
  const start = getDateOnly(data?.periodStart);
  const end = getDateOnly(data?.periodEnd);

  if (start > end) {
    throw new Error("Period start date cannot be after its end date.");
  }

  const workersResult = await getWorkersFromCache({ limit: 1000 });
  const workers = workersResult?.data || [];

  const productions = await getProductionsFromCache();

  const salariesResult = await getSalariesFromCache({
    page: 1,
    limit: 10000,
  });

  const existingSalaries = salariesResult?.salaries || [];

  if (!workers.length) {
    throw new Error(
      "Workers are not available in the local cache. Open Workers while online first."
    );
  }

  const activeWorkers = workers.filter((worker) => {
    if (worker.status !== "Active") return false;

    const joiningDate = String(worker.joiningDate || "").slice(0, 10);

    return !joiningDate || joiningDate <= end;
  });

  const results = [];

  for (const worker of activeWorkers) {
    if (worker.payType !== "Variable") {
      results.push({
        worker: worker._id,
        name: worker.name,
        status: "skipped",
        reason: "Fixed salary calculation is not yet supported by this offline generation handler.",
      });
      continue;
    }

    const workerId = String(worker._id);
    const workerPhone = String(worker.phone || "").replace(/\D/g, "");

    const workerProductions = productions.filter((production) => {
      const date = String(production.date || "").slice(0, 10);

      return (
        production.isActive !== false &&
        date >= start &&
        date <= end &&
        Array.isArray(production.workers) &&
        production.workers.some(
          (entry) => String(entry.worker?._id || entry.worker) === workerId
        )
      );
    });

    let totalKg = 0;

    for (const production of workerProductions) {
      const entry = production.workers.find(
        (item) => String(item.worker?._id || item.worker) === workerId
      );

      totalKg += Number(entry?.kg || 0);
    }

    totalKg = Math.round(totalKg * 1000) / 1000;

    const ratePerKg = money(worker.variablePay?.ratePerKg);
    const basicSalary = money(totalKg * ratePerKg);

    // Find every existing salary for this worker and period.
    const existingMatches = existingSalaries.filter((salary) => {
      const salaryWorkerId = getId(salary.worker);

      const referencedWorker =
        typeof salary.worker === "object"
          ? salary.worker
          : workers.find(
              (item) => String(item._id) === salaryWorkerId
            );

      const salaryPhone = String(
        referencedWorker?.phone || salary.workerPhone || ""
      ).replace(/\D/g, "");

      const sameWorker =
        salaryWorkerId === workerId ||
        (
          salaryPhone &&
          workerPhone &&
          salaryPhone === workerPhone
        );

      let salaryStart;
      let salaryEnd;

      try {
        salaryStart = getDateOnly(salary.periodStart);
        salaryEnd = getDateOnly(salary.periodEnd);
      } catch {
        return false;
      }

      return (
        sameWorker &&
        salaryStart === start &&
        salaryEnd === end &&
        salary.isDeleted !== true
      );
    });

    // Prefer records with payment history, then the record with
    // the highest existing salary amount.
    existingMatches.sort((a, b) => {
      const aCommitted =
        money(a.paidAmount) + money(a.advanceAmount);
      const bCommitted =
        money(b.paidAmount) + money(b.advanceAmount);

      if (aCommitted !== bCommitted) {
        return bCommitted - aCommitted;
      }

      return money(b.netSalary) - money(a.netSalary);
    });

    const existing = existingMatches[0] || null;

    // Remove duplicate records only when they have no financial history.
    const duplicates = existingMatches.slice(1);

    const protectedDuplicates = duplicates.filter((salary) => {
      return (
        money(salary.paidAmount) > 0 ||
        money(salary.advanceAmount) > 0 ||
        (Array.isArray(salary.payments) && salary.payments.length > 0) ||
        (Array.isArray(salary.advances) && salary.advances.length > 0)
      );
    });

    if (protectedDuplicates.length > 0) {
      results.push({
        worker: worker._id,
        name: worker.name,
        status: "skipped",
        reason:
          "Multiple salary records exist for this worker and period, and at least one has payment or advance history. Review the records before generating.",
        salary: existing,
      });
      continue;
    }

    for (const duplicate of duplicates) {
      await removeSalaryFromCaches(duplicate._id);
    }

    if (
      existing &&
      money(existing.paidAmount) > 0
    ) {
      results.push({
        worker: worker._id,
        name: worker.name,
        status: "skipped",
        reason: "Salary already has payments.",
        salary: existing,
      });
      continue;
    }

    const allowances = money(existing?.allowances);
    const deductions = money(existing?.deductions);
    const netSalary = money(basicSalary + allowances - deductions);

    const committed = money(
      money(existing?.paidAmount) + money(existing?.advanceAmount)
    );

    if (netSalary < committed) {
      results.push({
        worker: worker._id,
        name: worker.name,
        status: "skipped",
        reason:
          "Recalculated salary is below the amount already paid or advanced.",
        salary: existing,
      });
      continue;
    }

    const salary = normalizeSalary({
      ...(existing || {}),
      _id: existing?._id || `pending:${operationId}:${workerId}`,
      worker,
      payType: "Variable",
      periodStart: start,
      periodEnd: end,
      basicSalary,
      allowances,
      deductions,
      netSalary,
      paidAmount: money(existing?.paidAmount),
      advanceAmount: money(existing?.advanceAmount),
      payments: existing?.payments || [],
      advances: existing?.advances || [],
      production: {
        totalKg,
        ratePerKg,
        totalEarnings: basicSalary,
      },
      paymentStatus: calculateStatus({
        netSalary,
        paidAmount: existing?.paidAmount,
        advanceAmount: existing?.advanceAmount,
      }),
      isDeleted: false,
      __pending: true,
      __opId: operationId,
      updatedAt: nowIso(),
      createdAt: existing?.createdAt || nowIso(),
    });

    await upsertDedicatedRecord("salaries", salary);

    if (existing) {
      await patchSalaryCaches(salary._id, () => salary);
    } else {
      await addSalaryToCaches(salary);
    }

    results.push({
      worker: worker._id,
      name: worker.name,
      status: existing ? "updated" : "created",
      salary,
    });
  }

  return {
    success: true,
    message: "Offline salary generation completed.",
    salaries: results,
  };
}

export async function reconcileGenerate({ operationId, response }) {
  const results = response?.data?.salaries || [];

  const serverSalaries = results
    .map((item) => item?.salary)
    .filter((item) => item?._id);

  if (!serverSalaries.length) return null;

  const { db, openDb } = await import("../db/database.js");

  await openDb();

  const httpRows = await httpRowsForBasePath(BASE_PATH);

  const reconciledSalaries = serverSalaries.map((salary) => ({
    ...salary,
    __pending: false,
    __opId: undefined,
  }));

  await db.transaction("rw", db.cachedRecords, async () => {
    // Save each server salary and remove its temporary offline record.
    for (const salary of reconciledSalaries) {
      const workerId = String(
        salary.worker?._id || salary.worker || ""
      );

      const temporaryId = `pending:${operationId}:${workerId}`;

      const temporary = await db.cachedRecords
        .where("[module+recordId]")
        .equals(["salaries", temporaryId])
        .first();

      if (temporary) {
        await db.cachedRecords.delete(temporary.localId);
      }

      const existing = await db.cachedRecords
        .where("[module+recordId]")
        .equals(["salaries", String(salary._id)])
        .first();

      await db.cachedRecords.put({
        ...(existing || {}),
        module: "salaries",
        recordId: String(salary._id),
        data: salary,
        updatedAt: nowIso(),
      });
    }

    // Update each cached salary list only once.
    for (const row of httpRows) {
      const key = listKeyOf(row.data);

      if (!key || !Array.isArray(row.data[key])) continue;

      const temporaryIds = new Set(
        reconciledSalaries.map((salary) => {
          const workerId = String(
            salary.worker?._id || salary.worker || ""
          );

          return `pending:${operationId}:${workerId}`;
        })
      );

      const serverIds = new Set(
        reconciledSalaries.map((salary) => String(salary._id))
      );

      const remaining = row.data[key].filter((item) => {
        const id = String(item?._id || "");

        return !temporaryIds.has(id) && !serverIds.has(id);
      });

      const nextList = [
        ...reconciledSalaries,
        ...remaining,
      ];

      await db.cachedRecords.put({
        ...row,
        data: {
          ...row.data,
          [key]: nextList,
        },
        updatedAt: nowIso(),
      });
    }
  });

  return reconciledSalaries;
}
