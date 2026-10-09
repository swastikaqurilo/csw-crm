import api from "./axios";

export const login = (data) => api.post("/auth/login", data);
export const register = (data) => api.post("/auth/register", data);
export const getMe = () => api.get("/auth/me");
export const logout = () => api.post("/auth/logout");

export const getEnquiries = (params) => api.get("/enquiries", { params });
export const getEnquiryById = (id) => api.get(`/enquiries/${id}`);
export const createEnquiry = (data) => api.post("/enquiries", data);
export const updateEnquiry = (id, data) => api.put(`/enquiries/${id}`, data);
 export const deleteEnquiry = (id) => api.delete(`/enquiries/${id}`);

export const getContacts = (params) => api.get("/contacts", { params });
export const getContactById = (id) => api.get(`/contacts/${id}`);
export const createContact = (data) => api.post("/contacts", data);
export const updateContact = (id, data) => api.put(`/contacts/${id}`, data);
export const deleteContact = (id) => api.delete(`/contacts/${id}`);

export const getFollowups = (params) => api.get("/follow-ups", { params });
export const getFollowupById = (id) => api.get(`/follow-ups/${id}`);
export const createFollowup = (data) => api.post("/follow-ups", data);
export const updateFollowup = (id, data) => api.put(`/follow-ups/${id}`, data);
export const deleteFollowup = (id) => api.delete(`/follow-ups/${id}`);

export const getProductProductions = (params) => api.get("/products", { params });
export const createProductProduction = (data) => api.post("/products", data);
export const updateProductProduction = (id, data) => api.patch(`/products/${id}`, data);
export const deleteProductProduction = (id) => api.delete(`/products/${id}`);
export const getRecentProductionRates = () => api.get("/products/recent-rates");

export const getProductStock = () => api.get("/products/stock");
export const updateProductStockReserved = (id, body) => api.patch(`/products/stock/${id}/reserved`, body);
export const adjustProductStock = (id, body) => api.patch(`/products/stock/${id}/adjust`, body);
export const recordProductScrap = (id, body) =>  api.patch(`/products/stock/${id}/scrap`, body);

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
export const recordRawPurchasePayment = (id, data) => api.post(`/raw-material/purchases/${id}/payments`, data);
export const deleteRawPurchasePayment = (id, paymentId) => api.delete( `/raw-material/purchases/${id}/payments/${paymentId}`);

export const getOrders = (params) => api.get("/order", { params });
export const getOrderById = (id) => api.get(`/order/${id}`);
export const createOrder = (data) => api.post("/order", data);
export const updateOrder = (id, data) => api.put(`/order/${id}`, data);
export const updateOrderStatus = (id, payload) => api.patch(`/order/${id}/status`,typeof payload === "string" ? { status: payload }: payload);
export const deleteOrder = (id) => api.delete(`/order/${id}`);

export const generateInvoice = (orderId) => api.post(`/order/${orderId}/invoice`);
export const getOrderInvoice = (orderId) => api.get(`/order/${orderId}/invoice`);

export const getPayments = (params) => api.get("/payment", { params });
export const getPaymentById = (id) => api.get(`/payment/${id}`);
export const createPayment = (data) => api.post("/payment", data);
export const updatePayment = (id, data) => api.patch(`/payment/${id}`, data);
export const deletePayment = (id) => api.delete(`/payment/${id}`);
export const getPaymentsByOrder = (orderId) => api.get(`/payment/order/${orderId}`);
export const getPaymentSummary = () => api.get("/payment/summary");

export const getRevenueByDate = (params) => api.get("/revenue/by-date", { params });
export const getRevenueDashboard = (params) => api.get("/revenue/dashboard", { params });
export const exportRevenueLedger = (params) => api.get("/revenue/ledger", { params,responseType: "blob",});

export const getExpenses = (params) => api.get("/expense", { params });
export const getExpenseById = (id) => api.get(`/expense/${id}`);
export const createExpense = (data) => api.post("/expense", data);
export const updateExpense = (id, data) => api.put(`/expense/${id}`, data);
export const markExpenseAsPaid = (id, data) => api.patch(`/expense/${id}/pay`, data);
export const deleteExpense = (id) => api.delete(`/expense/${id}`);

export const getPeople = (params) => api.get("/person", { params });
export const getPersonById = (id) => api.get(`/person/${id}`);
export const createPerson = (data) => api.post("/person", data);
export const updatePerson = (id, data) => api.put(`/person/${id}`, data);
export const deletePerson = (id) => api.delete(`/person/${id}`);

export const getAccountingDashboard = (params) => api.get("/accounting/dashboard", { params });

export const getQuotations = (params) => api.get("/quotations", { params });
export const getQuotationsByEnquiry = (enquiryId) => api.get(`/quotations/enquiry/${enquiryId}`);
export const getQuotationById = (id) => api.get(`/quotations/${id}`);
export const createQuotation = (payload) => api.post("/quotations", payload);
export const updateQuotation = (id, payload) => api.put(`/quotations/${id}`, payload);
export const sendQuotation = (id) => api.patch(`/quotations/${id}/send`);
export const updateQuotationStatus = (id, status) => api.patch(`/quotations/${id}/status`, { status });
export const deleteQuotation = (id) => api.delete(`/quotations/${id}`);

export const getSettings = () => api.get("/settings");
export const updateSettings = (payload) => api.put("/settings", payload);

export const getNotifications = () => api.get("/notifications");

export const getWorkers = (params) => api.get("/workers", { params });
export const createWorker = (data) => api.post("/workers", data);
export const updateWorker = (id, data) => api.put(`/workers/${id}`, data);
export const deleteWorker = (id) => api.delete(`/workers/${id}`);

export const getAttendance = (date) => api.get("/workers/attendance", { params: { date } });
export const saveAttendance = (data) => api.post("/workers/attendance", data);
export const getAttendanceHistory = ({ page = 1, limit = 8 } = {}) => api.get("/workers/attendance/history", { params: { page, limit } });

export const getSalaries = (params) => api.get("/salaries", { params });
export const getSalaryById = (id) => api.get(`/salaries/${id}`);
export const createSalary = (data) => api.post("/salaries", data);
export const generateSalaries = (data) => api.post("/salaries/generate", data);
export const updateSalary = (id, data) => api.put(`/salaries/${id}`, data);
export const recordSalaryPayment = (id, data) => api.post(`/salaries/${id}/payments`, data);
export const deleteSalary = (id) => api.delete(`/salaries/${id}`);

export const recordSalaryAdvance = (salaryId, payload) => api.post(`/salaries/${salaryId}/advance`, payload);
export const deleteSalaryAdvance = (salaryId, advanceId) => api.delete(`/salaries/${salaryId}/advance/${advanceId}`);