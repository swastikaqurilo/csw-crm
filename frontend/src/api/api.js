import api from './axios';

export const login = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);
export const getMe = () => api.get('/auth/me');
export const logout = () => api.post('/auth/logout');

export const getEnquiries = (params) => api.get('/enquiries', { params });
export const getEnquiryById = (id) => api.get(`/enquiries/${id}`);
export const createEnquiry = (data) => api.post('/enquiries', data);
export const updateEnquiry = (id, data) => api.put(`/enquiries/${id}`, data);
export const deleteEnquiry = (id) => api.delete(`/enquiries/${id}`);

export const getContacts = (params) => api.get('/contacts', { params });
export const getContactById = (id) => api.get(`/contacts/${id}`);
export const createContact = (data) => api.post('/contacts', data);
export const updateContact = (id, data) => api.put(`/contacts/${id}`, data);
export const deleteContact = (id) => api.delete(`/contacts/${id}`);

export const getFollowups = (params) => api.get('/follow-ups', { params });
export const getFollowupById = (id) => api.get(`/follow-ups/${id}`);
export const createFollowup = (data) => api.post('/follow-ups', data);
export const updateFollowup = (id, data) => api.put(`/follow-ups/${id}`, data);
export const deleteFollowup = (id) => api.delete(`/follow-ups/${id}`);


export const getProductStock = () => api.get("/products/stock");
export const updateProductStockReserved = (id, body) => api.patch(`/products/stock/${id}/reserved`, body);
export const adjustProductStock = (id, body) => api.patch(`/products/stock/${id}/adjust`, body);
export const recordProductScrap = (id, body) => api.patch(`/products/stock/${id}/scrap`, body);

export const getProductProductions = (params) => api.get("/products", { params });
export const createProductProduction = (data) => api.post("/products", data);
export const updateProductProduction = (id, data) => api.patch(`/products/${id}`, data);
export const deleteProductProduction = (id) => api.delete(`/products/${id}`);
export const getRecentProductionRates = () => api.get("/products/recent-rates");

export const getInventory = (params) => api.get('/inventory', { params });
export const getInventoryById = (id) => api.get(`/inventory/${id}`);
export const createInventory = (data) => api.post('/inventory', data);
export const updateInventory = (id, data) => api.put(`/inventory/${id}`, data);
export const adjustStock = (id, data) => api.post(`/inventory/${id}/adjust`, data);
export const deleteInventory = (id) => api.delete(`/inventory/${id}`);
export const getInventoryFamilies = (params) =>
  api.get('/inventory/families', { params });

/* ---------- RAW MATERIAL MODULE ---------- */

export const getRawStock = (params) => api.get("/raw-material/stock", { params });
export const getRawStockById = (id) => api.get(`/raw-material/stock/${id}`);
export const createRawStock = (data) => api.post("/raw-material/stock", data);
export const updateRawStock = (id, data) => api.patch(`/raw-material/stock/${id}`, data);
export const adjustRawStock = (id, data) => api.post(`/raw-material/stock/${id}/adjust`, data);
export const getRawStockMovements = (id) => api.get(`/raw-material/stock/${id}/movements`);
export const seedDefaultRawStock = () => api.get("/raw-material/stock/seed-defaults");

export const getRawPurchases = (params) => api.get("/raw-material/purchases", { params });
export const getRawPurchaseById = (id) => api.get(`/raw-material/purchases/${id}`);
export const createRawPurchase = (data) => api.post("/raw-material/purchases", data);
export const updateRawPurchase = (id, data) => api.patch(`/raw-material/purchases/${id}`, data);
export const receiveRawPurchase = (id) => api.post(`/raw-material/purchases/${id}/receive`);
export const cancelRawPurchase = (id) => api.post(`/raw-material/purchases/${id}/cancel`);
export const deleteRawPurchase = (id) => api.delete(`/raw-material/purchases/${id}`);

export const getLowStock = (params) => api.get('/inventory/low-stock', { params });
export const getCriticalStock = (params) => api.get('/inventory/critical-stock', { params });
export const getDeadStock = (params) => api.get('/inventory/dead-stock', { params });
export const getInventorySummary = () => api.get('/inventory/summary');

export const getOrders = (params) => api.get('/order', { params });
export const getOrderById = (id) => api.get(`/order/${id}`);
export const createOrder = (data) => api.post('/order', data);
export const updateOrder = (id, data) => api.put(`/order/${id}`, data);
export const updateOrderStatus = (id, payload) =>
  api.patch(
    `/order/${id}/status`,
    typeof payload === "string" ? { status: payload } : payload
  );
export const deleteOrder = (id) => api.delete(`/order/${id}`);

export const getPayments = (params) => api.get('/payment', { params });
export const getPaymentById = (id) => api.get(`/payment/${id}`);
export const createPayment = (data) => api.post('/payment', data);
export const updatePayment = (id, data) => api.patch(`/payment/${id}`, data);
export const deletePayment = (id) => api.delete(`/payment/${id}`);

export const getPaymentsByOrder = (orderId) =>
  api.get(`/payment/order/${orderId}`);

export const getPaymentSummary = () =>
  api.get('/payment/summary');

export const getRevenueByDate = (params) =>
  api.get('/revenue/by-date', { params });

export const getRevenueDashboard = (params) =>
  api.get('/revenue/dashboard', { params });

export const exportRevenueLedger = (params) =>
  api.get('/revenue/ledger', {
    params,
    responseType: 'blob',
  });

  // People
export const getPeople = (params) =>
  api.get('/people', { params });

export const getPersonById = (id) =>
  api.get(`/people/${id}`);

export const createPerson = (data) =>
  api.post('/people', data);

export const updatePerson = (id, data) =>
  api.put(`/people/${id}`, data);

export const deletePerson = (id) =>
  api.delete(`/people/${id}`);

// Expenses
export const getExpenses = (params) =>
  api.get('/expense', { params });

export const getExpenseById = (id) =>
  api.get(`/expense/${id}`);

export const createExpense = (data) =>
  api.post('/expense', data);

export const updateExpense = (id, data) =>
  api.put(`/expense/${id}`, data);

export const markExpenseAsPaid = (id, data) =>
  api.patch(`/expense/${id}/pay`, data);

export const deleteExpense = (id) =>
  api.delete(`/expense/${id}`);

// Accounting (derived from Payments + Expenses + Orders)
export const getAccountingDashboard = (params) =>
  api.get('/accounting/dashboard', { params });

// Quotations
export const getQuotations = (params) => api.get("/quotations", { params });
export const getQuotationsByEnquiry = (enquiryId) =>
  api.get(`/quotations/enquiry/${enquiryId}`);
export const getQuotationById = (id) => api.get(`/quotations/${id}`);

export const createQuotation = (payload) => api.post("/quotations", payload);
export const updateQuotation = (id, payload) => api.put(`/quotations/${id}`, payload);

export const sendQuotation = (id) => api.patch(`/quotations/${id}/send`);
export const updateQuotationStatus = (id, status) =>
  api.patch(`/quotations/${id}/status`, { status });

export const deleteQuotation = (id) => api.delete(`/quotations/${id}`);

export const generateInvoice = (orderId) =>
  api.post(`/order/${orderId}/invoice`);

export const getOrderInvoice = (orderId) =>
  api.get(`/order/${orderId}/invoice`);