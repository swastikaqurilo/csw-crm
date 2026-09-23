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

export const getProducts = (params) => api.get('/products', { params });
export const getProductById = (id) => api.get(`/products/${id}`);
export const createProduct = (data) => api.post('/products', data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data);
export const deleteProduct = (id) => api.delete(`/products/${id}`);

export const getInventory = (params) => api.get('/inventory', { params });
export const getInventoryById = (id) => api.get(`/inventory/${id}`);
export const createInventory = (data) => api.post('/inventory', data);
export const updateInventory = (id, data) => api.put(`/inventory/${id}`, data);
export const adjustStock = (id, data) => api.post(`/inventory/${id}/adjust`, data);
export const deleteInventory = (id) => api.delete(`/inventory/${id}`);
export const getLowStock = () => api.get('/inventory/low-stock');

export const getOrders = (params) => api.get('/order', { params });
export const getOrderById = (id) => api.get(`/order/${id}`);
export const createOrder = (data) => api.post('/order', data);
export const updateOrder = (id, data) => api.put(`/order/${id}`, data);
export const updateOrderStatus = (id, status) =>
  api.patch(`/order/${id}/status`, { status });
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