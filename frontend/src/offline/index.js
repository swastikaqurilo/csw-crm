// Public surface of the offline layer. Every other file in the app imports from here.

export {
  enqueue,
  flush,
  startOutbox,
  pendingOperations,
  outboxCounts,
  failedOperations,
  discard,
  applyOptimistic,
  reconcileOnlineWrite,
  OUTBOX_EVENT,
} from "./core.js";

export { newOperationId } from "./cache.js";

export {
  getOrdersFromCache,
  getOrderByIdFromCache,
  getPaymentsByOrderFromCache,
  getContactsFromCache,
  getContactByIdFromCache,
  getProductionsFromCache,
  getProductStockFromCache,
  getRawMaterialFromCache,
  getRawMaterialByIdFromCache,
  getPurchasesFromCache,
  getPurchaseByIdFromCache,
  getEnquiriesFromCache,
  getEnquiryByIdFromCache,
  getFollowUpsFromCache,
  getPaymentsFromCache,
  getExpensesFromCache,
  getExpenseByIdFromCache,
} from "./reads.js";