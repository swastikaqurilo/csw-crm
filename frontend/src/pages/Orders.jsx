// import { useEffect, useMemo, useState } from "react";
// import {
//   Plus, Search, X, Truck, MapPin, FileText, ReceiptText, RefreshCw, Package,
//   UserRound, CalendarDays, CreditCard, IndianRupee, Pencil, Trash2,
//   Wallet, Receipt, ChevronLeft, ChevronRight,
//   CheckCircle2, Clock3, Factory, AlertCircle, Layers,AlertTriangle,
// } from "lucide-react";
// import logo from "../assets/cswlogo.png";
// import { toast } from "react-toastify";

// import {
//   getOrders,
//   getOrderById,
//   createOrder,
//   updateOrder,
//   updateOrderStatus,
//   deleteOrder,
//   getContacts,
//   getProductStock,
//   generateInvoice,
//   getOrderInvoice,
//   getPaymentsByOrder,
//   createPayment,
// } from "../api/api";

// const ORDER_STATUSES = [
//   "Draft",
//   "Confirmed",
//   "In Production",
//   "Ready for Dispatch",
//   "Dispatched",
//   "Delivered",
//   "Cancelled",
// ];

// const PAYMENT_STATUSES = ["Pending", "Partial", "Paid", "Overdue"];

// const getReelSpecs = (sizeInput) => {
//   const kg = parseFloat(String(sizeInput ?? "").replace(/[^\d.]/g, ""));
//   if (!Number.isFinite(kg) || kg <= 0) {
//     return { kg: 0, spoolKg: 0, steelKg: 0 };
//   }

//   let spoolKg;
//   if (kg <= 2) spoolKg = 0.2;
//   else if (kg <= 5) spoolKg = 0.6;
//   else spoolKg = 0.7;

//   return {
//     kg,
//     spoolKg,
//     steelKg: Math.max(0, kg - spoolKg),
//   };
// };

// const sizeToNumberString = (sizeInput) => {
//   const kg = parseFloat(String(sizeInput ?? "").replace(/[^\d.]/g, ""));
//   return Number.isFinite(kg) && kg > 0 ? String(kg) : "";
// };

// const ORDERS_PER_PAGE = 8;

// const emptyItem = () => ({ size: "", quantity: "", rate: "", discount: "0" });

// const emptyForm = () => ({
//   contact: "",
//   enquiry: "",
//   items: [emptyItem()],
//   discount: "0",
//   taxPercent: "18",
//   expectedDeliveryDate: "",
//   shippingAddress: "",
//   billingAddress: "",
//   notes: "",
// });

// function formatCurrency(value) {
//   return `₹${Number(value || 0).toLocaleString("en-IN", {
//     maximumFractionDigits: 2,
//   })}`;
// }

// function formatDate(value) {
//   if (!value) return "—";
//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return "—";
//   return date.toLocaleDateString("en-IN", {
//     day: "2-digit",
//     month: "short",
//     year: "numeric",
//   });
// }

// function formatDateInput(value) {
//   if (!value) return "";
//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return "";
//   return date.toISOString().split("T")[0];
// }

// function getContactName(contact) {
//   if (!contact) return "Unknown Contact";
//   return contact.company || contact.name || contact.email || "Unknown Contact";
// }

// function getContactPerson(contact) {
//   if (!contact) return "—";
//   return contact.name || contact.email || "—";
// }

// function getItemName(item) {
//   if (!item) return "Unknown Item";
//   return item.productName || (item.size ? `Reel ${item.size}` : "Unknown Item");
// }

// function getItemsLabel(order) {
//   if (!order?.items?.length) return "—";
//   if (order.items.length === 1) return getItemName(order.items[0]);
//   return `${getItemName(order.items[0])} + ${order.items.length - 1} more`;
// }

// function getItemsQuantity(order) {
//   if (!order?.items?.length) return "—";
//   return order.items
//     .map(
//       (item) =>
//         `${Number(item.quantity || 0).toLocaleString("en-IN")} ${item.unit || "Reel"}`
//     )
//     .join(", ");
// }

// function getStatusStyles(status) {
//   switch (status) {
//     case "Delivered":
//       return { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 };
//     case "Dispatched":
//       return { badge: "border-sky-200 bg-sky-50 text-sky-700", icon: Truck };
//     case "Ready for Dispatch":
//       return { badge: "border-violet-200 bg-violet-50 text-violet-700", icon: Package };
//     case "In Production":
//       return { badge: "border-amber-200 bg-amber-50 text-amber-700", icon: Factory };
//     case "Confirmed":
//       return { badge: "border-blue-200 bg-blue-50 text-blue-700", icon: CheckCircle2 };
//     case "Cancelled":
//       return { badge: "border-rose-200 bg-rose-50 text-rose-700", icon: AlertCircle };
//     default:
//       return { badge: "border-slate-200 bg-slate-50 text-slate-600", icon: FileText };
//   }
// }

// function getPaymentStyles(payment) {
//   switch (payment) {
//     case "Paid": return "border-emerald-200 bg-emerald-50 text-emerald-700";
//     case "Partial": return "border-amber-200 bg-amber-50 text-amber-700";
//     case "Overdue": return "border-rose-200 bg-rose-50 text-rose-700";
//     default: return "border-slate-200 bg-slate-50 text-slate-600";
//   }
// }

// function StatusBadge({ status }) {
//   const styles = getStatusStyles(status);
//   const Icon = styles.icon;
//   return (
//     <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}>
//       <Icon size={12} />
//       {status || "Draft"}
//     </span>
//   );
// }

// function PaymentBadge({ status }) {
//   return (
//     <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPaymentStyles(status)}`}>
//       {status || "Pending"}
//     </span>
//   );
// }

// function Orders() {
//   const [orders, setOrders] = useState([]);
//   const [contacts, setContacts] = useState([]);
//   const [isReservedConfirmOpen, setIsReservedConfirmOpen] = useState(false);
//   const [confirmDialog, setConfirmDialog] = useState(null);

//   const [reservedConflict, setReservedConflict] = useState(null);
//   const [pendingOrder, setPendingOrder] = useState(null);

//   const [search, setSearch] = useState("");
//   const [statusFilter, setStatusFilter] = useState("All");
//   const [paymentFilter, setPaymentFilter] = useState("All");

//   const [viewOrder, setViewOrder] = useState(null);
//   const [detailLoading, setDetailLoading] = useState(false);

//   const [modalOpen, setModalOpen] = useState(false);
//   const [editingOrder, setEditingOrder] = useState(null);
//   const [form, setForm] = useState(emptyForm());

//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [deleting, setDeleting] = useState(false);
//   const [error, setError] = useState("");

//   const [page, setPage] = useState(1);
//   const [pages, setPages] = useState(1);
//   const [totalOrders, setTotalOrders] = useState(0);

//   const [invoiceLoading, setInvoiceLoading] = useState(false);
//   const [invoice, setInvoice] = useState(null);
//   const [invoiceOpen, setInvoiceOpen] = useState(false);

//   const [paymentModalOpen, setPaymentModalOpen] = useState(false);
//   const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
//   const [selectedPaymentOrder, setSelectedPaymentOrder] = useState(null);
//   const [orderPayments, setOrderPayments] = useState([]);
//   const [paymentLoading, setPaymentLoading] = useState(false);
//   const [paymentSubmitting, setPaymentSubmitting] = useState(false);

//   const [customerMode, setCustomerMode] = useState("existing"); 
//   const [newCustomerName, setNewCustomerName] = useState("");
//   const [newCustomerPhone, setNewCustomerPhone] = useState("");

//   const [paymentForm, setPaymentForm] = useState({
//     amount: "",
//     paymentMode: "UPI",
//     paymentDate: new Date().toISOString().split("T")[0],
//     paidFrom: "",
//     transactionId: "",
//     chequeNumber: "",
//     bankName: "",
//     notes: "",
//   });

//   /* ---------------- FETCH ---------------- */
//   const fetchOrders = async () => {
//     try {
//       setLoading(true);
//       setError("");
//       const params = { page, limit: ORDERS_PER_PAGE };
//       if (search.trim()) params.search = search.trim();
//       if (statusFilter !== "All") params.status = statusFilter;
//       if (paymentFilter !== "All") params.paymentStatus = paymentFilter;

//       const response = await getOrders(params);
//       const result = response?.data;
//       if (!result?.success) throw new Error(result?.message || "Failed to fetch orders");

//       setOrders(result.data || []);
//       setPages(Math.max(1, result.pages || 1));
//       setTotalOrders(result.total || 0);
//     } catch (err) {
//       console.error("Fetch orders error:", err);
//       setError(err?.response?.data?.message || err?.message || "Failed to load orders.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchFormData = async () => {
//     try {
//       const [contactsResponse, stockResponse] = await Promise.all([
//         getContacts({ limit: 100 }),
//       ]);

//       const contactsResult = contactsResponse?.data;

//       if (contactsResult?.success) setContacts(contactsResult.data || []);
//     } catch (err) {
//       console.error("Fetch order form data error:", err);
//     }
//   };

//   useEffect(() => {
//     fetchFormData();
//   }, []);

//   useEffect(() => {
//     const timer = setTimeout(() => fetchOrders(), 300);
//     return () => clearTimeout(timer);
//   }, [page, search, statusFilter, paymentFilter]);

//   /* ---------------- ORDER DETAILS ---------------- */
//   const openViewOrder = async (order) => {
//     if (!order?._id) return;
//     setViewOrder(order);
//     setDetailLoading(true);
//     setInvoice(null);
//     try {
//       const [orderResponse, invoiceResponse] = await Promise.all([
//         getOrderById(order._id),
//         getOrderInvoice(order._id),
//       ]);
//       if (orderResponse?.data?.success) setViewOrder(orderResponse.data.data);
//       if (invoiceResponse?.data?.success) setInvoice(invoiceResponse.data.data);
//       else setInvoice(null);
//     } catch (err) {
//       if (err?.response?.status !== 404) console.error("Fetch order/invoice details error:", err);
//       setInvoice(null);
//     } finally {
//       setDetailLoading(false);
//     }
//   };

//   const closeViewOrder = () => {
//     if (saving) return;
//     setViewOrder(null);
//   };

//   /* ---------------- KPI ---------------- */
//   const stats = useMemo(() => {
//     const inProcessStatuses = ["Confirmed", "In Production", "Ready for Dispatch"];
//     const inProcess = orders.filter((o) => inProcessStatuses.includes(o.status)).length;
//     const dispatched = orders.filter((o) => o.status === "Dispatched" || o.status === "Delivered").length;
//     const value = orders.reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
//     return { total: totalOrders, inProcess, dispatched, value };
//   }, [orders, totalOrders]);

//   /* ---------------- MODAL ---------------- */
//   const openAddModal = () => {
//     setEditingOrder(null);
//     setForm(emptyForm());
//     setCustomerMode("existing");
//     setNewCustomerName("");
//     setNewCustomerPhone("");
//     setModalOpen(true);
//   };

//  const openEditModal = (order) => {
//     if (!order) return;
//     setEditingOrder(order);
//     setCustomerMode("existing");
//     setNewCustomerName("");
//     setNewCustomerPhone("");
//     setForm({
//       contact: order.contact?._id || order.contact || "",
//       enquiry: order.enquiry?._id || order.enquiry || "",
//       items:
//         order.items?.length > 0
//           ? order.items.map((i) => ({
//               size: i.size || "",
//               quantity: i.quantity ?? "",
//               rate: i.rate ?? "",
//               discount: i.discount ?? "0",
//             }))
//           : [emptyItem()],
//       discount: order.discount ?? "0",
//       taxPercent: order.taxPercent ?? "18",
//       expectedDeliveryDate: formatDateInput(order.expectedDeliveryDate),
//       shippingAddress: order.shippingAddress || "",
//       billingAddress: order.billingAddress || "",
//       notes: order.notes || "",
//     });
//     setModalOpen(true);
//   };

//   const closeModal = () => {
//     if (saving) return;
//     setModalOpen(false);
//     setEditingOrder(null);
//     setForm(emptyForm());
//     setCustomerMode("existing");
//     setNewCustomerName("");
//     setNewCustomerPhone("");
//   };

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setForm((current) => ({ ...current, [name]: value }));
//   };

//   /* ---------------- ITEM ROW HANDLERS ---------------- */
//   const updateItem = (index, patch) => {
//     setForm((current) => ({
//       ...current,
//       items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
//     }));
//   };

//   const addItemRow = () => {
//     setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }));
//   };

//   const removeItemRow = (index) => {
//     setForm((current) => ({
//       ...current,
//       items: current.items.length > 1 ? current.items.filter((_, i) => i !== index) : current.items,
//     }));
//   };

//   /* ---------------- PREVIEW ---------------- */
//   const previewTotals = useMemo(() => {
//     let subTotal = 0;
//     for (const item of form.items) {
//       const q = Number(item.quantity) || 0;
//       const r = Number(item.rate) || 0;
//       const d = Number(item.discount) || 0;
//       subTotal += Math.max(0, q * r - d);
//     }
//     const orderDiscount = Number(form.discount) || 0;
//     const taxable = Math.max(0, subTotal - orderDiscount);
//     const tax = taxable * ((Number(form.taxPercent) || 0) / 100);
//     return { subTotal, tax, grandTotal: taxable + tax };
//   }, [form.items, form.discount, form.taxPercent]);

//   /* ---------------- CREATE / UPDATE ---------------- */
//   const validateForm = () => {
//   if (customerMode === "existing" && !form.contact) {
//     return "Please select a customer.";
//   }

//   if (customerMode === "new") {
//     const name = newCustomerName.trim();
//     const phone = newCustomerPhone.trim();

//     if (!name) return "Customer name is required.";
//     if (name.length < 2) return "Customer name must be at least 2 characters.";

//     if (!phone) return "Customer phone is required.";
//     if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, ""))) {
//       return "Enter a valid 10-digit Indian mobile number (starts with 6–9).";
//     }
//   }

//   const validItems = form.items.filter((it) => it.size);
//   if (validItems.length === 0) return "Add at least one item.";

//   for (let i = 0; i < form.items.length; i++) {
//     const item = form.items[i];
//     if (!item.size) continue;
//     if (!item.quantity || Number(item.quantity) <= 0) {
//       return `Row ${i + 1}: quantity must be > 0.`;
//     }
//     if (Number(item.rate || 0) < 0) {
//       return `Row ${i + 1}: rate cannot be negative.`;
//     }
//   }
//   return null;
// };

// const buildItemsPayload = () =>
//   form.items
//     .filter((it) => it.size && Number(it.quantity) > 0)
//     .map((it) => {
//       const specs = getReelSpecs(it.size);
//       return {
//         size: it.size,
//         quantity: Number(it.quantity),
//         rate: Number(it.rate || 0),
//         discount: Number(it.discount || 0),
//         spoolKg: specs.spoolKg,
//         steelKg: specs.steelKg,
//       };
//     });

//   const handleCreate = async () => {
//   const err = validateForm();
//   if (err) { toast.error(err); return; }

//   try {
//     setSaving(true);
//     const payload = {
//       items: buildItemsPayload(),
//       discount: Number(form.discount || 0),
//       taxPercent: Number(form.taxPercent || 18),
//       expectedDeliveryDate: form.expectedDeliveryDate || undefined,
//       shippingAddress: form.shippingAddress.trim(),
//       billingAddress: form.billingAddress.trim(),
//       notes: form.notes.trim(),
//     };
//     if (form.enquiry.trim()) payload.enquiry = form.enquiry.trim();

//     if (customerMode === "existing") {
//       payload.contact = form.contact;
//     } else {
//       payload.customerName = newCustomerName.trim();
//       payload.customerPhone = newCustomerPhone.trim();
//     }

//     const response = await createOrder(payload);
//     if (!response?.data?.success) throw new Error(response?.data?.message || "Failed to create order");

//     const createdOrder = response.data.data;
//     toast.success(`Order ${createdOrder.orderNumber} created`);
//     closeModal();
//     await fetchOrders();
//     if (createdOrder?._id) await openViewOrder(createdOrder);
//   } catch (err) {
//     console.error("Create order error:", err);
//     toast.error(err?.response?.data?.message || err?.message || "Failed to create order.");
//   } finally {
//     setSaving(false);
//   }
// };

//   const handleUpdate = async () => {
//     if (!editingOrder?._id) return;
//     try {
//       setSaving(true);

//       // Only Draft orders can send items
//       const isDraft = editingOrder.status === "Draft";
//       const payload = {
//         expectedDeliveryDate: form.expectedDeliveryDate || undefined,
//         shippingAddress: form.shippingAddress.trim(),
//         billingAddress: form.billingAddress.trim(),
//         notes: form.notes.trim(),
//         discount: Number(form.discount || 0),
//         taxPercent: Number(form.taxPercent || 18),
//       };

//       if (isDraft) {
//         const err = validateForm();
//         if (err) { alert(err); setSaving(false); return; }
//         payload.items = buildItemsPayload();
//       }

//           const response = await updateOrder(editingOrder._id, payload);
//       if (!response?.data?.success) throw new Error(response?.data?.message || "Failed to update order");

//       const updatedOrder = response.data.data;
//       toast.success(`Order ${updatedOrder.orderNumber} updated`);
//       closeModal();
//       await fetchOrders();
//       if (updatedOrder?._id) await openViewOrder(updatedOrder);
//     } catch (err) {
//       console.error("Update order error:", err);
//       toast.error(err?.response?.data?.message || err?.message || "Failed to update order.");
//     } finally {
//       setSaving(false);
//     }
//   };  

//   const openConfirm = ({ title, message, confirmLabel = "Confirm", confirmTone = "primary", onConfirm }) => {
//     setConfirmDialog({ title, message, confirmLabel, confirmTone, onConfirm });
//   };

//   const closeConfirm = () => setConfirmDialog(null);

//   const performStatusChange = async (order, newStatus, extra = {}) => {
//     try {
//       const response = await updateOrderStatus(order._id, {
//         status: newStatus,
//         ...extra,
//       });
//       if (!response?.data?.success) {
//         throw new Error(response?.data?.message || "Failed to update order status");
//       }
//       const updatedOrder = response.data.data;
//       setOrders((current) =>
//         current.map((item) =>
//           item._id === order._id ? { ...item, ...updatedOrder, status: newStatus } : item
//         )
//       );
//       setViewOrder((current) =>
//         current?._id === order._id ? { ...current, ...updatedOrder, status: newStatus } : current
//       );
//       toast.success(`Order ${order.orderNumber} marked as ${newStatus}`);
//     } catch (err) {
//       const body = err?.response?.data ?? err;

//       if (body?.code === "RESERVED_CONFLICT" && body?.data) {
//         setReservedConflict(body.data);
//         setPendingOrder({ order, newStatus });
//         setIsReservedConfirmOpen(true);
//         return;
//       }

//       console.error("Update status error:", err);
//       toast.error(body?.message || err?.message || "Failed to update order status.");
//     }
//   };

//   const handleStatusChange = (order, newStatus) => {
//     if (!order?._id || !newStatus || newStatus === order.status) return;

//     const meta = {
//       Confirmed: {
//         title: "Confirm this order?",
//         body:
//           "Confirming will deduct stock from inventory. If the deduction dips into reserved stock, you'll be prompted to approve that separately.",
//         confirmLabel: "Yes, Confirm Order",
//         confirmTone: "primary",
//       },
//       Dispatched: {
//         title: "Mark as dispatched?",
//         body: "This updates the order status to Dispatched. Stock was already deducted at confirmation.",
//         confirmLabel: "Yes, Mark Dispatched",
//         confirmTone: "sky",
//       },
//       Delivered: {
//         title: "Mark as delivered?",
//         body: "Confirm delivery to close this order out.",
//         confirmLabel: "Yes, Mark Delivered",
//         confirmTone: "emerald",
//       },
//       Cancelled: {
//         title: "Cancel this order?",
//         body: "Cancelling will restore any deducted stock back to inventory. This cannot be undone.",
//         confirmLabel: "Yes, Cancel Order",
//         confirmTone: "danger",
//       },
//     }[newStatus] || {
//       title: `Change status to "${newStatus}"?`,
//       body: "Are you sure you want to proceed?",
//       confirmLabel: "Confirm",
//       confirmTone: "primary",
//     };

//     openConfirm({
//       ...meta,
//       onConfirm: () => performStatusChange(order, newStatus),
//     });
//   };

//   const handleReservedConfirm = async () => {
//     if (!pendingOrder) return;
//     const { order, newStatus } = pendingOrder;

//     try {
//       setSaving(true);
//       await performStatusChange(order, newStatus, { allowReserved: true });
//       setIsReservedConfirmOpen(false);
//       setReservedConflict(null);
//       setPendingOrder(null);
//     } catch (err) {
//       // performStatusChange already toasts; just close here
//       setIsReservedConfirmOpen(false);
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleReservedCancel = () => {
//     setIsReservedConfirmOpen(false);
//     setReservedConflict(null);
//     setPendingOrder(null);
//   };

//   const handleDelete = (order) => {
//     if (!order?._id) return;
//     if (!["Draft", "Cancelled"].includes(order.status)) {
//       toast.warn("Only Draft or Cancelled orders can be deleted.");
//       return;
//     }
//     openConfirm({
//       title: `Delete ${order.orderNumber}?`,
//       message: "This action cannot be undone.",
//       confirmLabel: "Yes, Delete",
//       confirmTone: "danger",
//       onConfirm: async () => {
//         try {
//           setDeleting(true);
//           const response = await deleteOrder(order._id);
//           if (!response?.data?.success) {
//             throw new Error(response?.data?.message || "Failed to delete order");
//           }
//           toast.success(`Order ${order.orderNumber} deleted`);
//           setViewOrder(null);
//           await fetchOrders();
//         } catch (err) {
//           toast.error(err?.response?.data?.message || "Failed to delete order");
//         } finally {
//           setDeleting(false);
//         }
//       },
//     });
//   };

//   const handleRefresh = () => fetchOrders();

//   const handleGenerateInvoice = async (order) => {
//     if (!order?._id) return;
//     try {
//       setInvoiceLoading(true);
//       setError("");
//       const response = await generateInvoice(order._id);
//       if (!response?.data?.success) throw new Error(response?.data?.message || "Failed to generate invoice");
//       setInvoice(response.data.data);
//       setInvoiceOpen(true);
//     } catch (err) {
//       console.error("Generate invoice error:", err);
//       setError(err?.response?.data?.message || err?.message || "Failed to generate invoice.");
//     } finally {
//       setInvoiceLoading(false);
//     }
//   };

//   /* ---------------- PAYMENTS ---------------- */
//   const handlePaymentStatusClick = async (order) => {
//     if (!order?._id) return;
//     try {
//       setPaymentLoading(true);
//       const response = await getPaymentsByOrder(order._id);
//       const data = response.data;
//       setSelectedPaymentOrder({ ...order, ...(data.order || {}) });
//       setOrderPayments(data.data || []);
//       setPaymentModalOpen(true);
//     } catch (error) {
//       console.error("Failed to fetch payments:", error);
//       toast.error(error?.response?.data?.message || "Failed to load payment details");
//     } finally {
//       setPaymentLoading(false);
//     }
//   };

//   const handlePaymentFormChange = (e) => {
//     const { name, value } = e.target;
//     setPaymentForm((prev) => ({ ...prev, [name]: value }));
//   };

//   const handleAddPayment = async (e) => {
//     e.preventDefault();
//     if (!selectedPaymentOrder?._id) return;
//     const amount = Number(paymentForm.amount);
//     if (!amount || amount <= 0) { toast.warn("Please enter a valid payment amount."); return; }


//     const remaining =
//       Number(selectedPaymentOrder.grandTotal || 0) - Number(selectedPaymentOrder.amountPaid || 0);
//     if (amount > remaining) {
//       toast.warn(`Payment cannot exceed the remaining amount of ₹${remaining.toLocaleString("en-IN")}.`);
//       return;
//     };

//     try {
//       setPaymentSubmitting(true);
//       await createPayment({
//         order: selectedPaymentOrder._id,
//         contact: selectedPaymentOrder.contact?._id || selectedPaymentOrder.contact,
//         amount,
//         paymentMode: paymentForm.paymentMode,
//         paymentDate: paymentForm.paymentDate,
//         paidFrom: paymentForm.paidFrom,
//         transactionId: paymentForm.transactionId,
//         chequeNumber: paymentForm.chequeNumber,
//         bankName: paymentForm.bankName,
//         notes: paymentForm.notes,
//       });

//       const response = await getPaymentsByOrder(selectedPaymentOrder._id);
//       const data = response.data;
//       setSelectedPaymentOrder((prev) => ({ ...prev, ...(data.order || {}) }));
//       setOrderPayments(data.data || []);
//       setAddPaymentModalOpen(false);
//       setPaymentForm({
//         amount: "",
//         paymentMode: "UPI",
//         paymentDate: new Date().toISOString().split("T")[0],
//         paidFrom: "",
//         transactionId: "",
//         chequeNumber: "",
//         bankName: "",
//         notes: "",
//       });

//       toast.success(`Payment of ₹${amount.toLocaleString("en-IN")} recorded`);

//       fetchOrders();
//     }catch (error) {
//       console.error("Failed to create payment:", error);
//       toast.error(error?.response?.data?.message || "Failed to add payment.");
//     } finally {
//       setPaymentSubmitting(false);
//     }
//   };

//   /* ---------------- PRIMARY ACTION BUTTON ---------------- */
//   const renderPrimaryAction = (order) => {
//     if (!order) return null;
//     const s = order.status;

//     if (s === "Draft") {
//       return (
//         <button
//           type="button"
//           onClick={() => handleStatusChange(order, "Confirmed")}
//           className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#002244] px-3 text-xs font-semibold text-white transition hover:bg-[#00335f]"
//         >
//           <CheckCircle2 size={13} /> Confirm Order
//         </button>
//       );
//     }
//     if (s === "Confirmed" || s === "In Production") {
//       return (
//         <button
//           type="button"
//           onClick={() => handleStatusChange(order, "Ready for Dispatch")}
//           className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#002244] px-3 text-xs font-semibold text-white transition hover:bg-[#00335f]"
//         >
//           <Package size={13} /> Ready for Dispatch
//         </button>
//       );
//     }
//     if (s === "Ready for Dispatch") {
//       return (
//         <button
//           type="button"
//           onClick={() => handleStatusChange(order, "Dispatched")}
//           className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-700"
//         >
//           <Truck size={13} /> Dispatch Order
//         </button>
//       );
//     }
//     if (s === "Dispatched") {
//       return (
//         <button
//           type="button"
//           onClick={() => handleStatusChange(order, "Delivered")}
//           className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700"
//         >
//           <CheckCircle2 size={13} /> Mark Delivered
//         </button>
//       );
//     }
//     return null;
//   };

//   return (
//     <div className="min-h-full space-y-5 pb-6">
//       {/* PAGE HEADER */}
//       <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
//         <div>
//           {/* <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
//             <span>Commercial Operations</span>
//             <span className="text-slate-300">/</span>
//             <span>Fulfilment</span>
//             <span className="text-slate-300">/</span>
//             <span>Orders</span>
//           </div> */}
//           <h1 className="text-2xl font-bold tracking-tight text-slate-900">Orders</h1>
//           <p className="mt-1 text-sm text-slate-500">
//             Manage customer purchase orders, production and fulfilment.
//           </p>
//         </div>
//         <div className="flex items-center gap-2">
//           <button
//             type="button"
//             onClick={handleRefresh}
//             disabled={loading}
//             className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
//           >
//             <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
//             Refresh
//           </button>
//           <button
//             type="button"
//             onClick={openAddModal}
//             className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#002244] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00335f] hover:shadow-md"
//           >
//             <Plus size={16} />
//             New Order
//           </button>
//         </div>
//       </section>

//       {/* ERROR */}
//       {error && (
//         <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
//           <AlertCircle size={17} className="mt-0.5 shrink-0" />
//           <div>
//             <p className="font-semibold">Unable to load orders</p>
//             <p className="mt-0.5 text-rose-600">{error}</p>
//           </div>
//         </div>
//       )}

//       {/* KPIs */}
//       <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
//         <KpiCard label="Total Orders" value={stats.total} description="Active purchase orders" icon={FileText} />
//         <KpiCard label="In Process" value={stats.inProcess} description="Active production" icon={Factory} />
//         <KpiCard label="Dispatched" value={stats.dispatched} description="Current page" icon={Truck} />
//         <KpiCard label="Order Value" value={formatCurrency(stats.value)} description="Loaded orders" icon={IndianRupee} />
//       </section>

//       {/* FILTERS */}
//       <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
//         <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
//           <div className="relative min-w-0 flex-1">
//             <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
//             <input
//               value={search}
//               onChange={(e) => { setPage(1); setSearch(e.target.value); }}
//               placeholder="Search by order number, customer or phone..."
//               className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
//             />
//           </div>
//           <div className="grid grid-cols-2 gap-2 sm:flex">
//             <select
//               value={statusFilter}
//               onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
//               className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none transition hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
//             >
//               <option value="All">All Status</option>
//               {ORDER_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
//             </select>
//             <select
//               value={paymentFilter}
//               onChange={(e) => { setPage(1); setPaymentFilter(e.target.value); }}
//               className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none transition hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
//             >
//               <option value="All">All Payments</option>
//               {PAYMENT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
//             </select>
//           </div>
//         </div>
//       </section>

//       {/* TABLE */}
//       <section className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
//         <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
//           <div>
//             <h2 className="text-sm font-bold text-slate-900">Manufacturing &amp; Dispatch Log</h2>
//             <p className="mt-1 text-xs text-slate-500">Purchase orders and current fulfilment status.</p>
//           </div>
//           <div className="text-xs font-medium text-slate-400">
//             {loading ? "Updating..." : `${orders.length} shown`}
//           </div>
//         </div>

//         <div className="overflow-x-auto">
//           <table className="w-full min-w-[820px] border-collapse">
//             <thead>
//               <tr className="border-b border-slate-100 bg-slate-50/70">
//                 <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Order</th>
//                 <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer</th>
//                 <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Items / Qty</th>
//                 <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Value</th>
//                 <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment</th>
//                 <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
//               </tr>
//             </thead>
//             <tbody>
//               {loading ? (
//                 Array.from({ length: ORDERS_PER_PAGE }).map((_, i) => (
//                   <tr key={i} className="border-b border-slate-100">
//                     <td className="px-5 py-4"><Skeleton width="w-24" /><Skeleton width="w-16" /></td>
//                     <td className="px-4 py-4"><Skeleton width="w-28" /><Skeleton width="w-20" /></td>
//                     <td className="px-4 py-4"><Skeleton width="w-32" /><Skeleton width="w-20" /></td>
//                     <td className="px-4 py-4"><Skeleton width="w-20" /></td>
//                     <td className="px-4 py-4"><Skeleton width="w-16" rounded /></td>
//                     <td className="px-5 py-4"><Skeleton width="w-24" rounded /></td>
//                   </tr>
//                 ))
//               ) : orders.length === 0 ? (
//                 <tr>
//                   <td colSpan="6" className="px-5 py-16">
//                     <div className="flex flex-col items-center justify-center text-center">
//                       <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
//                         <Package size={21} />
//                       </div>
//                       <h3 className="mt-4 text-sm font-semibold text-slate-800">No orders found</h3>
//                       <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
//                         Try adjusting your search or filters, or create a new purchase order.
//                       </p>
//                       <button
//                         type="button"
//                         onClick={openAddModal}
//                         className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#002244] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#00335f]"
//                       >
//                         <Plus size={14} /> New Order
//                       </button>
//                     </div>
//                   </td>
//                 </tr>
//               ) : (
//                 orders.map((order) => (
//                   <tr
//                     key={order._id}
//                     onClick={() => openViewOrder(order)}
//                     className="group cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/70"
//                   >
//                     <td className="px-5 py-4">
//                       <span className="font-mono text-xs font-bold text-[#002244]">{order.orderNumber}</span>
//                       <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
//                         <CalendarDays size={11} />
//                         {formatDate(order.orderDate)}
//                       </div>
//                     </td>
//                     <td className="px-4 py-4">
//                       <div className="flex items-center gap-2.5">
//                         <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
//                           <UserRound size={14} />
//                         </div>
//                         <div className="min-w-0">
//                           <p className="truncate text-sm font-semibold text-slate-800">{getContactName(order.contact)}</p>
//                           <p className="mt-0.5 truncate text-xs text-slate-400">{getContactPerson(order.contact)}</p>
//                         </div>
//                       </div>
//                     </td>
//                     <td className="px-4 py-4">
//                       <p className="max-w-[240px] truncate text-sm font-medium text-slate-700">{getItemsLabel(order)}</p>
//                       <p className="mt-1 max-w-[240px] truncate text-xs text-slate-400">{getItemsQuantity(order)}</p>
//                     </td>
//                     <td className="px-4 py-4">
//                       <p className="text-sm font-semibold text-slate-800">{formatCurrency(order.grandTotal)}</p>
//                       <p className="mt-1 text-[11px] text-slate-400">
//                         {order.amountPaid ? `${formatCurrency(order.amountPaid)} paid` : "No payment"}
//                       </p>
//                     </td>
//                     <td
//                       className="px-4 py-4"
//                       onClick={(e) => { e.stopPropagation(); handlePaymentStatusClick(order); }}
//                     >
//                       <button
//                         type="button"
//                         className="cursor-pointer rounded-full transition hover:scale-[1.02] disabled:cursor-wait disabled:opacity-60"
//                         disabled={paymentLoading}
//                       >
//                         <PaymentBadge status={order.paymentStatus} />
//                       </button>
//                     </td>
//                     <td className="px-5 py-4"><StatusBadge status={order.status} /></td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>

//         {/* PAGINATION */}
//         <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
//           <p className="text-xs text-slate-400">
//             Showing{" "}
//             <span className="font-semibold text-slate-600">
//               {totalOrders === 0 ? 0 : (page - 1) * ORDERS_PER_PAGE + 1}
//             </span>{" "}
//             to <span className="font-semibold text-slate-600">{Math.min(page * ORDERS_PER_PAGE, totalOrders)}</span> of{" "}
//             <span className="font-semibold text-slate-600">{totalOrders}</span> purchase orders
//           </p>
//           <div className="flex items-center gap-1.5">
//             <button
//               type="button"
//               disabled={page <= 1 || loading}
//               onClick={() => setPage((c) => c - 1)}
//               className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
//             >
//               <ChevronLeft size={14} /> Previous
//             </button>
//             <div className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#002244] px-2 text-xs font-semibold text-white">
//               {page}
//             </div>
//             <button
//               type="button"
//               disabled={page >= pages || loading}
//               onClick={() => setPage((c) => c + 1)}
//               className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
//             >
//               Next <ChevronRight size={14} />
//             </button>
//           </div>
//         </div>
//       </section>

//       {/* =====================================================
//           ORDER DETAILS MODAL
//       ===================================================== */}
//       {viewOrder && (
//         <div
//           className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
//           onClick={closeViewOrder}
//         >
//           <div
//             className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/60 px-6 py-5">
//               <div className="min-w-0">
//                 <div className="flex flex-wrap items-center gap-2">
//                   <span className="font-mono text-xs font-bold text-[#002244]">{viewOrder.orderNumber}</span>
//                   <StatusBadge status={viewOrder.status} />
//                   <PaymentBadge status={viewOrder.paymentStatus} />
//                 </div>
//                 <h2 className="mt-3 text-lg font-bold tracking-tight text-slate-900">Order Details</h2>
//                 <p className="mt-1 text-xs leading-5 text-slate-500">
//                   Created {formatDate(viewOrder.orderDate)}
//                   <span className="mx-1.5 text-slate-300">•</span>
//                   Expected {formatDate(viewOrder.expectedDeliveryDate)}
//                 </p>
//               </div>
//               <button
//                 type="button"
//                 onClick={closeViewOrder}
//                 className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
//                 aria-label="Close"
//               >
//                 <X size={18} />
//               </button>
//             </div>

//             <div className="relative overflow-y-auto px-6 py-6">
//               {detailLoading && (
//                 <div className="absolute right-5 top-5 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-500 shadow-sm">
//                   <RefreshCw size={13} className="animate-spin" /> Loading details...
//                 </div>
//               )}

//               <div className="space-y-6">
//                 {/* PURCHASER */}
//                 <div>
//                   <SectionHeading icon={UserRound} title="Purchaser Information" />
//                   <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
//                     <p className="text-sm font-bold text-slate-800">{getContactName(viewOrder.contact)}</p>
//                     <p className="mt-1 text-xs text-slate-500">{getContactPerson(viewOrder.contact)}</p>
//                     <div className="mt-3 grid grid-cols-1 gap-2.5 border-t border-slate-200/70 pt-3 sm:grid-cols-2">
//                       <DetailRow label="Contact Person" value={viewOrder.contact?.name} />
//                       <DetailRow label="Role" value={viewOrder.contact?.role} />
//                       <DetailRow label="Phone" value={viewOrder.contact?.phone} />
//                       <DetailRow label="Email" value={viewOrder.contact?.email} />
//                       <DetailRow label="GSTIN" value={viewOrder.contact?.gstin} />
//                       <DetailRow
//                         label="State"
//                         value={
//                           viewOrder.contact?.state
//                             ? `${viewOrder.contact.state}${viewOrder.contact?.stateCode ? ` (${viewOrder.contact.stateCode})` : ""}`
//                             : "—"
//                         }
//                       />
//                       <div className="sm:col-span-2">
//                         <DetailRow label="Address" value={viewOrder.contact?.address} />
//                       </div>
//                       {viewOrder.enquiry && (
//                         <DetailRow
//                           label="Enquiry"
//                           value={viewOrder.enquiry?.enquiryNumber || viewOrder.enquiry}
//                         />
//                       )}
//                     </div>
//                   </div>
//                 </div>

//                 {/* ITEMS */}
//                 <div>
//                   <SectionHeading icon={Package} title="Consignment Specification" />
//                   <div className="space-y-3">
//                     {viewOrder.items?.map((item, index) => (
//                       <div key={item._id || index} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
//                         <div className="flex items-start justify-between gap-4">
//                           <div>
//                             <p className="text-sm font-semibold text-slate-800">{getItemName(item)}</p>
//                             <p className="mt-1 text-xs text-slate-400">
//                               {item.size ? `Reel ${item.size}` : `Item ${index + 1}`}
//                             </p>
//                           </div>
//                           <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
//                             {Number(item.quantity || 0).toLocaleString("en-IN")} {item.unit || "Reel"}
//                           </span>
//                         </div>
//                         <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-slate-100 pt-3.5 sm:grid-cols-3">
//                           <DetailMetric label="Rate / Unit" value={formatCurrency(item.rate)} />
//                           <DetailMetric label="Item Discount" value={formatCurrency(item.discount)} />
//                           <DetailMetric label="Line Amount" value={formatCurrency(item.amount)} strong />
//                         </div>
//                       </div>
//                     ))}
//                   </div>

//                   <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
//                     <div className="space-y-2.5">
//                       <DetailRow label="Subtotal" value={formatCurrency(viewOrder.subTotal)} />
//                       <DetailRow label="Overall Discount" value={formatCurrency(viewOrder.discount)} />
//                       <DetailRow label={`Tax (${viewOrder.taxPercent || 0}%)`} value={formatCurrency(viewOrder.taxAmount)} />
//                       <div className="flex items-center justify-between border-t border-slate-200 pt-3">
//                         <span className="text-sm font-bold text-slate-700">Grand Total</span>
//                         <span className="text-base font-bold text-[#002244]">{formatCurrency(viewOrder.grandTotal)}</span>
//                       </div>
//                     </div>
//                   </div>
//                 </div>

//                 {/* FINANCIAL */}
//                 <div>
//                   <SectionHeading icon={CreditCard} title="Financial / Ledger" iconWrapper="bg-emerald-50 text-emerald-600" />
//                   <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
//                     <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
//                       <DetailMetric label="Order Value" value={formatCurrency(viewOrder.grandTotal)} strong />
//                       <DetailMetric label="Amount Paid" value={formatCurrency(viewOrder.amountPaid)} strong />
//                       <DetailMetric
//                         label="Balance Due"
//                         value={formatCurrency(
//                           Math.max(0, Number(viewOrder.grandTotal || 0) - Number(viewOrder.amountPaid || 0))
//                         )}
//                         strong
//                       />
//                     </div>
//                     <div className="mt-4 border-t border-slate-200/70 pt-3">
//                       <div className="flex items-center justify-between gap-3">
//                         <span className="text-[11px] font-medium text-slate-400">Payment Status</span>
//                         <PaymentBadge status={viewOrder.paymentStatus} />
//                       </div>
//                     </div>
//                   </div>
//                 </div>

//                 {/* LOGISTICS */}
//                 <div>
//                   <SectionHeading icon={MapPin} title="Logistics &amp; Site Address" iconWrapper="bg-sky-50 text-sky-600" />
//                   <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
//                     <div className="flex items-start gap-2.5">
//                       <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
//                       <div className="min-w-0">
//                         <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
//                           Shipping Address
//                         </p>
//                         <p className="mt-1 text-xs leading-5 text-slate-600">
//                           {viewOrder.shippingAddress || "No shipping address provided."}
//                         </p>
//                       </div>
//                     </div>
//                     <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 sm:grid-cols-2">
//                       <DetailMetric label="Billing Address" value={viewOrder.billingAddress || "Same / not provided"} />
//                       <DetailMetric label="Expected Delivery" value={formatDate(viewOrder.expectedDeliveryDate)} />
//                       {viewOrder.dispatchedDate && (
//                         <DetailMetric label="Dispatched" value={formatDate(viewOrder.dispatchedDate)} />
//                       )}
//                       {viewOrder.deliveredDate && (
//                         <DetailMetric label="Delivered" value={formatDate(viewOrder.deliveredDate)} />
//                       )}
//                     </div>
//                   </div>
//                 </div>

//                 {viewOrder.notes && (
//                   <div>
//                     <SectionHeading icon={FileText} title="Notes" />
//                     <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
//                       <p className="whitespace-pre-wrap text-xs leading-5 text-slate-600">{viewOrder.notes}</p>
//                     </div>
//                   </div>
//                 )}

//                 {/* STATUS */}
//                 <div>
//                   <SectionHeading icon={Clock3} title="Order Status" />
//                   <select
//                     value={viewOrder.status || "Draft"}
//                     onChange={(e) => handleStatusChange(viewOrder, e.target.value)}
//                     className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
//                   >
//                     {ORDER_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
//                   </select>
//                 </div>

//                 {/* TIMELINE */}
//                 <div>
//                   <SectionHeading icon={Clock3} title="Audit &amp; Dispatch Timeline" />
//                   <div className="relative space-y-5 pl-6">
//                     <span className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200" />

//                     {viewOrder.stockDeductedAt && (
//                       <TimelineItem
//                         title="Stock deducted"
//                         description="Quantities deducted from ProductStock."
//                         date={formatDate(viewOrder.stockDeductedAt)}
//                         active
//                       />
//                     )}
//                     {viewOrder.dispatchedDate && (
//                       <TimelineItem
//                         title="Order dispatched"
//                         description="Order left the warehouse."
//                         date={formatDate(viewOrder.dispatchedDate)}
//                         active
//                       />
//                     )}

//                     {viewOrder.deliveredDate && (
//                       <TimelineItem
//                         title="Order delivered"
//                         description="Delivery confirmed."
//                         date={formatDate(viewOrder.deliveredDate)}
//                         active
//                       />
//                     )}
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* FOOTER ACTIONS */}
//             <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
//               <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
//                 <button
//                   type="button"
//                   onClick={() => openEditModal(viewOrder)}
//                   disabled={
//                     viewOrder.status !== "Draft" && viewOrder.status !== "Confirmed"
//                   }
//                   className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
//                 >
//                   <Pencil size={13} /> Edit
//                 </button>

//                 <button
//                   type="button"
//                   onClick={() => {
//                     if (invoice) setInvoiceOpen(true);
//                     else handleGenerateInvoice(viewOrder);
//                   }}
//                   disabled={invoiceLoading || ["Draft", "Cancelled"].includes(viewOrder.status)}
//                   className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
//                 >
//                   {invoiceLoading ? <RefreshCw size={13} className="animate-spin" /> : <ReceiptText size={13} />}
//                   {invoiceLoading ? "Loading..." : invoice ? "View Invoice" : "Generate Invoice"}
//                 </button>

//                 {renderPrimaryAction(viewOrder)}

//                 {["Draft", "Cancelled"].includes(viewOrder.status) && (
//                   <button
//                     type="button"
//                     onClick={() => handleDelete(viewOrder)}
//                     disabled={deleting}
//                     className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-4"
//                   >
//                     <Trash2 size={13} />
//                     {deleting ? "Deleting..." : "Delete Order"}
//                   </button>
//                 )}

//                 {!["Draft", "Delivered", "Cancelled"].includes(viewOrder.status) && (
//                   <button
//                     type="button"
//                     onClick={() => handleStatusChange(viewOrder, "Cancelled")}
//                     className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 sm:col-span-4"
//                   >
//                     <AlertCircle size={13} /> Cancel Order
//                   </button>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* =====================================================
//           CREATE / EDIT ORDER MODAL
//           Replace your whole existing `{modalOpen && ( ... )}` block with this.
//       ===================================================== */}
//       {modalOpen && (() => {
//         const isEdit = Boolean(editingOrder);
//         const itemsLocked = isEdit && editingOrder.status !== "Draft";
//         const selectedContact =
//           contacts.find((c) => c._id === form.contact) ||
//           (isEdit && typeof editingOrder.contact === "object" ? editingOrder.contact : null);
//         const filledItems = form.items.filter((it) => it.size);
//         const orderDiscount = Number(form.discount) || 0;

//         const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
//         const fieldCls =
//           "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
//         const areaCls =
//           "w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-5 text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/15";


//         return (
//           <div
//             className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4"
//             onClick={closeModal}
//           >
//             <style>{`
//               @keyframes om-rise {
//                 from { opacity: 0; transform: translateY(12px) scale(0.98); }
//                 to   { opacity: 1; transform: none; }
//               }
//               @media (prefers-reduced-motion: reduce) { .om-rise { animation: none !important; } }
//             `}</style>

//             <div
//               className="om-rise flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
//               style={{ animation: "om-rise 0.18s ease-out" }}
//               onClick={(e) => e.stopPropagation()}
//             >
//               {/* ========== HEADER ========== */}
//               <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
//                 <div className="flex min-w-0 items-center gap-3.5">
//                   <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0f172a]">
//                     {isEdit ? <Pencil size={18} className="text-white" /> : <Layers size={18} className="text-white" />}
//                   </div>
//                   <div className="min-w-0">
//                     <h3 className="truncate text-lg font-semibold text-slate-900">
//                       {isEdit ? `Edit ${editingOrder.orderNumber}` : "New purchase order"}
//                     </h3>
//                     <p className="mt-0.5 truncate text-xs text-slate-500">
//                       {isEdit
//                         ? `${getContactName(editingOrder.contact)} · ${editingOrder.status}`
//                         : "Select customer, add reels, then save as draft"}
//                     </p>
//                   </div>
//                 </div>
//                 <button
//                   type="button"
//                   onClick={closeModal}
//                   disabled={saving}
//                   className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
//                   aria-label="Close"
//                 >
//                   <X size={18} />
//                 </button>
//               </div>

//               {/* ========== BODY ========== */}
//               <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
//                 {/* LEFT – FORM */}
//                 <div className="min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
//                   <div className="space-y-6">

//                     {/* —— CUSTOMER —— */}
//                     <section>
//                       <div className="mb-3 flex items-center gap-2">
//                         <UserRound size={15} className="text-[#0f172a]" />
//                         <h4 className="text-sm font-semibold text-slate-900">Customer</h4>
//                       </div>

//                       <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:grid-cols-2">

//                         {/* Mode toggle — hidden when editing */}
//                         {!isEdit && (
//                           <div className="md:col-span-2">
//                             <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
//                               <button
//                                 type="button"
//                                 onClick={() => setCustomerMode("existing")}
//                                 className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
//                                   customerMode === "existing"
//                                     ? "bg-[#0f172a] text-white"
//                                     : "text-slate-600 hover:text-slate-900"
//                                 }`}
//                               >
//                                 Existing Customer
//                               </button>
//                               <button
//                                 type="button"
//                                 onClick={() => setCustomerMode("new")}
//                                 className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
//                                   customerMode === "new"
//                                     ? "bg-[#0f172a] text-white"
//                                     : "text-slate-600 hover:text-slate-900"
//                                 }`}
//                               >
//                                 New Customer
//                               </button>
//                             </div>
//                           </div>
//                         )}

//                         {/* Existing → dropdown */}
//                         {!isEdit && customerMode === "existing" && (
//                           <div className="md:col-span-2">
//                             <label className={labelCls}>
//                               Customer <span className="text-rose-500">*</span>
//                             </label>
//                             <select
//                               className={fieldCls}
//                               name="contact"
//                               value={form.contact}
//                               onChange={(e) => {
//                                 const contactId = e.target.value;
//                                 const picked = contacts.find((c) => c._id === contactId);
//                                 setForm((current) => ({
//                                   ...current,
//                                   contact: contactId,
//                                   shippingAddress: picked?.address || current.shippingAddress || "",
//                                   billingAddress: picked?.address || current.billingAddress || "",
//                                 }));
//                               }}
//                             >
//                               <option value="">Select a customer</option>
//                               {contacts.map((c) => (
//                                 <option key={c._id} value={c._id}>
//                                   {getContactName(c)}
//                                   {c.name && c.company ? ` — ${c.name}` : ""}
//                                 </option>
//                               ))}
//                             </select>
//                           </div>
//                         )}

//                         {/* New → name + phone */}
//                         {!isEdit && customerMode === "new" && (
//                           <>
//                             <div>
//                               <label className={labelCls}>
//                                 Customer name <span className="text-rose-500">*</span>
//                               </label>
//                               <input
//                                 type="text"
//                                 className={fieldCls}
//                                 value={newCustomerName}
//                                 onChange={(e) => setNewCustomerName(e.target.value)}
//                                 placeholder="e.g. Ramesh Kumar"
//                               />
//                             </div>
//                               <div>
//                                 <label className={labelCls}>
//                                   Phone number <span className="text-rose-500">*</span>
//                                 </label>
//                                 <input
//                                   type="tel"
//                                   inputMode="numeric"
//                                   maxLength={10}
//                                   className={fieldCls}
//                                   value={newCustomerPhone}
//                                   onChange={(e) => {
//                                     // Digits only, max 10
//                                     const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
//                                     setNewCustomerPhone(digits);
//                                   }}
//                                   placeholder="10-digit mobile e.g. 9876543210"
//                                 />
//                                 {newCustomerPhone && !/^[6-9]\d{9}$/.test(newCustomerPhone) && (
//                                   <p className="mt-1 text-[11px] font-medium text-rose-600">
//                                     Enter a valid 10-digit number starting with 6–9
//                                   </p>
//                                 )}
//                               </div>
//                             <p className="md:col-span-2 -mt-1 text-[11px] text-slate-500">
//                               A new contact will be created automatically. You can fill in company, email, and GSTIN later from the Contacts page.
//                             </p>
//                           </>
//                         )}

//                         {/* Expected delivery — unchanged */}
//                         <div className={isEdit || customerMode === "new" ? "md:col-span-2" : ""}>
//                           <label className={labelCls}>
//                             Expected delivery{" "}
//                             <span className="font-normal normal-case tracking-normal text-slate-400">
//                               (optional)
//                             </span>
//                           </label>
//                           <div className="relative">
//                             <CalendarDays
//                               size={15}
//                               className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
//                             />
//                             <input
//                               className={`${fieldCls} pl-10`}
//                               type="date"
//                               name="expectedDeliveryDate"
//                               value={form.expectedDeliveryDate}
//                               onChange={handleChange}
//                             />
//                           </div>
//                         </div>

//                         {/* Selected contact preview — only in existing mode */}
//                         {customerMode === "existing" && selectedContact && (
//                           <div className="md:col-span-2">
//                             <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3">
//                               <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0f172a] text-xs font-bold text-white">
//                                 {getContactName(selectedContact).charAt(0).toUpperCase()}
//                               </div>
//                               <div className="min-w-0 flex-1">
//                                 <p className="truncate text-sm font-semibold text-slate-900">
//                                   {getContactName(selectedContact)}
//                                 </p>
//                                 <p className="truncate text-xs text-slate-500">
//                                   {[getContactPerson(selectedContact), selectedContact.phone]
//                                     .filter((v) => v && v !== "—")
//                                     .join("  ·  ")}
//                                 </p>
//                               </div>
//                               <div className="hidden flex-wrap gap-1.5 sm:flex">
//                                 {selectedContact.gstin && (
//                                   <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
//                                     {selectedContact.gstin}
//                                   </span>
//                                 )}
//                                 {selectedContact.state && (
//                                   <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
//                                     {selectedContact.state}
//                                   </span>
//                                 )}
//                               </div>
//                             </div>
//                           </div>
//                         )}
//                       </div>
//                     </section>

//                     {/* —— REELS —— */}
//                     <section>
//                       <div className="mb-3 flex items-center justify-between">
//                         <div className="flex items-center gap-2">
//                           <Layers size={15} className="text-[#0f172a]" />
//                           <h4 className="text-sm font-semibold text-slate-900">Reels</h4>
//                         </div>
//                         {!itemsLocked && (
//                           <button
//                             type="button"
//                             onClick={addItemRow}
//                             className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[#0f172a] hover:text-[#0f172a]"
//                           >
//                             <Plus size={14} /> Add reel
//                           </button>
//                         )}
//                       </div>

//                       {itemsLocked && (
//                         <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
//                           <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
//                           <p className="text-xs leading-5 text-amber-800">
//                             This order is <strong>{editingOrder.status}</strong>. Items are locked. Cancel the order to change them.
//                           </p>
//                         </div>
//                       )}

//                       <div className="space-y-3">
//                         {form.items.map((item, i) => {
//                           const rowAmount = Math.max(
//                             0,
//                             Number(item.quantity || 0) * Number(item.rate || 0) - Number(item.discount || 0)
//                           );
//                           return (
//                             <div
//                               key={i}
//                               className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
//                             >
//                               {/* header row */}
//                               <div className="mb-3 flex items-center justify-between">
//                                 <span className="text-sm font-semibold text-slate-800">
//                                   {item.size ? `${item.size} reel` : `Reel ${i + 1}`}
//                                 </span>
//                                 <div className="flex items-center gap-3">
//                                   <span className="text-sm font-bold tabular-nums text-slate-900">
//                                     {formatCurrency(rowAmount)}
//                                   </span>
//                                   {!itemsLocked && (
//                                     <button
//                                       type="button"
//                                       onClick={() => removeItemRow(i)}
//                                       disabled={form.items.length === 1}
//                                       className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
//                                       title="Remove"
//                                     >
//                                       <Trash2 size={14} />
//                                     </button>
//                                   )}
//                                 </div>
//                               </div>

//                               {/* size grid */}
//                               {/* size input + auto-detected spool weight */}
//                               <div className="mb-3">
//                                 <label className={labelCls}>Reel size (kg)</label>

//                                 <div className="flex items-center gap-2">
//                                   <div className="relative flex-1">
//                                     <input
//                                       type="number"
//                                       min="0"
//                                       step="0.5"
//                                       disabled={itemsLocked}
//                                       value={sizeToNumberString(item.size)}
//                                       onChange={(e) => {
//                                         const v = e.target.value;
//                                         updateItem(i, { size: v ? `${v}kg` : "" });
//                                       }}
//                                       placeholder="e.g. 5"
//                                       className={fieldCls}
//                                     />
//                                     <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
//                                       kg
//                                     </span>
//                                   </div>
//                                 </div>

//                                 {/* quick presets — optional, keeps the old shortcuts */}
//                                 {/* <div className="mt-2 flex flex-wrap gap-1.5">
//                                   {REEL_SIZES.map((s) => {
//                                     const active = item.size === s;
//                                     return (
//                                       <button
//                                         key={s}
//                                         type="button"
//                                         disabled={itemsLocked}
//                                         onClick={() => updateItem(i, { size: active ? "" : s })}
//                                         className={`h-7 rounded-md border px-2.5 text-[11px] font-semibold transition disabled:cursor-not-allowed ${
//                                           active
//                                             ? "border-[#0f172a] bg-[#0f172a] text-white"
//                                             : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
//                                         }`}
//                                       >
//                                         {s}
//                                       </button>
//                                     );
//                                   })}
//                                 </div> */}

//                                 {/* auto-detected specs */}
//                                 {item.size &&
//                                   (() => {
//                                     const specs = getReelSpecs(item.size);
//                                     if (!specs.kg) return null;
//                                     return (
//                                       <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
//                                         <span className="text-slate-500">
//                                           Spool weight
//                                           <span className="ml-1 font-bold text-slate-800">
//                                             {specs.spoolKg} kg
//                                           </span>
//                                         </span>
//                                         <span className="text-slate-300">·</span>
//                                         <span className="text-slate-500">
//                                           Steel content
//                                           <span className="ml-1 font-bold text-slate-800">
//                                             {specs.steelKg.toFixed(2)} kg
//                                           </span>
//                                         </span>
//                                       </div>
//                                     );
//                                   })()}
//                               </div>

//                               {/* qty / rate / discount */}
//                               <div className="grid grid-cols-3 gap-3">
//                                 <div>
//                                   <label className={labelCls}>Qty</label>
//                                   <input
//                                     className={fieldCls}
//                                     type="number"
//                                     min="0"
//                                     step="1"
//                                     disabled={itemsLocked}
//                                     value={item.quantity}
//                                     onChange={(e) => updateItem(i, { quantity: e.target.value })}
//                                     placeholder="0"
//                                   />
//                                 </div>
//                                 <div>
//                                   <label className={labelCls}>Rate (₹)</label>
//                                   <input
//                                     className={fieldCls}
//                                     type="number"
//                                     min="0"
//                                     step="0.01"
//                                     disabled={itemsLocked}
//                                     value={item.rate}
//                                     onChange={(e) => updateItem(i, { rate: e.target.value })}
//                                     placeholder="0.00"
//                                   />
//                                 </div>
//                                 <div>
//                                   <label className={labelCls}>Discount (₹)</label>
//                                   <input
//                                     className={fieldCls}
//                                     type="number"
//                                     min="0"
//                                     step="0.01"
//                                     disabled={itemsLocked}
//                                     value={item.discount}
//                                     onChange={(e) => updateItem(i, { discount: e.target.value })}
//                                     placeholder="0.00"
//                                   />
//                                 </div>
//                               </div>
//                             </div>
//                           );
//                         })}
//                       </div>
//                     </section>

//                     {/* —— ADDRESSES —— */}
//                     <section>
//                       <div className="mb-3 flex items-center gap-2">
//                         <MapPin size={15} className="text-[#0f172a]" />
//                         <h4 className="text-sm font-semibold text-slate-900">Addresses</h4>
//                       </div>
//                       <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
//                         <div>
//                           <label className={labelCls}>Shipping address</label>
//                           <textarea
//                             className={areaCls}
//                             name="shippingAddress"
//                             value={form.shippingAddress}
//                             onChange={handleChange}
//                             placeholder="Delivery address"
//                             rows="3"
//                           />
//                         </div>
//                         <div>
//                           <div className="mb-1.5 flex items-center justify-between">
//                             <label className={labelCls + " mb-0"}>Billing address</label>
//                             <button
//                               type="button"
//                               onClick={() =>
//                                 setForm((current) => ({
//                                   ...current,
//                                   billingAddress: current.shippingAddress,
//                                 }))
//                               }
//                               className="text-[11px] font-medium text-[#0f172a] hover:underline"
//                             >
//                               Same as shipping
//                             </button>
//                           </div>
//                           <textarea
//                             className={areaCls}
//                             name="billingAddress"
//                             value={form.billingAddress}
//                             onChange={handleChange}
//                             placeholder="Billing address"
//                             rows="3"
//                           />
//                         </div>
//                       </div>
//                     </section>

//                     {/* —— NOTES —— */}
//                     <section>
//                       <div className="mb-3 flex items-center gap-2">
//                         <FileText size={15} className="text-[#0f172a]" />
//                         <h4 className="text-sm font-semibold text-slate-900">Notes</h4>
//                       </div>
//                       <textarea
//                         className={areaCls}
//                         name="notes"
//                         value={form.notes}
//                         onChange={handleChange}
//                         placeholder="PO reference, packing instructions, etc."
//                         rows="2"
//                       />
//                     </section>
//                   </div>
//                 </div>

//                 {/* RIGHT – SUMMARY */}
//                 <aside className="w-full shrink-0 border-t border-slate-200 bg-slate-50 lg:w-[300px] lg:border-l lg:border-t-0">
//                   <div className="flex h-full flex-col p-5 sm:p-6">
//                     <div className="mb-4 flex items-center gap-2">
//                       <Receipt size={15} className="text-[#0f172a]" />
//                       <h4 className="text-sm font-semibold text-slate-900">Order summary</h4>
//                     </div>

//                     {/* line items */}
//                     <div className="mb-4 flex-1 space-y-2">
//                       {filledItems.length === 0 ? (
//                         <p className="rounded-lg border border-dashed border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
//                           No reels added yet
//                         </p>
//                       ) : (
//                         filledItems.map((it, i) => {
//                           const amt = Math.max(
//                             0,
//                             Number(it.quantity || 0) * Number(it.rate || 0) - Number(it.discount || 0)
//                           );
//                           return (
//                             <div
//                               key={i}
//                               className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs"
//                             >
//                               <span className="font-medium text-slate-700">
//                                 {it.size} × {Number(it.quantity || 0).toLocaleString("en-IN")}
//                               </span>
//                               <span className="font-semibold tabular-nums text-slate-900">
//                                 {formatCurrency(amt)}
//                               </span>
//                             </div>
//                           );
//                         })
//                       )}
//                     </div>

//                     {/* discount + tax */}
//                     <div className="mb-4 grid grid-cols-2 gap-3">
//                       <div>
//                         <label className={labelCls}>Discount (₹)</label>
//                         <input
//                           className={fieldCls}
//                           type="number"
//                           min="0"
//                           step="0.01"
//                           name="discount"
//                           value={form.discount}
//                           onChange={handleChange}
//                           placeholder="0"
//                         />
//                       </div>
//                       <div>
//                         <label className={labelCls}>Tax %</label>
//                         <input
//                           className={fieldCls}
//                           type="number"
//                           min="0"
//                           step="0.01"
//                           name="taxPercent"
//                           value={form.taxPercent}
//                           onChange={handleChange}
//                         />
//                       </div>
//                     </div>

//                     {/* totals */}
//                     <div className="space-y-2 border-t border-slate-200 pt-4 text-sm">
//                       <div className="flex justify-between text-slate-600">
//                         <span>Subtotal</span>
//                         <span className="font-medium tabular-nums text-slate-800">
//                           {formatCurrency(previewTotals.subTotal)}
//                         </span>
//                       </div>
//                       {orderDiscount > 0 && (
//                         <div className="flex justify-between text-slate-600">
//                           <span>Discount</span>
//                           <span className="font-medium tabular-nums text-emerald-600">
//                             −{formatCurrency(orderDiscount)}
//                           </span>
//                         </div>
//                       )}
//                       <div className="flex justify-between text-slate-600">
//                         <span>Tax ({form.taxPercent || 0}%)</span>
//                         <span className="font-medium tabular-nums text-slate-800">
//                           {formatCurrency(previewTotals.tax)}
//                         </span>
//                       </div>
//                     </div>

//                     {/* grand total */}
//                     <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
//                       <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
//                         Grand total
//                       </p>
//                       <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
//                         {formatCurrency(previewTotals.grandTotal)}
//                       </p>
//                     </div>
//                   </div>
//                 </aside>
//               </div>

//               {/* ========== FOOTER ========== */}
//               <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3.5 sm:px-6">
//                 <p className="hidden text-xs text-slate-500 sm:block">
//                   {isEdit ? "Changes save immediately." : "Saves as draft. Confirm later to deduct stock."}
//                 </p>
//                 <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
//                   <button
//                     type="button"
//                     onClick={closeModal}
//                     disabled={saving}
//                     className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:flex-none"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     type="button"
//                     onClick={isEdit ? handleUpdate : handleCreate}
//                     disabled={saving}
//                     className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:flex-none"
//                   >
//                     {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
//                     {saving ? "Saving..." : isEdit ? "Save changes" : "Create order"}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         );
//       })()}

//       {invoiceOpen && invoice && (
//         <InvoiceModal invoice={invoice} onClose={() => setInvoiceOpen(false)} />
//       )}

//       {/* PAYMENTS MODAL */}
//       {paymentModalOpen && selectedPaymentOrder && (
//         <div
//           className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
//           onClick={() => setPaymentModalOpen(false)}
//         >
//           <div
//             className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
//             onClick={(e) => e.stopPropagation()}
//           >
//             <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
//               <div>
//                 <h2 className="text-lg font-bold tracking-tight text-slate-900">
//                   Payments — {selectedPaymentOrder.orderNumber}
//                 </h2>
//                 <p className="mt-1 text-sm text-slate-500">
//                   {getContactName(selectedPaymentOrder.contact)}
//                 </p>
//               </div>
//               <button
//                 type="button"
//                 onClick={() => setPaymentModalOpen(false)}
//                 className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
//                 aria-label="Close"
//               >
//                 <X size={18} />
//               </button>
//             </div>

//             <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
//               <div className="grid grid-cols-3 gap-4">
//                 <div>
//                   <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Order Value</p>
//                   <p className="mt-1 text-sm font-bold text-slate-800">{formatCurrency(selectedPaymentOrder.grandTotal)}</p>
//                 </div>
//                 <div>
//                   <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Amount Paid</p>
//                   <p className="mt-1 text-sm font-bold text-emerald-600">{formatCurrency(selectedPaymentOrder.amountPaid)}</p>
//                 </div>
//                 <div>
//                   <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Balance Due</p>
//                   <p className="mt-1 text-sm font-bold text-amber-600">
//                     {formatCurrency(
//                       Math.max(0, Number(selectedPaymentOrder.grandTotal || 0) - Number(selectedPaymentOrder.amountPaid || 0))
//                     )}
//                   </p>
//                 </div>
//               </div>
//               <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-3">
//                 <span className="text-[11px] font-medium text-slate-400">Payment Status</span>
//                 <PaymentBadge status={selectedPaymentOrder.paymentStatus} />
//               </div>
//             </div>

//             <div className="flex-1 overflow-y-auto px-6 py-5">
//               {paymentLoading ? (
//                 <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
//                   <RefreshCw size={16} className="animate-spin" /> Loading payments...
//                 </div>
//               ) : orderPayments.length === 0 ? (
//                 <div className="flex flex-col items-center justify-center py-12 text-center">
//                   <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
//                     <Wallet size={20} />
//                   </div>
//                   <p className="mt-4 text-sm font-semibold text-slate-800">No payments recorded</p>
//                   <p className="mt-1 text-xs text-slate-500">Add the first payment for this order.</p>
//                 </div>
//               ) : (
//                 <div className="space-y-3">
//                   {orderPayments.map((payment) => (
//                     <div key={payment._id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
//                       <div className="flex items-start justify-between gap-3">
//                         <div>
//                           <p className="text-sm font-bold text-slate-800">{formatCurrency(payment.amount)}</p>
//                           <p className="mt-0.5 text-xs text-slate-500">
//                             {payment.paymentMode || "—"} · {formatDate(payment.paymentDate)}
//                           </p>
//                         </div>
//                         <span className="shrink-0 text-[11px] font-medium text-slate-400">
//                           {payment.transactionId || payment.chequeNumber || "—"}
//                         </span>
//                       </div>
//                       {(payment.paidFrom || payment.bankName || payment.notes) && (
//                         <div className="mt-2 space-y-0.5 border-t border-slate-200/60 pt-2 text-[11px] text-slate-500">
//                           {payment.paidFrom && <p>From: {payment.paidFrom}</p>}
//                           {payment.bankName && <p>Bank: {payment.bankName}</p>}
//                           {payment.notes && <p>{payment.notes}</p>}
//                         </div>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>

//             <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
//               <button
//                 type="button"
//                 onClick={() => setPaymentModalOpen(false)}
//                 className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
//               >
//                 Close
//               </button>
//               <button
//                 type="button"
//                 onClick={() => { setPaymentModalOpen(false); setAddPaymentModalOpen(true); }}
//                 className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#002244] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00335f]"
//               >
//                 <Plus size={15} /> Add Payment
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ADD PAYMENT MODAL — unchanged from your file */}
//       {addPaymentModalOpen && (
//         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
//           <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
//             <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
//               <div>
//                 <h2 className="text-xl font-semibold text-slate-900">Add Payment</h2>
//                 <p className="mt-1 text-sm text-slate-500">Record a payment for this order</p>
//               </div>
//               <button
//                 type="button"
//                 onClick={() => setAddPaymentModalOpen(false)}
//                 className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
//               >
//                 <X size={20} />
//               </button>
//             </div>

//             <form onSubmit={handleAddPayment}>
//               <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
//                 <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
//                   <div className="flex items-center justify-between">
//                     <div>
//                       <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Order</p>
//                       <p className="mt-1 font-semibold text-slate-900">
//                         {selectedPaymentOrder?.orderNumber || "—"}
//                       </p>
//                     </div>
//                     <div className="text-right">
//                       <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Remaining</p>
//                       <p className="mt-1 text-lg font-bold text-amber-600">
//                         ₹
//                         {Math.max(
//                           0,
//                           Number(selectedPaymentOrder?.grandTotal || 0) - Number(selectedPaymentOrder?.amountPaid || 0)
//                         ).toLocaleString("en-IN")}
//                       </p>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
//                   <div>
//                     <label className="mb-2 block text-sm font-medium text-slate-700">
//                       Payment Amount <span className="text-red-500">*</span>
//                     </label>
//                     <div className="relative">
//                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">₹</span>
//                       <input
//                         type="number"
//                         name="amount"
//                         value={paymentForm.amount}
//                         onChange={handlePaymentFormChange}
//                         min="0.01"
//                         step="0.01"
//                         placeholder="Enter amount"
//                         required
//                         className="w-full rounded-xl border border-slate-300 py-2.5 pl-8 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
//                       />
//                     </div>
//                   </div>

//                   <div>
//                     <label className="mb-2 block text-sm font-medium text-slate-700">
//                       Payment Method <span className="text-red-500">*</span>
//                     </label>
//                     <select
//                       name="paymentMode"
//                       value={paymentForm.paymentMode}
//                       onChange={handlePaymentFormChange}
//                       required
//                       className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
//                     >
//                       <option value="UPI">UPI</option>
//                       <option value="Cash">Cash</option>
//                       <option value="Bank Transfer">Bank Transfer</option>
//                       <option value="NEFT">NEFT</option>
//                       <option value="RTGS">RTGS</option>
//                       <option value="Cheque">Cheque</option>
//                       <option value="Other">Other</option>
//                     </select>
//                   </div>

//                   <div>
//                     <label className="mb-2 block text-sm font-medium text-slate-700">
//                       Payment Date <span className="text-red-500">*</span>
//                     </label>
//                     <input
//                       type="date"
//                       name="paymentDate"
//                       value={paymentForm.paymentDate}
//                       onChange={handlePaymentFormChange}
//                       required
//                       className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
//                     />
//                   </div>

//                   <div>
//                     <label className="mb-2 block text-sm font-medium text-slate-700">Paid From</label>
//                     <input
//                       type="text"
//                       name="paidFrom"
//                       value={paymentForm.paidFrom}
//                       onChange={handlePaymentFormChange}
//                       placeholder="e.g. HDFC Bank / Customer Account"
//                       className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
//                     />
//                   </div>

//                   <div className="md:col-span-2">
//                     <label className="mb-2 block text-sm font-medium text-slate-700">Transaction / Reference ID</label>
//                     <input
//                       type="text"
//                       name="transactionId"
//                       value={paymentForm.transactionId}
//                       onChange={handlePaymentFormChange}
//                       placeholder="Enter transaction or reference ID"
//                       className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
//                     />
//                   </div>

//                   {paymentForm.paymentMode === "Cheque" && (
//                     <>
//                       <div>
//                         <label className="mb-2 block text-sm font-medium text-slate-700">
//                           Cheque Number <span className="text-red-500">*</span>
//                         </label>
//                         <input
//                           type="text"
//                           name="chequeNumber"
//                           value={paymentForm.chequeNumber}
//                           onChange={handlePaymentFormChange}
//                           placeholder="Enter cheque number"
//                           required
//                           className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
//                         />
//                       </div>
//                       <div>
//                         <label className="mb-2 block text-sm font-medium text-slate-700">
//                           Bank Name <span className="text-red-500">*</span>
//                         </label>
//                         <input
//                           type="text"
//                           name="bankName"
//                           value={paymentForm.bankName}
//                           onChange={handlePaymentFormChange}
//                           placeholder="Enter bank name"
//                           required
//                           className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
//                         />
//                       </div>
//                     </>
//                   )}

//                   <div className="md:col-span-2">
//                     <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
//                     <textarea
//                       name="notes"
//                       value={paymentForm.notes}
//                       onChange={handlePaymentFormChange}
//                       rows={3}
//                       placeholder="Add any notes about this payment..."
//                       className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
//                     />
//                   </div>
//                 </div>
//               </div>

//               <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
//                 <button
//                   type="button"
//                   onClick={() => setAddPaymentModalOpen(false)}
//                   className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   type="submit"
//                   disabled={paymentSubmitting}
//                   className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
//                 >
//                   {paymentSubmitting ? (
//                     <>
//                       <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
//                       Saving...
//                     </>
//                   ) : (
//                     <>
//                       <Plus size={17} /> Add Payment
//                     </>
//                   )}
//                 </button>
//               </div>
//             </form>
//           </div>
//         </div>
//       )}

//       {/* =====================================================
//               RESERVED STOCK CONFLICT — confirm before consuming reserved stock
//           ===================================================== */}
//           {isReservedConfirmOpen && reservedConflict && pendingOrder && (
//             <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]">
//               <div className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl">
//                 {/* HEADER */}
//                 <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50/60 px-5 py-4">
//                   <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
//                     <AlertTriangle size={18} />
//                   </div>
//                   <div className="min-w-0 flex-1">
//                     <h2 className="text-base font-semibold text-slate-900">
//                       Reserved stock will be used
//                     </h2>
//                     <p className="mt-0.5 text-[11px] text-slate-600">
//                       Confirming {pendingOrder.order.orderNumber} exceeds the available (free) stock.
//                     </p>
//                   </div>
//                   <button
//                     type="button"
//                     onClick={handleReservedCancel}
//                     disabled={saving}
//                     className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-60"
//                     aria-label="Close"
//                   >
//                     <X size={17} />
//                   </button>
//                 </div>

//                 {/* BODY */}
//                 <div className="space-y-3 px-5 py-5">
//                   <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
//                     {reservedConflict.name}
//                   </p>

//                   <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
//                     <div>
//                       <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
//                         Free
//                       </p>
//                       <p className="mt-1 text-base font-semibold text-emerald-700">
//                         {Number(reservedConflict.freeQty || 0).toLocaleString("en-IN")}{" "}
//                         <span className="text-[10px] font-medium text-slate-500">
//                           {reservedConflict.unit}
//                         </span>
//                       </p>
//                     </div>
//                     <div>
//                       <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
//                         Reserved
//                       </p>
//                       <p className="mt-1 text-base font-semibold text-indigo-600">
//                         {Number(reservedConflict.reservedQty || 0).toLocaleString("en-IN")}{" "}
//                         <span className="text-[10px] font-medium text-slate-500">
//                           {reservedConflict.unit}
//                         </span>
//                       </p>
//                     </div>
//                     <div>
//                       <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
//                         Requested
//                       </p>
//                       <p className="mt-1 text-base font-semibold text-amber-700">
//                         {Number(reservedConflict.requested || 0).toLocaleString("en-IN")}{" "}
//                         <span className="text-[10px] font-medium text-slate-500">
//                           {reservedConflict.unit}
//                         </span>
//                       </p>
//                     </div>
//                   </div>

//                   <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
//                     <p className="text-xs text-amber-900">
//                       <span className="font-semibold">
//                         {Number(reservedConflict.usedFromReserved || 0).toLocaleString("en-IN")}{" "}
//                         {reservedConflict.unit}
//                       </span>{" "}
//                       will be taken from stock reserved by the admin. This will reduce the
//                       reserved quantity on{" "}
//                       <span className="font-semibold">{reservedConflict.size}</span> reel stock.
//                     </p>
//                   </div>

//                   <p className="text-xs text-slate-600">
//                     Do you grant permission to proceed?
//                   </p>
//                 </div>

//                 {/* FOOTER */}
//                 <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:justify-end">
//                   <button
//                     type="button"
//                     onClick={handleReservedCancel}
//                     disabled={saving}
//                     className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
//                   >
//                     No, Cancel
//                   </button>
//                   <button
//                     type="button"
//                     onClick={handleReservedConfirm}
//                     disabled={saving}
//                     className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
//                   >
//                     {saving ? (
//                       <RefreshCw size={14} className="animate-spin" />
//                     ) : (
//                       <CheckCircle2 size={14} />
//                     )}
//                     Yes, Use Reserved
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* =====================================================
//                   GENERIC CONFIRM DIALOG
//               ===================================================== */}
//               {confirmDialog && (
//                 <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[2px]">
//                   <div
//                     className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
//                     onClick={(e) => e.stopPropagation()}
//                   >
//                     <div
//                       className={`flex items-start gap-3 border-b px-5 py-4 ${
//                         confirmDialog.confirmTone === "danger"
//                           ? "border-rose-100 bg-rose-50/60"
//                           : confirmDialog.confirmTone === "emerald"
//                           ? "border-emerald-100 bg-emerald-50/60"
//                           : confirmDialog.confirmTone === "sky"
//                           ? "border-sky-100 bg-sky-50/60"
//                           : "border-amber-100 bg-amber-50/60"
//                       }`}
//                     >
//                       <div
//                         className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
//                           confirmDialog.confirmTone === "danger"
//                             ? "bg-rose-100 text-rose-700"
//                             : confirmDialog.confirmTone === "emerald"
//                             ? "bg-emerald-100 text-emerald-700"
//                             : confirmDialog.confirmTone === "sky"
//                             ? "bg-sky-100 text-sky-700"
//                             : "bg-amber-100 text-amber-700"
//                         }`}
//                       >
//                         {confirmDialog.confirmTone === "danger" ? (
//                           <AlertTriangle size={18} />
//                         ) : (
//                           <CheckCircle2 size={18} />
//                         )}
//                       </div>
//                       <div className="min-w-0 flex-1">
//                         <h2 className="text-base font-semibold text-slate-900">
//                           {confirmDialog.title}
//                         </h2>
//                         <p className="mt-0.5 text-xs leading-5 text-slate-600">
//                           {confirmDialog.message}
//                         </p>
//                       </div>
//                       <button
//                         type="button"
//                         onClick={closeConfirm}
//                         className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
//                         aria-label="Close"
//                       >
//                         <X size={17} />
//                       </button>
//                     </div>

//                     <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
//                       <button
//                         type="button"
//                         onClick={closeConfirm}
//                         className="h-9 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:w-auto"
//                       >
//                         Cancel
//                       </button>
//                       <button
//                         type="button"
//                         onClick={() => {
//                           const fn = confirmDialog.onConfirm;
//                           closeConfirm();
//                           fn?.();
//                         }}
//                         className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold text-white transition-colors sm:w-auto ${
//                           confirmDialog.confirmTone === "danger"
//                             ? "bg-rose-600 hover:bg-rose-700"
//                             : confirmDialog.confirmTone === "emerald"
//                             ? "bg-emerald-600 hover:bg-emerald-700"
//                             : confirmDialog.confirmTone === "sky"
//                             ? "bg-sky-600 hover:bg-sky-700"
//                             : "bg-[#002244] hover:bg-[#00335f]"
//                         }`}
//                       >
//                         <CheckCircle2 size={14} />
//                         {confirmDialog.confirmLabel}
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               )}
//     </div>
//   );
// }

// function InvoiceModal({ invoice, onClose }) {
//   if (!invoice) return null;

//   const seller = invoice.seller || {};
//   const buyer = invoice.buyer || {};
//   const consignee = invoice.consignee || {};

//   const items = invoice.items || [];

//   const formatInvoiceCurrency = (value) =>
//     `₹${Number(value || 0).toLocaleString("en-IN", {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     })}`;

//   const formatInvoiceCurrencyNoSymbol = (value) =>
//     Number(value || 0).toLocaleString("en-IN", {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     });

//   const formatInvoiceDate = (value) => {
//     if (!value) return "—";

//     const date = new Date(value);

//     if (Number.isNaN(date.getTime())) return "—";

//     return date.toLocaleDateString("en-IN", {
//       day: "2-digit",
//       month: "short",
//       year: "2-digit",
//     });
//   };

//   const handlePrint = () => {
//     window.print();
//   };

//   const isIGST = invoice.taxType === "IGST";
//   const taxPercent = isIGST
//     ? invoice.igstPercent || 18
//     : invoice.cgstPercent || 9;
//   const taxAmount = isIGST
//     ? invoice.igstAmount
//     : (Number(invoice.cgstAmount || 0) + Number(invoice.sgstAmount || 0));

//   // Primary HSN from first item (classic format shows one row in tax table)
//   const primaryHsn = items[0]?.hsnSac || "—";

//   return (
//     <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm">
//       {/* MODAL HEADER / ACTIONS */}
//       <div className="mx-auto flex max-w-[900px] items-center justify-between pb-3 print:hidden">
//         <div>
//           <p className="text-sm font-semibold text-white">Tax Invoice</p>
//           <p className="mt-0.5 text-xs text-slate-300">
//             {invoice.invoiceNumber || "Invoice"}
//           </p>
//         </div>

//         <div className="flex items-center gap-2">
//           <button
//             type="button"
//             onClick={handlePrint}
//             className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/20"
//           >
//             <FileText size={14} />
//             Print
//           </button>

//           <button
//             type="button"
//             onClick={onClose}
//             className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
//             aria-label="Close invoice"
//           >
//             <X size={17} />
//           </button>
//         </div>
//       </div>

//       {/* =================================================
//           CLASSIC GST TAX INVOICE (bordered layout)
//       ================================================= */}
//       <div
//         id="invoice-print"
//         className="invoice-paper mx-auto w-full max-w-[794px] bg-white text-[10px] text-black shadow-2xl print:max-w-none print:shadow-none"
//         style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
//       >
//         {/* TITLE */}
//         <div className="border border-black border-b-0 px-2 py-1.5 text-center">
//           <h1 className="text-[16px] font-bold tracking-wide">Tax Invoice</h1>
//         </div>

//         {/* SELLER + INVOICE META GRID */}
//         <div className="grid grid-cols-12 border border-black">
//                     {/* LEFT: Seller details */}
//           <div className="col-span-6 border-r border-black p-2">
//             <div className="flex items-start justify-between gap-2">
//               <div className="flex-1">
//                 <p className="text-[12px] font-bold uppercase leading-tight">
//                   {seller.name || "CORVEX STEEL WIRES"}
//                 </p>
//                 <p className="mt-1 whitespace-pre-line text-[9px] leading-3.5">
//                   {seller.address || "Seller address not configured"}
//                 </p>
//                 <p className="mt-1.5 text-[9px]">
//                   <span className="font-semibold">GSTIN/UIN :</span>{" "}
//                   {seller.gstin || "—"}
//                 </p>
//                 <p className="text-[9px]">
//                   <span className="font-semibold">State Name :</span>{" "}
//                   {seller.state || "—"}
//                   {seller.stateCode ? `, Code : ${seller.stateCode}` : ""}
//                 </p>
//               </div>

//               {/* LOGO (right side of seller details) */}
//               <img
//                 src={logo}
//                 alt="Company Logo"
//                 className="h-16 w-auto max-w-[120px] shrink-0 object-contain"
//               />
//             </div>
//           </div>

//           {/* RIGHT: Invoice fields (2-col grid of cells) */}
//           <div className="col-span-6">
//             <div className="grid grid-cols-2">
//               <div className="border-b border-r border-black px-1.5 py-1">
//                 <p className="text-[8px] text-slate-600">Invoice No.</p>
//                 <p className="font-semibold">{invoice.invoiceNumber || "—"}</p>
//               </div>
//               <div className="border-b border-black px-1.5 py-1">
//                 <p className="text-[8px] text-slate-600">e-Way Bill No.</p>
//                 <p className="font-semibold">{invoice.eWayBillNumber || "—"}</p>
//               </div>

//               <div className="border-b border-r border-black px-1.5 py-1">
//                 <p className="text-[8px] text-slate-600">Dated</p>
//                 <p className="font-semibold">
//                   {formatInvoiceDate(invoice.invoiceDate)}
//                 </p>
//               </div>
//               <div className="border-b border-black px-1.5 py-1">
//                 <p className="text-[8px] text-slate-600">Mode/Terms of Payment</p>
//                 <p className="font-semibold">
//                   {invoice.paymentTerms || "As per Order"}
//                 </p>
//               </div>

//               <div className="border-b border-r border-black px-1.5 py-1">
//                 <p className="text-[8px] text-slate-600">Reference No. & Date</p>
//                 <p className="font-semibold">{invoice.reference || "—"}</p>
//               </div>
//               <div className="border-b border-black px-1.5 py-1">
//                 <p className="text-[8px] text-slate-600">Other References</p>
//                 <p className="font-semibold">{invoice.otherReferences || "—"}</p>
//               </div>

//               <div className="border-b border-r border-black px-1.5 py-1">
//                 <p className="text-[8px] text-slate-600">Buyer's Order No.</p>
//                 <p className="font-semibold">
//                   {invoice.buyersOrderNumber || invoice.reference || "—"}
//                 </p>
//               </div>
//               <div className="border-b border-black px-1.5 py-1">
//                 <p className="text-[8px] text-slate-600">Dated</p>
//                 <p className="font-semibold">
//                   {formatInvoiceDate(invoice.buyersOrderDate || invoice.invoiceDate)}
//                 </p>
//               </div>

//               <div className="border-b border-r border-black px-1.5 py-1">
//                 <p className="text-[8px] text-slate-600">Dispatch Doc No.</p>
//                 <p className="font-semibold">{invoice.dispatchDocNumber || "—"}</p>
//               </div>
//               <div className="border-b border-black px-1.5 py-1">
//                 <p className="text-[8px] text-slate-600">Delivery Note Date</p>
//                 <p className="font-semibold">
//                   {formatInvoiceDate(invoice.deliveryNoteDate)}
//                 </p>
//               </div>

//               <div className="border-r border-black px-1.5 py-1">
//                 <p className="text-[8px] text-slate-600">Dispatched through</p>
//                 <p className="font-semibold">{invoice.dispatchedThrough || "—"}</p>
//               </div>
//               <div className="px-1.5 py-1">
//                 <p className="text-[8px] text-slate-600">Destination</p>
//                 <p className="font-semibold">
//                   {invoice.destination || consignee.state || buyer.state || "—"}
//                 </p>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* CONSIGNEE + BUYER */}
//         <div className="grid grid-cols-2 border border-black border-t-0">
//           <div className="border-r border-black p-2">
//             <p className="text-[9px] font-bold">Consignee (Ship to)</p>
//             <p className="mt-1 text-[11px] font-bold uppercase leading-tight">
//               {consignee.company || consignee.name || "—"}
//             </p>
//             <p className="mt-0.5 whitespace-pre-line text-[9px] leading-3.5">
//               {consignee.address || "—"}
//             </p>
//             <p className="mt-1 text-[9px]">
//               <span className="font-semibold">GSTIN/UIN</span>{" "}
//               : {consignee.gstin || "—"}
//             </p>
//             <p className="text-[9px]">
//               <span className="font-semibold">State Name</span>{" "}
//               : {consignee.state || "—"}
//               {consignee.stateCode ? `, Code : ${consignee.stateCode}` : ""}
//             </p>
//           </div>

//           <div className="p-2">
//             <p className="text-[9px] font-bold">Buyer (Bill to)</p>
//             <p className="mt-1 text-[11px] font-bold uppercase leading-tight">
//               {buyer.company || buyer.name || "—"}
//             </p>
//             <p className="mt-0.5 whitespace-pre-line text-[9px] leading-3.5">
//               {buyer.address || "—"}
//             </p>
//             <p className="mt-1 text-[9px]">
//               <span className="font-semibold">GSTIN/UIN</span>{" "}
//               : {buyer.gstin || "—"}
//             </p>
//             <p className="text-[9px]">
//               <span className="font-semibold">State Name</span>{" "}
//               : {buyer.state || "—"}
//               {buyer.stateCode ? `, Code : ${buyer.stateCode}` : ""}
//             </p>
//           </div>
//         </div>

//         {/* TERMS OF DELIVERY */}
//         <div className="border border-black border-t-0 px-2 py-1">
//           <p className="text-[9px]">
//             <span className="font-semibold">Terms of Delivery</span>
//             <span className="ml-2">{invoice.termsOfDelivery || "—"}</span>
//           </p>
//         </div>

//         {/* ITEMS TABLE */}
//         <table className="w-full border-collapse border border-black border-t-0">
//           <thead>
//             <tr className="border-b border-black">
//               <th className="w-[6%] border-r border-black px-1 py-1.5 text-center text-[9px] font-bold">
//                 SI<br />No.
//               </th>
//               <th className="w-[32%] border-r border-black px-1 py-1.5 text-left text-[9px] font-bold">
//                 Description of Goods
//               </th>
//               <th className="w-[12%] border-r border-black px-1 py-1.5 text-center text-[9px] font-bold">
//                 HSN/SAC
//               </th>
//               <th className="w-[14%] border-r border-black px-1 py-1.5 text-right text-[9px] font-bold">
//                 Quantity
//               </th>
//               <th className="w-[12%] border-r border-black px-1 py-1.5 text-right text-[9px] font-bold">
//                 Rate
//               </th>
//               <th className="w-[8%] border-r border-black px-1 py-1.5 text-center text-[9px] font-bold">
//                 per
//               </th>
//               <th className="w-[16%] px-1 py-1.5 text-right text-[9px] font-bold">
//                 Amount
//               </th>
//             </tr>
//           </thead>
//           <tbody>
//             {items.map((item, index) => (
//               <tr key={item._id || index} className="border-b border-black">
//                 <td className="border-r border-black px-1 py-2 text-center align-top">
//                   {index + 1}
//                 </td>
//                 <td className="border-r border-black px-1 py-2 align-top">
//                   <p className="font-semibold uppercase">
//                     {item.description || "—"}
//                   </p>
//                 </td>
//                 <td className="border-r border-black px-1 py-2 text-center align-top">
//                   {item.hsnSac || "—"}
//                 </td>
//                 <td className="border-r border-black px-1 py-2 text-right align-top">
//                   {Number(item.quantity || 0).toLocaleString("en-IN")}{" "}
//                   {item.unit || ""}
//                 </td>
//                 <td className="border-r border-black px-1 py-2 text-right align-top">
//                   {formatInvoiceCurrencyNoSymbol(item.rate)}
//                 </td>
//                 <td className="border-r border-black px-1 py-2 text-center align-top">
//                   {item.unit || "kg"}
//                 </td>
//                 <td className="px-1 py-2 text-right align-top font-semibold">
//                   {formatInvoiceCurrencyNoSymbol(item.amount)}
//                 </td>
//               </tr>
//             ))}

//             {/* IGST / CGST+SGST row inside table (classic style) */}
//             {isIGST ? (
//               <tr className="border-b border-black">
//                 <td className="border-r border-black px-1 py-1" />
//                 <td className="border-r border-black px-1 py-1 text-right font-semibold italic">
//                   IGST
//                 </td>
//                 <td className="border-r border-black px-1 py-1" />
//                 <td className="border-r border-black px-1 py-1" />
//                 <td className="border-r border-black px-1 py-1 text-right">
//                   {taxPercent}
//                 </td>
//                 <td className="border-r border-black px-1 py-1 text-center">%</td>
//                 <td className="px-1 py-1 text-right font-semibold">
//                   {formatInvoiceCurrencyNoSymbol(invoice.igstAmount)}
//                 </td>
//               </tr>
//             ) : (
//               <>
//                 <tr className="border-b border-black">
//                   <td className="border-r border-black px-1 py-1" />
//                   <td className="border-r border-black px-1 py-1 text-right font-semibold italic">
//                     CGST
//                   </td>
//                   <td className="border-r border-black px-1 py-1" />
//                   <td className="border-r border-black px-1 py-1" />
//                   <td className="border-r border-black px-1 py-1 text-right">
//                     {invoice.cgstPercent || 9}
//                   </td>
//                   <td className="border-r border-black px-1 py-1 text-center">%</td>
//                   <td className="px-1 py-1 text-right font-semibold">
//                     {formatInvoiceCurrencyNoSymbol(invoice.cgstAmount)}
//                   </td>
//                 </tr>
//                 <tr className="border-b border-black">
//                   <td className="border-r border-black px-1 py-1" />
//                   <td className="border-r border-black px-1 py-1 text-right font-semibold italic">
//                     SGST
//                   </td>
//                   <td className="border-r border-black px-1 py-1" />
//                   <td className="border-r border-black px-1 py-1" />
//                   <td className="border-r border-black px-1 py-1 text-right">
//                     {invoice.sgstPercent || 9}
//                   </td>
//                   <td className="border-r border-black px-1 py-1 text-center">%</td>
//                   <td className="px-1 py-1 text-right font-semibold">
//                     {formatInvoiceCurrencyNoSymbol(invoice.sgstAmount)}
//                   </td>
//                 </tr>
//               </>
//             )}

//             {/* TOTAL row */}
//             <tr className="border-b border-black bg-slate-50">
//               <td className="border-r border-black px-1 py-1.5" />
//               <td className="border-r border-black px-1 py-1.5 text-right font-bold">
//                 Total
//               </td>
//               <td className="border-r border-black px-1 py-1.5" />
//               <td className="border-r border-black px-1 py-1.5 text-right font-semibold">
//                 {items
//                   .reduce((sum, i) => sum + Number(i.quantity || 0), 0)
//                   .toLocaleString("en-IN")}{" "}
//                 {items[0]?.unit || ""}
//               </td>
//               <td className="border-r border-black px-1 py-1.5" />
//               <td className="border-r border-black px-1 py-1.5" />
//               <td className="px-1 py-1.5 text-right text-[11px] font-bold">
//                 ₹ {formatInvoiceCurrencyNoSymbol(invoice.grandTotal)}
//               </td>
//             </tr>
//           </tbody>
//         </table>

//         {/* AMOUNT IN WORDS */}
//         <div className="border border-black border-t-0 px-2 py-1.5">
//           <p className="text-[9px]">
//             <span className="font-semibold">Amount Chargeable (in words)</span>
//           </p>
//           <p className="mt-0.5 text-[10px] font-semibold">
//             {invoice.amountInWords
//               ? `INR ${invoice.amountInWords}`
//               : "Amount in words not available"}
//           </p>
//           <p className="mt-0.5 text-right text-[8px] italic text-slate-500">
//             E. & O.E
//           </p>
//         </div>

//         {/* TAX SUMMARY TABLE (HSN-based) */}
//         <table className="w-full border-collapse border border-black border-t-0">
//           <thead>
//             <tr className="border-b border-black">
//               <th className="border-r border-black px-1 py-1 text-left text-[8px] font-bold">
//                 HSN/SAC
//               </th>
//               <th className="border-r border-black px-1 py-1 text-right text-[8px] font-bold">
//                 Taxable<br />Value
//               </th>
//               {isIGST ? (
//                 <>
//                   <th
//                     colSpan={2}
//                     className="border-r border-black px-1 py-1 text-center text-[8px] font-bold"
//                   >
//                     Integrated Tax
//                   </th>
//                   <th className="px-1 py-1 text-right text-[8px] font-bold">
//                     Total<br />Tax Amount
//                   </th>
//                 </>
//               ) : (
//                 <>
//                   <th
//                     colSpan={2}
//                     className="border-r border-black px-1 py-1 text-center text-[8px] font-bold"
//                   >
//                     Central Tax
//                   </th>
//                   <th
//                     colSpan={2}
//                     className="border-r border-black px-1 py-1 text-center text-[8px] font-bold"
//                   >
//                     State Tax
//                   </th>
//                   <th className="px-1 py-1 text-right text-[8px] font-bold">
//                     Total<br />Tax Amount
//                   </th>
//                 </>
//               )}
//             </tr>
//             <tr className="border-b border-black">
//               <th className="border-r border-black px-1 py-0.5" />
//               <th className="border-r border-black px-1 py-0.5" />
//               {isIGST ? (
//                 <>
//                   <th className="border-r border-black px-1 py-0.5 text-center text-[8px] font-semibold">
//                     Rate
//                   </th>
//                   <th className="border-r border-black px-1 py-0.5 text-right text-[8px] font-semibold">
//                     Amount
//                   </th>
//                   <th className="px-1 py-0.5" />
//                 </>
//               ) : (
//                 <>
//                   <th className="border-r border-black px-1 py-0.5 text-center text-[8px] font-semibold">
//                     Rate
//                   </th>
//                   <th className="border-r border-black px-1 py-0.5 text-right text-[8px] font-semibold">
//                     Amount
//                   </th>
//                   <th className="border-r border-black px-1 py-0.5 text-center text-[8px] font-semibold">
//                     Rate
//                   </th>
//                   <th className="border-r border-black px-1 py-0.5 text-right text-[8px] font-semibold">
//                     Amount
//                   </th>
//                   <th className="px-1 py-0.5" />
//                 </>
//               )}
//             </tr>
//           </thead>
//           <tbody>
//             <tr className="border-b border-black">
//               <td className="border-r border-black px-1 py-1.5 text-[9px]">
//                 {primaryHsn}
//               </td>
//               <td className="border-r border-black px-1 py-1.5 text-right text-[9px]">
//                 {formatInvoiceCurrencyNoSymbol(invoice.taxableAmount)}
//               </td>
//               {isIGST ? (
//                 <>
//                   <td className="border-r border-black px-1 py-1.5 text-center text-[9px]">
//                     {taxPercent}%
//                   </td>
//                   <td className="border-r border-black px-1 py-1.5 text-right text-[9px]">
//                     {formatInvoiceCurrencyNoSymbol(invoice.igstAmount)}
//                   </td>
//                   <td className="px-1 py-1.5 text-right text-[9px] font-semibold">
//                     {formatInvoiceCurrencyNoSymbol(invoice.igstAmount)}
//                   </td>
//                 </>
//               ) : (
//                 <>
//                   <td className="border-r border-black px-1 py-1.5 text-center text-[9px]">
//                     {invoice.cgstPercent || 9}%
//                   </td>
//                   <td className="border-r border-black px-1 py-1.5 text-right text-[9px]">
//                     {formatInvoiceCurrencyNoSymbol(invoice.cgstAmount)}
//                   </td>
//                   <td className="border-r border-black px-1 py-1.5 text-center text-[9px]">
//                     {invoice.sgstPercent || 9}%
//                   </td>
//                   <td className="border-r border-black px-1 py-1.5 text-right text-[9px]">
//                     {formatInvoiceCurrencyNoSymbol(invoice.sgstAmount)}
//                   </td>
//                   <td className="px-1 py-1.5 text-right text-[9px] font-semibold">
//                     {formatInvoiceCurrencyNoSymbol(taxAmount)}
//                   </td>
//                 </>
//               )}
//             </tr>
//             <tr>
//               <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">
//                 Total
//               </td>
//               <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">
//                 {formatInvoiceCurrencyNoSymbol(invoice.taxableAmount)}
//               </td>
//               {isIGST ? (
//                 <>
//                   <td className="border-r border-black px-1 py-1" />
//                   <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">
//                     {formatInvoiceCurrencyNoSymbol(invoice.igstAmount)}
//                   </td>
//                   <td className="px-1 py-1 text-right text-[9px] font-bold">
//                     {formatInvoiceCurrencyNoSymbol(invoice.igstAmount)}
//                   </td>
//                 </>
//               ) : (
//                 <>
//                   <td className="border-r border-black px-1 py-1" />
//                   <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">
//                     {formatInvoiceCurrencyNoSymbol(invoice.cgstAmount)}
//                   </td>
//                   <td className="border-r border-black px-1 py-1" />
//                   <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">
//                     {formatInvoiceCurrencyNoSymbol(invoice.sgstAmount)}
//                   </td>
//                   <td className="px-1 py-1 text-right text-[9px] font-bold">
//                     {formatInvoiceCurrencyNoSymbol(taxAmount)}
//                   </td>
//                 </>
//               )}
//             </tr>
//           </tbody>
//         </table>

//         {/* TAX AMOUNT IN WORDS */}
//         <div className="border border-black border-t-0 px-2 py-1.5">
//           <p className="text-[9px]">
//             <span className="font-semibold">Tax Amount (in words) :</span>{" "}
//             <span className="font-semibold">
//               {invoice.taxAmountInWords
//                 ? `INR ${invoice.taxAmountInWords}`
//                 : "Tax amount in words not available"}
//             </span>
//           </p>
//         </div>

//         {/* DECLARATION + SIGNATURE */}
//         <div className="grid grid-cols-2 border border-black border-t-0">
//           <div className="min-h-[100px] border-r border-black p-2">
//             <p className="text-[9px] font-bold underline">Declaration</p>
//             <p className="mt-1 text-[9px] leading-3.5">
//               {invoice.declaration ||
//                 "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."}
//             </p>
//           </div>

//           <div className="relative min-h-[100px] p-2">
//             <p className="text-right text-[9px] font-semibold">
//               for {seller.name || "CORVEX STEEL WIRES"}
//             </p>
//             <div className="absolute bottom-2 right-2 text-right">
//               <div className="mb-6 h-6" />
//               <p className="text-[9px] font-semibold">
//                 {invoice.authorisedSignatory || "Authorised Signatory"}
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* FOOTER */}
//         <div className="border border-black border-t-0 px-2 py-1.5 text-center">
//           <p className="text-[8px] text-slate-600">
//             This is a Computer Generated Invoice
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }
// function KpiCard({ label, value, description, icon: Icon }) {
//   return (
//     <div className="card">
//       <div className="card-body">
//         <div className="flex items-start justify-between gap-4">
//           <div className="min-w-0">
//             <p className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</p>
//             <p className="mt-2 text-2xl font-bold tracking-tight !text-black">{value}</p>
//             <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{description}</p>
//           </div>
//           <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
//             <Icon size={17} />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// function Skeleton({ width = "w-20", rounded = false }) {
//   return (
//     <div
//       className={`h-4 ${width} animate-pulse bg-slate-100 ${rounded ? "rounded-full" : "rounded"}`}
//     />
//   );
// }

// function SectionHeading({ icon: Icon, title, iconWrapper = "bg-slate-100 text-slate-500" }) {
//   return (
//     <div className="mb-3 flex items-center gap-2">
//       <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconWrapper}`}>
//         <Icon size={14} />
//       </div>
//       <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h3>
//     </div>
//   );
// }

// function DetailRow({ label, value }) {
//   return (
//     <div className="flex items-start justify-between gap-4">
//       <span className="shrink-0 text-[11px] font-medium text-slate-400">{label}</span>
//       <span className="max-w-[65%] text-right text-xs font-semibold leading-5 text-slate-700">
//         {value || "—"}
//       </span>
//     </div>
//   );
// }

// function DetailMetric({ label, value, strong = false }) {
//   return (
//     <div className="min-w-0">
//       <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
//         {label}
//       </span>
//       <span
//         className={`mt-1 block break-words text-xs ${
//           strong ? "font-bold text-slate-800" : "font-semibold text-slate-700"
//         }`}
//       >
//         {value || "—"}
//       </span>
//     </div>
//   );
// }

// function TimelineItem({ title, description, date, active = false }) {
//   return (
//     <div className="relative">
//       <span
//         className={`absolute -left-6 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white ring-1 ${
//           active ? "bg-[#002244] ring-[#002244]/20" : "bg-slate-300 ring-slate-200"
//         }`}
//       />
//       <p className="text-xs font-semibold text-slate-700">{title}</p>
//       <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p>
//       <span className="mt-1.5 block text-[10px] font-medium text-slate-400">{date}</span>
//     </div>
//   );
// }

// export default Orders;

import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, X, Truck, MapPin, FileText, ReceiptText, RefreshCw, Package,
  UserRound, CalendarDays, CreditCard, IndianRupee, Pencil, Trash2,
  Wallet, Receipt, ChevronLeft, ChevronRight,
  CheckCircle2, Clock3, Factory, AlertCircle, Layers, AlertTriangle,
} from "lucide-react";
import logo from "../assets/cswlogo.png";
import { toast } from "react-toastify";

import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  getContacts,
  generateInvoice,
  getOrderInvoice,
  getPaymentsByOrder,
  createPayment,
} from "../api/api";

const ORDER_STATUSES = [
  "Draft",
  "Confirmed",
  "In Production",
  "Ready for Dispatch",
  "Dispatched",
  "Delivered",
  "Cancelled",
];

const PAYMENT_STATUSES = ["Pending", "Partial", "Paid", "Overdue"];

const getReelSpecs = (sizeInput) => {
  const kg = parseFloat(String(sizeInput ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(kg) || kg <= 0) {
    return { kg: 0, spoolKg: 0, steelKg: 0 };
  }

  let spoolKg;
  if (kg <= 2) spoolKg = 0.2;
  else if (kg <= 5) spoolKg = 0.6;
  else spoolKg = 0.7;

  return {
    kg,
    spoolKg,
    steelKg: Math.max(0, kg - spoolKg),
  };
};

const sizeToNumberString = (sizeInput) => {
  const kg = parseFloat(String(sizeInput ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(kg) && kg > 0 ? String(kg) : "";
};

const ORDERS_PER_PAGE = 8;

const emptyItem = () => ({ size: "", quantity: "", rate: "", discount: "0" });

const emptyForm = () => ({
  contact: "",
  enquiry: "",
  items: [emptyItem()],
  discount: "0",
  taxPercent: "18",
  expectedDeliveryDate: "",
  shippingAddress: "",
  billingAddress: "",
  notes: "",
});

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function getContactName(contact) {
  if (!contact) return "Unknown Contact";
  return contact.company || contact.name || contact.email || "Unknown Contact";
}

function getContactPerson(contact) {
  if (!contact) return "—";
  return contact.name || contact.email || "—";
}

function getItemName(item) {
  if (!item) return "Unknown Item";
  return item.productName || (item.size ? `Reel ${item.size}` : "Unknown Item");
}

function getItemsLabel(order) {
  if (!order?.items?.length) return "—";
  if (order.items.length === 1) return getItemName(order.items[0]);
  return `${getItemName(order.items[0])} + ${order.items.length - 1} more`;
}

function getItemsQuantity(order) {
  if (!order?.items?.length) return "—";
  return order.items
    .map(
      (item) =>
        `${Number(item.quantity || 0).toLocaleString("en-IN")} ${item.unit || "Reel"}`
    )
    .join(", ");
}

function getStatusStyles(status) {
  switch (status) {
    case "Delivered":
      return { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 };
    case "Dispatched":
      return { badge: "border-sky-200 bg-sky-50 text-sky-700", icon: Truck };
    case "Ready for Dispatch":
      return { badge: "border-violet-200 bg-violet-50 text-violet-700", icon: Package };
    case "In Production":
      return { badge: "border-amber-200 bg-amber-50 text-amber-700", icon: Factory };
    case "Confirmed":
      return { badge: "border-blue-200 bg-blue-50 text-blue-700", icon: CheckCircle2 };
    case "Cancelled":
      return { badge: "border-rose-200 bg-rose-50 text-rose-700", icon: AlertCircle };
    default:
      return { badge: "border-slate-200 bg-slate-50 text-slate-600", icon: FileText };
  }
}

function getPaymentStyles(payment) {
  switch (payment) {
    case "Paid": return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Partial": return "border-amber-200 bg-amber-50 text-amber-700";
    case "Overdue": return "border-rose-200 bg-rose-50 text-rose-700";
    default: return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function StatusBadge({ status }) {
  const styles = getStatusStyles(status);
  const Icon = styles.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles.badge}`}>
      <Icon size={12} />
      {status || "Draft"}
    </span>
  );
}

function PaymentBadge({ status }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPaymentStyles(status)}`}>
      {status || "Pending"}
    </span>
  );
}

function EmptyOrders({ onNew }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-14 text-center sm:py-16">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Package size={21} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-800">No orders found</h3>
      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
        Try adjusting your search or filters, or create a new purchase order.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#002244] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#00335f]"
      >
        <Plus size={14} /> New Order
      </button>
    </div>
  );
}

function Orders() {
  const [orders, setOrders] = useState([]);
  const [contacts, setContacts] = useState([]);

  const [isReservedConfirmOpen, setIsReservedConfirmOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [reservedConflict, setReservedConflict] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");

  const [viewOrder, setViewOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState(null);
  const [orderPayments, setOrderPayments] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [customerMode, setCustomerMode] = useState("existing"); 
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMode: "UPI",
    paymentDate: new Date().toISOString().split("T")[0],
    paidFrom: "",
    transactionId: "",
    chequeNumber: "",
    bankName: "",
    notes: "",
  });

  /* ---------------- FETCH ---------------- */
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const params = { page, limit: ORDERS_PER_PAGE };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "All") params.status = statusFilter;
      if (paymentFilter !== "All") params.paymentStatus = paymentFilter;

      const response = await getOrders(params);
      const result = response?.data;
      if (!result?.success) throw new Error(result?.message || "Failed to fetch orders");

      setOrders(result.data || []);
      setPages(Math.max(1, result.pages || 1));
      setTotalOrders(result.total || 0);
    } catch (err) {
      console.error("Fetch orders error:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFormData = async () => {
  try {
    const [contactsResponse] = await Promise.all([
      getContacts({ limit: 100 }),
    ]);

    const contactsResult = contactsResponse?.data;

    if (contactsResult?.success) {
      const all = contactsResult.data || [];
      setContacts(all.filter((c) => c.role === "customer"));
    }
  } catch (err) {
    console.error("Fetch order form data error:", err);
  }
};

  useEffect(() => {
    fetchFormData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchOrders(), 300);
    return () => clearTimeout(timer);
  }, [page, search, statusFilter, paymentFilter]);

  /* ---------------- ORDER DETAILS ---------------- */
  const openViewOrder = async (order) => {
    if (!order?._id) return;
    setViewOrder(order);
    setDetailLoading(true);
    setInvoice(null);
    try {
      const [orderResponse, invoiceResponse] = await Promise.all([
        getOrderById(order._id),
        getOrderInvoice(order._id),
      ]);
      if (orderResponse?.data?.success) setViewOrder(orderResponse.data.data);
      if (invoiceResponse?.data?.success) setInvoice(invoiceResponse.data.data);
      else setInvoice(null);
    } catch (err) {
      if (err?.response?.status !== 404) console.error("Fetch order/invoice details error:", err);
      setInvoice(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeViewOrder = () => {
    if (saving) return;
    setViewOrder(null);
  };

  /* ---------------- KPI ---------------- */
  const stats = useMemo(() => {
    const inProcessStatuses = ["Confirmed", "In Production", "Ready for Dispatch"];
    const inProcess = orders.filter((o) => inProcessStatuses.includes(o.status)).length;
    const dispatched = orders.filter((o) => o.status === "Dispatched" || o.status === "Delivered").length;
    const value = orders.reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
    return { total: totalOrders, inProcess, dispatched, value };
  }, [orders, totalOrders]);

  /* ---------------- MODAL ---------------- */
  const openAddModal = () => {
    setEditingOrder(null);
    setForm(emptyForm());
    setCustomerMode("existing");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setModalOpen(true);
  };

  const openEditModal = (order) => {
    if (!order) return;
    setEditingOrder(order);
    setCustomerMode("existing");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setForm({
      contact: order.contact?._id || order.contact || "",
      enquiry: order.enquiry?._id || order.enquiry || "",
      items:
        order.items?.length > 0
          ? order.items.map((i) => ({
              size: i.size || "",
              quantity: i.quantity ?? "",
              rate: i.rate ?? "",
              discount: i.discount ?? "0",
            }))
          : [emptyItem()],
      discount: order.discount ?? "0",
      taxPercent: order.taxPercent ?? "18",
      expectedDeliveryDate: formatDateInput(order.expectedDeliveryDate),
      shippingAddress: order.shippingAddress || "",
      billingAddress: order.billingAddress || "",
      notes: order.notes || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingOrder(null);
    setForm(emptyForm());
    setCustomerMode("existing");
    setNewCustomerName("");
    setNewCustomerPhone("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  /* ---------------- ITEM ROW HANDLERS ---------------- */
  const updateItem = (index, patch) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const addItemRow = () => {
    setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }));
  };

  const removeItemRow = (index) => {
    setForm((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((_, i) => i !== index) : current.items,
    }));
  };

  /* ---------------- PREVIEW ---------------- */
  const previewTotals = useMemo(() => {
    let subTotal = 0;
    for (const item of form.items) {
      const q = Number(item.quantity) || 0;
      const r = Number(item.rate) || 0;
      const d = Number(item.discount) || 0;
      subTotal += Math.max(0, q * r - d);
    }
    const orderDiscount = Number(form.discount) || 0;
    const taxable = Math.max(0, subTotal - orderDiscount);
    const tax = taxable * ((Number(form.taxPercent) || 0) / 100);
    return { subTotal, tax, grandTotal: taxable + tax };
  }, [form.items, form.discount, form.taxPercent]);

  /* ---------------- CREATE / UPDATE ---------------- */
  const validateForm = () => {
    if (customerMode === "existing" && !form.contact) {
      return "Please select a customer.";
    }

    if (customerMode === "new") {
      const name = newCustomerName.trim();
      const phone = newCustomerPhone.trim();

      if (!name) return "Customer name is required.";
      if (name.length < 2) return "Customer name must be at least 2 characters.";

      if (!phone) return "Customer phone is required.";
      if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, ""))) {
        return "Enter a valid 10-digit Indian mobile number (starts with 6–9).";
      }
    }

    const validItems = form.items.filter((it) => it.size);
    if (validItems.length === 0) return "Add at least one item.";

    for (let i = 0; i < form.items.length; i++) {
      const item = form.items[i];
      if (!item.size) continue;
      if (!item.quantity || Number(item.quantity) <= 0) {
        return `Row ${i + 1}: quantity must be > 0.`;
      }
      if (Number(item.rate || 0) < 0) {
        return `Row ${i + 1}: rate cannot be negative.`;
      }
    }
    return null;
  };

  const buildItemsPayload = () =>
    form.items
      .filter((it) => it.size && Number(it.quantity) > 0)
      .map((it) => {
        const specs = getReelSpecs(it.size);
        return {
          size: it.size,
          quantity: Number(it.quantity),
          rate: Number(it.rate || 0),
          discount: Number(it.discount || 0),
          spoolKg: specs.spoolKg,
          steelKg: specs.steelKg,
        };
      });

  const handleCreate = async () => {
    const err = validateForm();
    if (err) { toast.error(err); return; }

    try {
      setSaving(true);
      const payload = {
        items: buildItemsPayload(),
        discount: Number(form.discount || 0),
        taxPercent: Number(form.taxPercent || 18),
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        shippingAddress: form.shippingAddress.trim(),
        billingAddress: form.billingAddress.trim(),
        notes: form.notes.trim(),
      };
      if (form.enquiry.trim()) payload.enquiry = form.enquiry.trim();

      if (customerMode === "existing") {
        payload.contact = form.contact;
      } else {
        payload.customerName = newCustomerName.trim();
        payload.customerPhone = newCustomerPhone.trim();
      }

      const response = await createOrder(payload);
      if (!response?.data?.success) throw new Error(response?.data?.message || "Failed to create order");

      const createdOrder = response.data.data;
      toast.success(`Order ${createdOrder.orderNumber} created`);
      closeModal();
      await fetchOrders();
      if (createdOrder?._id) await openViewOrder(createdOrder);
    } catch (err) {
      console.error("Create order error:", err);
      toast.error(err?.response?.data?.message || err?.message || "Failed to create order.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingOrder?._id) return;
    try {
      setSaving(true);

      // Only Draft orders can send items
      const isDraft = editingOrder.status === "Draft";
      const payload = {
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        shippingAddress: form.shippingAddress.trim(),
        billingAddress: form.billingAddress.trim(),
        notes: form.notes.trim(),
        discount: Number(form.discount || 0),
        taxPercent: Number(form.taxPercent || 18),
      };

      if (isDraft) {
        const err = validateForm();
        if (err) { alert(err); setSaving(false); return; }
        payload.items = buildItemsPayload();
      }

      const response = await updateOrder(editingOrder._id, payload);
      if (!response?.data?.success) throw new Error(response?.data?.message || "Failed to update order");

      const updatedOrder = response.data.data;
      toast.success(`Order ${updatedOrder.orderNumber} updated`);
      closeModal();
      await fetchOrders();
      if (updatedOrder?._id) await openViewOrder(updatedOrder);
    } catch (err) {
      console.error("Update order error:", err);
      toast.error(err?.response?.data?.message || err?.message || "Failed to update order.");
    } finally {
      setSaving(false);
    }
  };

  const openConfirm = ({ title, message, confirmLabel = "Confirm", confirmTone = "primary", onConfirm }) => {
    setConfirmDialog({ title, message, confirmLabel, confirmTone, onConfirm });
  };

  const closeConfirm = () => setConfirmDialog(null);

  const performStatusChange = async (order, newStatus, extra = {}) => {
    try {
      const response = await updateOrderStatus(order._id, {
        status: newStatus,
        ...extra,
      });
      if (!response?.data?.success) {
        throw new Error(response?.data?.message || "Failed to update order status");
      }
      const updatedOrder = response.data.data;
      setOrders((current) =>
        current.map((item) =>
          item._id === order._id ? { ...item, ...updatedOrder, status: newStatus } : item
        )
      );
      setViewOrder((current) =>
        current?._id === order._id ? { ...current, ...updatedOrder, status: newStatus } : current
      );
      toast.success(`Order ${order.orderNumber} marked as ${newStatus}`);
    } catch (err) {
      const body = err?.response?.data ?? err;

      if (body?.code === "RESERVED_CONFLICT" && body?.data) {
        setReservedConflict(body.data);
        setPendingOrder({ order, newStatus });
        setIsReservedConfirmOpen(true);
        return;
      }

      console.error("Update status error:", err);
      toast.error(body?.message || err?.message || "Failed to update order status.");
    }
  };

  const handleStatusChange = (order, newStatus) => {
    if (!order?._id || !newStatus || newStatus === order.status) return;

    const meta = {
      Confirmed: {
        title: "Confirm this order?",
        body:
          "Confirming will deduct stock from inventory. If the deduction dips into reserved stock, you'll be prompted to approve that separately.",
        confirmLabel: "Yes, Confirm Order",
        confirmTone: "primary",
      },
      Dispatched: {
        title: "Mark as dispatched?",
        body: "This updates the order status to Dispatched. Stock was already deducted at confirmation.",
        confirmLabel: "Yes, Mark Dispatched",
        confirmTone: "sky",
      },
      Delivered: {
        title: "Mark as delivered?",
        body: "Confirm delivery to close this order out.",
        confirmLabel: "Yes, Mark Delivered",
        confirmTone: "emerald",
      },
      Cancelled: {
        title: "Cancel this order?",
        body: "Cancelling will restore any deducted stock back to inventory. This cannot be undone.",
        confirmLabel: "Yes, Cancel Order",
        confirmTone: "danger",
      },
    }[newStatus] || {
      title: `Change status to "${newStatus}"?`,
      body: "Are you sure you want to proceed?",
      confirmLabel: "Confirm",
      confirmTone: "primary",
    };

    openConfirm({
      ...meta,
      onConfirm: () => performStatusChange(order, newStatus),
    });
  };

  const handleReservedConfirm = async () => {
    if (!pendingOrder) return;
    const { order, newStatus } = pendingOrder;

    try {
      setSaving(true);
      await performStatusChange(order, newStatus, { allowReserved: true });
      setIsReservedConfirmOpen(false);
      setReservedConflict(null);
      setPendingOrder(null);
    } catch (err) {
      setIsReservedConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleReservedCancel = () => {
    setIsReservedConfirmOpen(false);
    setReservedConflict(null);
    setPendingOrder(null);
  };

  const handleDelete = (order) => {
    if (!order?._id) return;
    if (!["Draft", "Cancelled"].includes(order.status)) {
      toast.warn("Only Draft or Cancelled orders can be deleted.");
      return;
    }
    openConfirm({
      title: `Delete ${order.orderNumber}?`,
      message: "This action cannot be undone.",
      confirmLabel: "Yes, Delete",
      confirmTone: "danger",
      onConfirm: async () => {
        try {
          setDeleting(true);
          const response = await deleteOrder(order._id);
          if (!response?.data?.success) {
            throw new Error(response?.data?.message || "Failed to delete order");
          }
          toast.success(`Order ${order.orderNumber} deleted`);
          setViewOrder(null);
          await fetchOrders();
        } catch (err) {
          toast.error(err?.response?.data?.message || "Failed to delete order");
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleRefresh = () => fetchOrders();

  const handleGenerateInvoice = async (order) => {
    if (!order?._id) return;
    try {
      setInvoiceLoading(true);
      setError("");
      const response = await generateInvoice(order._id);
      if (!response?.data?.success) throw new Error(response?.data?.message || "Failed to generate invoice");
      setInvoice(response.data.data);
      setInvoiceOpen(true);
    } catch (err) {
      console.error("Generate invoice error:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to generate invoice.");
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handlePaymentStatusClick = async (order) => {
    if (!order?._id) return;
    try {
      setPaymentLoading(true);
      const response = await getPaymentsByOrder(order._id);
      const data = response.data;
      setSelectedPaymentOrder({ ...order, ...(data.order || {}) });
      setOrderPayments(data.data || []);
      setPaymentModalOpen(true);
    } catch (error) {
      console.error("Failed to fetch payments:", error);
      toast.error(error?.response?.data?.message || "Failed to load payment details");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePaymentFormChange = (e) => {
    const { name, value } = e.target;
    setPaymentForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!selectedPaymentOrder?._id) return;
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) { toast.warn("Please enter a valid payment amount."); return; }

    const remaining =
      Number(selectedPaymentOrder.grandTotal || 0) - Number(selectedPaymentOrder.amountPaid || 0);
    if (amount > remaining) {
      toast.warn(`Payment cannot exceed the remaining amount of ₹${remaining.toLocaleString("en-IN")}.`);
      return;
    }

    try {
      setPaymentSubmitting(true);
      await createPayment({
        order: selectedPaymentOrder._id,
        contact: selectedPaymentOrder.contact?._id || selectedPaymentOrder.contact,
        amount,
        paymentMode: paymentForm.paymentMode,
        paymentDate: paymentForm.paymentDate,
        paidFrom: paymentForm.paidFrom,
        transactionId: paymentForm.transactionId,
        chequeNumber: paymentForm.chequeNumber,
        bankName: paymentForm.bankName,
        notes: paymentForm.notes,
      });

      const response = await getPaymentsByOrder(selectedPaymentOrder._id);
      const data = response.data;
      setSelectedPaymentOrder((prev) => ({ ...prev, ...(data.order || {}) }));
      setOrderPayments(data.data || []);
      setAddPaymentModalOpen(false);
      setPaymentForm({
        amount: "",
        paymentMode: "UPI",
        paymentDate: new Date().toISOString().split("T")[0],
        paidFrom: "",
        transactionId: "",
        chequeNumber: "",
        bankName: "",
        notes: "",
      });

      toast.success(`Payment of ₹${amount.toLocaleString("en-IN")} recorded`);

      fetchOrders();
    } catch (error) {
      console.error("Failed to create payment:", error);
      toast.error(error?.response?.data?.message || "Failed to add payment.");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  /* ---------------- PRIMARY ACTION BUTTON ---------------- */
  const renderPrimaryAction = (order) => {
    if (!order) return null;
    const s = order.status;

    if (s === "Draft") {
      return (
        <button
          type="button"
          onClick={() => handleStatusChange(order, "Confirmed")}
          className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#002244] px-3 text-xs font-semibold text-white transition hover:bg-[#00335f] sm:h-9"
        >
          <CheckCircle2 size={13} /> Confirm Order
        </button>
      );
    }
    if (s === "Confirmed" || s === "In Production") {
      return (
        <button
          type="button"
          onClick={() => handleStatusChange(order, "Ready for Dispatch")}
          className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#002244] px-3 text-xs font-semibold text-white transition hover:bg-[#00335f] sm:h-9"
        >
          <Package size={13} /> Ready for Dispatch
        </button>
      );
    }
    if (s === "Ready for Dispatch") {
      return (
        <button
          type="button"
          onClick={() => handleStatusChange(order, "Dispatched")}
          className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-700 sm:h-9"
        >
          <Truck size={13} /> Dispatch Order
        </button>
      );
    }
    if (s === "Dispatched") {
      return (
        <button
          type="button"
          onClick={() => handleStatusChange(order, "Delivered")}
          className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 sm:h-9"
        >
          <CheckCircle2 size={13} /> Mark Delivered
        </button>
      );
    }
    return null;
  };

  const sheetOverlay = "fixed inset-0 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm sm:items-center sm:p-4";
  const sheetPanel =
    "flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl";

  const payLabelCls = "mb-2 block text-sm font-medium text-slate-700";
  const payFieldCls =
    "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm";

  const filterSelectCls =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-600 outline-none transition hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:w-auto sm:text-sm";

  return (
    <div className="min-h-full min-w-0 space-y-4 pb-6 sm:space-y-5">
      {/* PAGE HEADER */}
      <section className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage customer purchase orders, production and fulfilment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#002244] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00335f] hover:shadow-md sm:flex-none"
          >
            <Plus size={16} />
            New Order
          </button>
        </div>
      </section>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Unable to load orders</p>
            <p className="mt-0.5 break-words text-rose-600">{error}</p>
          </div>
        </div>
      )}

      {/* KPIs — 2 per row on phones, 4 on xl */}
      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <KpiCard label="Total Orders" value={stats.total} description="Active purchase orders" icon={FileText} />
        <KpiCard label="In Process" value={stats.inProcess} description="Active production" icon={Factory} />
        <KpiCard label="Dispatched" value={stats.dispatched} description="Current page" icon={Truck} />
        <KpiCard label="Order Value" value={formatCurrency(stats.value)} description="Loaded orders" icon={IndianRupee} />
      </section>

      {/* FILTERS */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Search by order number, customer or phone..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100 sm:text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select
              value={statusFilter}
              onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
              className={filterSelectCls}
            >
              <option value="All">All Status</option>
              {ORDER_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
            <select
              value={paymentFilter}
              onChange={(e) => { setPage(1); setPaymentFilter(e.target.value); }}
              className={filterSelectCls}
            >
              <option value="All">All Payments</option>
              {PAYMENT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
        </div>
      </section>

      {/* ORDERS LIST */}
      <section className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Manufacturing &amp; Dispatch Log</h2>
            <p className="mt-1 text-xs text-slate-500">Purchase orders and current fulfilment status.</p>
          </div>
          <div className="text-xs font-medium text-slate-400">
            {loading ? "Updating..." : `${orders.length} shown`}
          </div>
        </div>

        {/* ---- Phones: card list ---- */}
        <div className="md:hidden">
          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2.5 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <Skeleton width="w-24" />
                    <Skeleton width="w-20" rounded />
                  </div>
                  <Skeleton width="w-40" />
                  <Skeleton width="w-28" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <EmptyOrders onNew={openAddModal} />
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map((order) => (
                <div
                  key={order._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openViewOrder(order)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openViewOrder(order);
                    }
                  }}
                  className="cursor-pointer px-4 py-3.5 transition active:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-[#002244]">{order.orderNumber}</span>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <CalendarDays size={11} />
                        {formatDate(order.orderDate)}
                      </div>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="mt-3 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <UserRound size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{getContactName(order.contact)}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">{getContactPerson(order.contact)}</p>
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <p className="truncate text-sm font-medium text-slate-700">{getItemsLabel(order)}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{getItemsQuantity(order)}</p>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{formatCurrency(order.grandTotal)}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {order.amountPaid ? `${formatCurrency(order.amountPaid)} paid` : "No payment"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={paymentLoading}
                      onClick={(e) => { e.stopPropagation(); handlePaymentStatusClick(order); }}
                      className="shrink-0 rounded-full transition active:scale-95 disabled:cursor-wait disabled:opacity-60"
                    >
                      <PaymentBadge status={order.paymentStatus} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- Tablet / desktop: table ---- */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Order</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Items / Qty</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Value</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: ORDERS_PER_PAGE }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-5 py-4"><Skeleton width="w-24" /><Skeleton width="w-16" /></td>
                    <td className="px-4 py-4"><Skeleton width="w-28" /><Skeleton width="w-20" /></td>
                    <td className="px-4 py-4"><Skeleton width="w-32" /><Skeleton width="w-20" /></td>
                    <td className="px-4 py-4"><Skeleton width="w-20" /></td>
                    <td className="px-4 py-4"><Skeleton width="w-16" rounded /></td>
                    <td className="px-5 py-4"><Skeleton width="w-24" rounded /></td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <EmptyOrders onNew={openAddModal} />
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order._id}
                    onClick={() => openViewOrder(order)}
                    className="group cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-bold text-[#002244]">{order.orderNumber}</span>
                      <div className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-400">
                        <CalendarDays size={11} />
                        {formatDate(order.orderDate)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                          <UserRound size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[180px] truncate text-sm font-semibold text-slate-800">{getContactName(order.contact)}</p>
                          <p className="mt-0.5 max-w-[180px] truncate text-xs text-slate-400">{getContactPerson(order.contact)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="max-w-[220px] truncate text-sm font-medium text-slate-700">{getItemsLabel(order)}</p>
                      <p className="mt-1 max-w-[220px] truncate text-xs text-slate-400">{getItemsQuantity(order)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="whitespace-nowrap text-sm font-semibold text-slate-800">{formatCurrency(order.grandTotal)}</p>
                      <p className="mt-1 whitespace-nowrap text-[11px] text-slate-400">
                        {order.amountPaid ? `${formatCurrency(order.amountPaid)} paid` : "No payment"}
                      </p>
                    </td>
                    <td
                      className="px-4 py-4"
                      onClick={(e) => { e.stopPropagation(); handlePaymentStatusClick(order); }}
                    >
                      <button
                        type="button"
                        className="cursor-pointer rounded-full transition hover:scale-[1.02] disabled:cursor-wait disabled:opacity-60"
                        disabled={paymentLoading}
                      >
                        <PaymentBadge status={order.paymentStatus} />
                      </button>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={order.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-center text-xs text-slate-400 sm:text-left">
            Showing{" "}
            <span className="font-semibold text-slate-600">
              {totalOrders === 0 ? 0 : (page - 1) * ORDERS_PER_PAGE + 1}
            </span>{" "}
            to <span className="font-semibold text-slate-600">{Math.min(page * ORDERS_PER_PAGE, totalOrders)}</span> of{" "}
            <span className="font-semibold text-slate-600">{totalOrders}</span> purchase orders
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((c) => c - 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:px-2.5"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <div className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#002244] px-2 text-xs font-semibold text-white sm:h-8 sm:min-w-8">
              {page}
            </div>
            <button
              type="button"
              disabled={page >= pages || loading}
              onClick={() => setPage((c) => c + 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:px-2.5"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================
          ORDER DETAILS MODAL
      ===================================================== */}
      {viewOrder && (
        <div className={`${sheetOverlay} z-[100]`} onClick={closeViewOrder}>
          <div
            className={`${sheetPanel} sm:max-w-3xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#002244]">{viewOrder.orderNumber}</span>
                  <StatusBadge status={viewOrder.status} />
                  <PaymentBadge status={viewOrder.paymentStatus} />
                </div>
                <h2 className="mt-3 text-lg font-bold tracking-tight text-slate-900">Order Details</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Created {formatDate(viewOrder.orderDate)}
                  <span className="mx-1.5 text-slate-300">•</span>
                  Expected {formatDate(viewOrder.expectedDeliveryDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeViewOrder}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
              {detailLoading && (
                <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-500 shadow-sm sm:right-5 sm:top-5">
                  <RefreshCw size={13} className="animate-spin" /> Loading details...
                </div>
              )}

              <div className="space-y-6">
                {/* PURCHASER */}
                <div>
                  <SectionHeading icon={UserRound} title="Purchaser Information" />
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="break-words text-sm font-bold text-slate-800">{getContactName(viewOrder.contact)}</p>
                    <p className="mt-1 break-words text-xs text-slate-500">{getContactPerson(viewOrder.contact)}</p>
                    <div className="mt-3 grid grid-cols-1 gap-2.5 border-t border-slate-200/70 pt-3 sm:grid-cols-2">
                      <DetailRow label="Contact Person" value={viewOrder.contact?.name} />
                      <DetailRow label="Role" value={viewOrder.contact?.role} />
                      <DetailRow label="Phone" value={viewOrder.contact?.phone} />
                      <DetailRow label="Email" value={viewOrder.contact?.email} />
                      <DetailRow label="GSTIN" value={viewOrder.contact?.gstin} />
                      <DetailRow
                        label="State"
                        value={
                          viewOrder.contact?.state
                            ? `${viewOrder.contact.state}${viewOrder.contact?.stateCode ? ` (${viewOrder.contact.stateCode})` : ""}`
                            : "—"
                        }
                      />
                      <div className="sm:col-span-2">
                        <DetailRow
                          label="Address"
                          value={
                            viewOrder.contact?.billingAddress ||
                            viewOrder.contact?.address
                          }
                        />
                      </div>
                      {viewOrder.enquiry && (
                        <DetailRow
                          label="Enquiry"
                          value={viewOrder.enquiry?.enquiryNumber || viewOrder.enquiry}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* ITEMS */}
                <div>
                  <SectionHeading icon={Package} title="Consignment Specification" />
                  <div className="space-y-3">
                    {viewOrder.items?.map((item, index) => (
                      <div key={item._id || index} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3 sm:gap-4">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold text-slate-800">{getItemName(item)}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {item.size ? `Reel ${item.size}` : `Item ${index + 1}`}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                            {Number(item.quantity || 0).toLocaleString("en-IN")} {item.unit || "Reel"}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-slate-100 pt-3.5 sm:grid-cols-3">
                          <DetailMetric label="Rate / Unit" value={formatCurrency(item.rate)} />
                          <DetailMetric label="Item Discount" value={formatCurrency(item.discount)} />
                          <DetailMetric label="Line Amount" value={formatCurrency(item.amount)} strong />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="space-y-2.5">
                      <DetailRow label="Subtotal" value={formatCurrency(viewOrder.subTotal)} />
                      <DetailRow label="Overall Discount" value={formatCurrency(viewOrder.discount)} />
                      <DetailRow label={`Tax (${viewOrder.taxPercent || 0}%)`} value={formatCurrency(viewOrder.taxAmount)} />
                      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                        <span className="text-sm font-bold text-slate-700">Grand Total</span>
                        <span className="text-base font-bold text-[#002244]">{formatCurrency(viewOrder.grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FINANCIAL */}
                <div>
                  <SectionHeading icon={CreditCard} title="Financial / Ledger" iconWrapper="bg-emerald-50 text-emerald-600" />
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <DetailMetric label="Order Value" value={formatCurrency(viewOrder.grandTotal)} strong />
                      <DetailMetric label="Amount Paid" value={formatCurrency(viewOrder.amountPaid)} strong />
                      <DetailMetric
                        label="Balance Due"
                        value={formatCurrency(
                          Math.max(0, Number(viewOrder.grandTotal || 0) - Number(viewOrder.amountPaid || 0))
                        )}
                        strong
                      />
                    </div>
                    <div className="mt-4 border-t border-slate-200/70 pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-medium text-slate-400">Payment Status</span>
                        <PaymentBadge status={viewOrder.paymentStatus} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* LOGISTICS */}
                <div>
                  <SectionHeading icon={MapPin} title="Logistics &amp; Site Address" iconWrapper="bg-sky-50 text-sky-600" />
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex items-start gap-2.5">
                      <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Shipping Address
                        </p>
                        <p className="mt-1 break-words text-xs leading-5 text-slate-600">
                          {viewOrder.shippingAddress || "No shipping address provided."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 sm:grid-cols-2">
                      <DetailMetric label="Billing Address" value={viewOrder.billingAddress || "Same / not provided"} />
                      <DetailMetric label="Expected Delivery" value={formatDate(viewOrder.expectedDeliveryDate)} />
                      {viewOrder.dispatchedDate && (
                        <DetailMetric label="Dispatched" value={formatDate(viewOrder.dispatchedDate)} />
                      )}
                      {viewOrder.deliveredDate && (
                        <DetailMetric label="Delivered" value={formatDate(viewOrder.deliveredDate)} />
                      )}
                    </div>
                  </div>
                </div>

                {viewOrder.notes && (
                  <div>
                    <SectionHeading icon={FileText} title="Notes" />
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <p className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{viewOrder.notes}</p>
                    </div>
                  </div>
                )}

                {/* STATUS */}
                <div>
                  <SectionHeading icon={Clock3} title="Order Status" />
                  <select
                    value={viewOrder.status || "Draft"}
                    onChange={(e) => handleStatusChange(viewOrder, e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:text-sm"
                  >
                    {ORDER_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>

                {/* TIMELINE */}
                <div>
                  <SectionHeading icon={Clock3} title="Audit &amp; Dispatch Timeline" />
                  <div className="relative space-y-5 pl-6">
                    <span className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200" />

                    {viewOrder.stockDeductedAt && (
                      <TimelineItem
                        title="Stock deducted"
                        description="Quantities deducted from ProductStock."
                        date={formatDate(viewOrder.stockDeductedAt)}
                        active
                      />
                    )}
                    {viewOrder.dispatchedDate && (
                      <TimelineItem
                        title="Order dispatched"
                        description="Order left the warehouse."
                        date={formatDate(viewOrder.dispatchedDate)}
                        active
                      />
                    )}

                    {viewOrder.deliveredDate && (
                      <TimelineItem
                        title="Order delivered"
                        description="Delivery confirmed."
                        date={formatDate(viewOrder.deliveredDate)}
                        active
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => openEditModal(viewOrder)}
                  disabled={
                    viewOrder.status !== "Draft" && viewOrder.status !== "Confirmed"
                  }
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9"
                >
                  <Pencil size={13} /> Edit
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (invoice) setInvoiceOpen(true);
                    else handleGenerateInvoice(viewOrder);
                  }}
                  disabled={invoiceLoading || ["Draft", "Cancelled"].includes(viewOrder.status)}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9"
                >
                  {invoiceLoading ? <RefreshCw size={13} className="animate-spin" /> : <ReceiptText size={13} />}
                  {invoiceLoading ? "Loading..." : invoice ? "View Invoice" : "Generate Invoice"}
                </button>

                {renderPrimaryAction(viewOrder)}

                {["Draft", "Cancelled"].includes(viewOrder.status) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(viewOrder)}
                    disabled={deleting}
                    className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-4 sm:h-9"
                  >
                    <Trash2 size={13} />
                    {deleting ? "Deleting..." : "Delete Order"}
                  </button>
                )}

                {!["Draft", "Delivered", "Cancelled"].includes(viewOrder.status) && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(viewOrder, "Cancelled")}
                    className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 sm:col-span-4 sm:h-9"
                  >
                    <AlertCircle size={13} /> Cancel Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          CREATE / EDIT ORDER MODAL
      ===================================================== */}
      {modalOpen && (() => {
        const isEdit = Boolean(editingOrder);
        const itemsLocked = isEdit && editingOrder.status !== "Draft";
        const selectedContact =
          contacts.find((c) => c._id === form.contact) ||
          (isEdit && typeof editingOrder.contact === "object" ? editingOrder.contact : null);
        const filledItems = form.items.filter((it) => it.size);
        const orderDiscount = Number(form.discount) || 0;

        const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
        const fieldCls =
          "h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-base text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm";
        const areaCls =
          "w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-base leading-5 text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/15 sm:text-sm";

        return (
          <div
            className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4"
            onClick={closeModal}
          >
            <style>{`
              @keyframes om-rise {
                from { opacity: 0; transform: translateY(12px) scale(0.98); }
                to   { opacity: 1; transform: none; }
              }
              @media (prefers-reduced-motion: reduce) { .om-rise { animation: none !important; } }
            `}</style>

            <div
              className="om-rise flex max-h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
              style={{ animation: "om-rise 0.18s ease-out" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ========== HEADER ========== */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4">
                <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0f172a]">
                    {isEdit ? <Pencil size={18} className="text-white" /> : <Layers size={18} className="text-white" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                      {isEdit ? `Edit ${editingOrder.orderNumber}` : "New purchase order"}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {isEdit
                        ? `${getContactName(editingOrder.contact)} · ${editingOrder.status}`
                        : "Select customer, add reels, then save as draft"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* ========== BODY ==========
                  Phones/tablets: the whole body scrolls (form, then summary).
                  lg+: two columns, each scrolls independently. */}
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
                {/* LEFT – FORM */}
                <div className="min-w-0 flex-1 p-4 sm:p-6 lg:overflow-y-auto">
                  <div className="space-y-6">

                    {/* —— CUSTOMER —— */}
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <UserRound size={15} className="text-[#0f172a]" />
                        <h4 className="text-sm font-semibold text-slate-900">Customer</h4>
                      </div>

                      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 sm:p-4 md:grid-cols-2">

                        {/* Mode toggle — hidden when editing */}
                        {!isEdit && (
                          <div className="md:col-span-2">
                            <div className="grid w-full grid-cols-2 rounded-lg border border-slate-200 bg-white p-0.5 sm:inline-flex sm:w-auto">
                              <button
                                type="button"
                                onClick={() => setCustomerMode("existing")}
                                className={`rounded-md px-3.5 py-2 text-xs font-semibold transition sm:py-1.5 ${
                                  customerMode === "existing"
                                    ? "bg-[#0f172a] text-white"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                              >
                                Existing Customer
                              </button>
                              <button
                                type="button"
                                onClick={() => setCustomerMode("new")}
                                className={`rounded-md px-3.5 py-2 text-xs font-semibold transition sm:py-1.5 ${
                                  customerMode === "new"
                                    ? "bg-[#0f172a] text-white"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                              >
                                New Customer
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Existing → dropdown */}
                        {!isEdit && customerMode === "existing" && (
                          <div className="md:col-span-2">
                            <label className={labelCls}>
                              Customer <span className="text-rose-500">*</span>
                            </label>
                            <select
                              className={fieldCls}
                              name="contact"
                              value={form.contact}
                              onChange={(e) => {
                                const contactId = e.target.value;
                                  const picked = contacts.find((c) => c._id === contactId);
                                  setForm((current) => ({
                                    ...current,
                                    contact: contactId,
                                    shippingAddress:
                                      picked?.shippingAddress || picked?.address || current.shippingAddress || "",
                                    billingAddress:
                                      picked?.billingAddress || picked?.address || current.billingAddress || "",
                                }));
                              }}
                            >
                              <option value="">Select a customer</option>
                              {contacts.map((c) => (
                                <option key={c._id} value={c._id}>
                                  {getContactName(c)}
                                  {c.name && c.company ? ` — ${c.name}` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* New → name + phone */}
                        {!isEdit && customerMode === "new" && (
                          <>
                            <div>
                              <label className={labelCls}>
                                Customer name <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                className={fieldCls}
                                value={newCustomerName}
                                onChange={(e) => setNewCustomerName(e.target.value)}
                                placeholder="e.g. Ramesh Kumar"
                              />
                            </div>
                            <div>
                              <label className={labelCls}>
                                Phone number <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="tel"
                                inputMode="numeric"
                                maxLength={10}
                                className={fieldCls}
                                value={newCustomerPhone}
                                onChange={(e) => {
                                  // Digits only, max 10
                                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                                  setNewCustomerPhone(digits);
                                }}
                                placeholder="10-digit mobile e.g. 9876543210"
                              />
                              {newCustomerPhone && !/^[6-9]\d{9}$/.test(newCustomerPhone) && (
                                <p className="mt-1 text-[11px] font-medium text-rose-600">
                                  Enter a valid 10-digit number starting with 6–9
                                </p>
                              )}
                            </div>
                            <p className="md:col-span-2 -mt-1 text-[11px] text-slate-500">
                              A new contact will be created automatically. You can fill in company, email, and GSTIN later from the Contacts page.
                            </p>
                          </>
                        )}

                        {/* Expected delivery */}
                        <div className={isEdit || customerMode === "new" ? "md:col-span-2" : ""}>
                          <label className={labelCls}>
                            Expected delivery{" "}
                            <span className="font-normal normal-case tracking-normal text-slate-400">
                              (optional)
                            </span>
                          </label>
                          <div className="relative">
                            <CalendarDays
                              size={15}
                              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                              className={`${fieldCls} pl-10`}
                              type="date"
                              name="expectedDeliveryDate"
                              value={form.expectedDeliveryDate}
                              onChange={handleChange}
                            />
                          </div>
                        </div>

                        {/* Selected contact preview — only in existing mode */}
                        {customerMode === "existing" && selectedContact && (
                          <div className="md:col-span-2">
                            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0f172a] text-xs font-bold text-white">
                                {getContactName(selectedContact).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {getContactName(selectedContact)}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {[getContactPerson(selectedContact), selectedContact.phone]
                                    .filter((v) => v && v !== "—")
                                    .join("  ·  ")}
                                </p>
                              </div>
                              <div className="hidden flex-wrap gap-1.5 sm:flex">
                                {selectedContact.gstin && (
                                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                                    {selectedContact.gstin}
                                  </span>
                                )}
                                {selectedContact.state && (
                                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                                    {selectedContact.state}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* —— REELS —— */}
                    <section>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Layers size={15} className="text-[#0f172a]" />
                          <h4 className="text-sm font-semibold text-slate-900">Reels</h4>
                        </div>
                        {!itemsLocked && (
                          <button
                            type="button"
                            onClick={addItemRow}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-[#0f172a] hover:text-[#0f172a] sm:py-1.5"
                          >
                            <Plus size={14} /> Add reel
                          </button>
                        )}
                      </div>

                      {itemsLocked && (
                        <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                          <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                          <p className="text-xs leading-5 text-amber-800">
                            This order is <strong>{editingOrder.status}</strong>. Items are locked. Cancel the order to change them.
                          </p>
                        </div>
                      )}

                      <div className="space-y-3">
                        {form.items.map((item, i) => {
                          const rowAmount = Math.max(
                            0,
                            Number(item.quantity || 0) * Number(item.rate || 0) - Number(item.discount || 0)
                          );
                          return (
                            <div
                              key={i}
                              className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4"
                            >
                              {/* header row */}
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-slate-800">
                                  {item.size ? `${item.size} reel` : `Reel ${i + 1}`}
                                </span>
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <span className="text-sm font-bold tabular-nums text-slate-900">
                                    {formatCurrency(rowAmount)}
                                  </span>
                                  {!itemsLocked && (
                                    <button
                                      type="button"
                                      onClick={() => removeItemRow(i)}
                                      disabled={form.items.length === 1}
                                      className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 sm:h-7 sm:w-7"
                                      title="Remove"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* size input + auto-detected spool weight */}
                              <div className="mb-3">
                                <label className={labelCls}>Reel size (kg)</label>

                                <div className="flex items-center gap-2">
                                  <div className="relative flex-1">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      step="0.5"
                                      disabled={itemsLocked}
                                      value={sizeToNumberString(item.size)}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        updateItem(i, { size: v ? `${v}kg` : "" });
                                      }}
                                      placeholder="e.g. 5"
                                      className={fieldCls}
                                    />
                                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                                      kg
                                    </span>
                                  </div>
                                </div>

                                {/* auto-detected specs */}
                                {item.size &&
                                  (() => {
                                    const specs = getReelSpecs(item.size);
                                    if (!specs.kg) return null;
                                    return (
                                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
                                        <span className="text-slate-500">
                                          Spool weight
                                          <span className="ml-1 font-bold text-slate-800">
                                            {specs.spoolKg} kg
                                          </span>
                                        </span>
                                        <span className="text-slate-300">·</span>
                                        <span className="text-slate-500">
                                          Steel content
                                          <span className="ml-1 font-bold text-slate-800">
                                            {specs.steelKg.toFixed(2)} kg
                                          </span>
                                        </span>
                                      </div>
                                    );
                                  })()}
                              </div>

                              {/* qty / rate / discount — 2 cols on phones, 3 from sm */}
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <div>
                                  <label className={labelCls}>Qty</label>
                                  <input
                                    className={fieldCls}
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    step="1"
                                    disabled={itemsLocked}
                                    value={item.quantity}
                                    onChange={(e) => updateItem(i, { quantity: e.target.value })}
                                    placeholder="0"
                                  />
                                </div>
                                <div>
                                  <label className={labelCls}>Rate (₹)</label>
                                  <input
                                    className={fieldCls}
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.01"
                                    disabled={itemsLocked}
                                    value={item.rate}
                                    onChange={(e) => updateItem(i, { rate: e.target.value })}
                                    placeholder="0.00"
                                  />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                  <label className={labelCls}>Discount (₹)</label>
                                  <input
                                    className={fieldCls}
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.01"
                                    disabled={itemsLocked}
                                    value={item.discount}
                                    onChange={(e) => updateItem(i, { discount: e.target.value })}
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {/* —— ADDRESSES —— */}
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <MapPin size={15} className="text-[#0f172a]" />
                        <h4 className="text-sm font-semibold text-slate-900">Addresses</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className={labelCls}>Shipping address</label>
                          <textarea
                            className={areaCls}
                            name="shippingAddress"
                            value={form.shippingAddress}
                            onChange={handleChange}
                            placeholder="Delivery address"
                            rows="3"
                          />
                        </div>
                        <div>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <label className={labelCls + " mb-0"}>Billing address</label>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  billingAddress: current.shippingAddress,
                                }))
                              }
                              className="text-[11px] font-medium text-[#0f172a] hover:underline"
                            >
                              Same as shipping
                            </button>
                          </div>
                          <textarea
                            className={areaCls}
                            name="billingAddress"
                            value={form.billingAddress}
                            onChange={handleChange}
                            placeholder="Billing address"
                            rows="3"
                          />
                        </div>
                      </div>
                    </section>

                    {/* —— NOTES —— */}
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <FileText size={15} className="text-[#0f172a]" />
                        <h4 className="text-sm font-semibold text-slate-900">Notes</h4>
                      </div>
                      <textarea
                        className={areaCls}
                        name="notes"
                        value={form.notes}
                        onChange={handleChange}
                        placeholder="PO reference, packing instructions, etc."
                        rows="2"
                      />
                    </section>
                  </div>
                </div>

                {/* RIGHT – SUMMARY */}
                <aside className="w-full shrink-0 border-t border-slate-200 bg-slate-50 lg:w-[300px] lg:overflow-y-auto lg:border-l lg:border-t-0">
                  <div className="flex h-full flex-col p-4 sm:p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <Receipt size={15} className="text-[#0f172a]" />
                      <h4 className="text-sm font-semibold text-slate-900">Order summary</h4>
                    </div>

                    {/* line items */}
                    <div className="mb-4 flex-1 space-y-2">
                      {filledItems.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
                          No reels added yet
                        </p>
                      ) : (
                        filledItems.map((it, i) => {
                          const amt = Math.max(
                            0,
                            Number(it.quantity || 0) * Number(it.rate || 0) - Number(it.discount || 0)
                          );
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs"
                            >
                              <span className="font-medium text-slate-700">
                                {it.size} × {Number(it.quantity || 0).toLocaleString("en-IN")}
                              </span>
                              <span className="font-semibold tabular-nums text-slate-900">
                                {formatCurrency(amt)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* discount + tax */}
                    <div className="mb-4 grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Discount (₹)</label>
                        <input
                          className={fieldCls}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          name="discount"
                          value={form.discount}
                          onChange={handleChange}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Tax %</label>
                        <input
                          className={fieldCls}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          name="taxPercent"
                          value={form.taxPercent}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    {/* totals */}
                    <div className="space-y-2 border-t border-slate-200 pt-4 text-sm">
                      <div className="flex justify-between gap-3 text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-medium tabular-nums text-slate-800">
                          {formatCurrency(previewTotals.subTotal)}
                        </span>
                      </div>
                      {orderDiscount > 0 && (
                        <div className="flex justify-between gap-3 text-slate-600">
                          <span>Discount</span>
                          <span className="font-medium tabular-nums text-emerald-600">
                            −{formatCurrency(orderDiscount)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3 text-slate-600">
                        <span>Tax ({form.taxPercent || 0}%)</span>
                        <span className="font-medium tabular-nums text-slate-800">
                          {formatCurrency(previewTotals.tax)}
                        </span>
                      </div>
                    </div>

                    {/* grand total */}
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Grand total
                      </p>
                      <p className="mt-0.5 break-words text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                        {formatCurrency(previewTotals.grandTotal)}
                      </p>
                    </div>
                  </div>
                </aside>
              </div>

              {/* ========== FOOTER ========== */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-3.5">
                <p className="hidden text-xs text-slate-500 sm:block">
                  {isEdit ? "Changes save immediately." : "Saves as draft. Confirm later to deduct stock."}
                </p>
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:flex-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={isEdit ? handleUpdate : handleCreate}
                    disabled={saving}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f172a] px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:flex-none"
                  >
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    {saving ? "Saving..." : isEdit ? "Save changes" : "Create order"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {invoiceOpen && invoice && (
        <InvoiceModal invoice={invoice} onClose={() => setInvoiceOpen(false)} />
      )}

      {/* PAYMENTS MODAL */}
      {paymentModalOpen && selectedPaymentOrder && (
        <div
          className={`${sheetOverlay} z-[120]`}
          onClick={() => setPaymentModalOpen(false)}
        >
          <div
            className={`${sheetPanel} sm:max-w-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">
                  Payments — {selectedPaymentOrder.orderNumber}
                </h2>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {getContactName(selectedPaymentOrder.contact)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-6">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Order Value</p>
                  <p className="mt-1 break-words text-sm font-bold text-slate-800">{formatCurrency(selectedPaymentOrder.grandTotal)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Amount Paid</p>
                  <p className="mt-1 break-words text-sm font-bold text-emerald-600">{formatCurrency(selectedPaymentOrder.amountPaid)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Balance Due</p>
                  <p className="mt-1 break-words text-sm font-bold text-amber-600">
                    {formatCurrency(
                      Math.max(0, Number(selectedPaymentOrder.grandTotal || 0) - Number(selectedPaymentOrder.amountPaid || 0))
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200/70 pt-3">
                <span className="text-[11px] font-medium text-slate-400">Payment Status</span>
                <PaymentBadge status={selectedPaymentOrder.paymentStatus} />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {paymentLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <RefreshCw size={16} className="animate-spin" /> Loading payments...
                </div>
              ) : orderPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    <Wallet size={20} />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-800">No payments recorded</p>
                  <p className="mt-1 text-xs text-slate-500">Add the first payment for this order.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderPayments.map((payment) => (
                    <div key={payment._id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800">{formatCurrency(payment.amount)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {payment.paymentMode || "—"} · {formatDate(payment.paymentDate)}
                          </p>
                        </div>
                        <span className="max-w-[45%] shrink-0 break-all text-right text-[11px] font-medium text-slate-400">
                          {payment.transactionId || payment.chequeNumber || "—"}
                        </span>
                      </div>
                      {(payment.paidFrom || payment.bankName || payment.notes) && (
                        <div className="mt-2 space-y-0.5 border-t border-slate-200/60 pt-2 text-[11px] text-slate-500">
                          {payment.paidFrom && <p className="break-words">From: {payment.paidFrom}</p>}
                          {payment.bankName && <p className="break-words">Bank: {payment.bankName}</p>}
                          {payment.notes && <p className="break-words">{payment.notes}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-4">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:w-auto"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => { setPaymentModalOpen(false); setAddPaymentModalOpen(true); }}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#002244] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00335f] sm:w-auto"
              >
                <Plus size={15} /> Add Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PAYMENT MODAL */}
      {addPaymentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Add Payment</h2>
                <p className="mt-1 text-sm text-slate-500">Record a payment for this order</p>
              </div>
              <button
                type="button"
                onClick={() => setAddPaymentModalOpen(false)}
                className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
                <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:mb-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Order</p>
                      <p className="mt-1 truncate font-semibold text-slate-900">
                        {selectedPaymentOrder?.orderNumber || "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Remaining</p>
                      <p className="mt-1 text-lg font-bold text-amber-600">
                        ₹
                        {Math.max(
                          0,
                          Number(selectedPaymentOrder?.grandTotal || 0) - Number(selectedPaymentOrder?.amountPaid || 0)
                        ).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                  <div>
                    <label className={payLabelCls}>
                      Payment Amount <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">₹</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        name="amount"
                        value={paymentForm.amount}
                        onChange={handlePaymentFormChange}
                        min="0.01"
                        step="0.01"
                        placeholder="Enter amount"
                        required
                        className={`${payFieldCls} !pl-8`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={payLabelCls}>
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="paymentMode"
                      value={paymentForm.paymentMode}
                      onChange={handlePaymentFormChange}
                      required
                      className={`${payFieldCls} bg-white`}
                    >
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="NEFT">NEFT</option>
                      <option value="RTGS">RTGS</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className={payLabelCls}>
                      Payment Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="paymentDate"
                      value={paymentForm.paymentDate}
                      onChange={handlePaymentFormChange}
                      required
                      className={payFieldCls}
                    />
                  </div>

                  <div>
                    <label className={payLabelCls}>Paid From</label>
                    <input
                      type="text"
                      name="paidFrom"
                      value={paymentForm.paidFrom}
                      onChange={handlePaymentFormChange}
                      placeholder="e.g. HDFC Bank / Customer Account"
                      className={payFieldCls}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={payLabelCls}>Transaction / Reference ID</label>
                    <input
                      type="text"
                      name="transactionId"
                      value={paymentForm.transactionId}
                      onChange={handlePaymentFormChange}
                      placeholder="Enter transaction or reference ID"
                      className={payFieldCls}
                    />
                  </div>

                  {paymentForm.paymentMode === "Cheque" && (
                    <>
                      <div>
                        <label className={payLabelCls}>
                          Cheque Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="chequeNumber"
                          value={paymentForm.chequeNumber}
                          onChange={handlePaymentFormChange}
                          placeholder="Enter cheque number"
                          required
                          className={payFieldCls}
                        />
                      </div>
                      <div>
                        <label className={payLabelCls}>
                          Bank Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="bankName"
                          value={paymentForm.bankName}
                          onChange={handlePaymentFormChange}
                          placeholder="Enter bank name"
                          required
                          className={payFieldCls}
                        />
                      </div>
                    </>
                  )}

                  <div className="md:col-span-2">
                    <label className={payLabelCls}>Notes</label>
                    <textarea
                      name="notes"
                      value={paymentForm.notes}
                      onChange={handlePaymentFormChange}
                      rows={3}
                      placeholder="Add any notes about this payment..."
                      className={`${payFieldCls} resize-none`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
                <button
                  type="button"
                  onClick={() => setAddPaymentModalOpen(false)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {paymentSubmitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus size={17} /> Add Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          RESERVED STOCK CONFLICT — confirm before consuming reserved stock
      ===================================================== */}
      {isReservedConfirmOpen && reservedConflict && pendingOrder && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-6">
          <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-amber-200 bg-white shadow-2xl sm:max-w-md sm:rounded-2xl">
            {/* HEADER */}
            <div className="flex shrink-0 items-start gap-3 border-b border-amber-100 bg-amber-50/60 px-4 py-4 sm:px-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900">
                  Reserved stock will be used
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  Confirming {pendingOrder.order.orderNumber} exceeds the available (free) stock.
                </p>
              </div>
              <button
                type="button"
                onClick={handleReservedCancel}
                disabled={saving}
                className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-60"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            {/* BODY */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {reservedConflict.name}
              </p>

              <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Free
                  </p>
                  <p className="mt-1 text-base font-semibold text-emerald-700">
                    {Number(reservedConflict.freeQty || 0).toLocaleString("en-IN")}{" "}
                    <span className="text-[10px] font-medium text-slate-500">
                      {reservedConflict.unit}
                    </span>
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Reserved
                  </p>
                  <p className="mt-1 text-base font-semibold text-indigo-600">
                    {Number(reservedConflict.reservedQty || 0).toLocaleString("en-IN")}{" "}
                    <span className="text-[10px] font-medium text-slate-500">
                      {reservedConflict.unit}
                    </span>
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Requested
                  </p>
                  <p className="mt-1 text-base font-semibold text-amber-700">
                    {Number(reservedConflict.requested || 0).toLocaleString("en-IN")}{" "}
                    <span className="text-[10px] font-medium text-slate-500">
                      {reservedConflict.unit}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-xs text-amber-900">
                  <span className="font-semibold">
                    {Number(reservedConflict.usedFromReserved || 0).toLocaleString("en-IN")}{" "}
                    {reservedConflict.unit}
                  </span>{" "}
                  will be taken from stock reserved by the admin. This will reduce the
                  reserved quantity on{" "}
                  <span className="font-semibold">{reservedConflict.size}</span> reel stock.
                </p>
              </div>

              <p className="text-xs text-slate-600">
                Do you grant permission to proceed?
              </p>
            </div>

            {/* FOOTER */}
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
              <button
                type="button"
                onClick={handleReservedCancel}
                disabled={saving}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 sm:h-9 sm:w-auto"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={handleReservedConfirm}
                disabled={saving}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-auto"
              >
                {saving ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Yes, Use Reserved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          GENERIC CONFIRM DIALOG
      ===================================================== */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-6">
          <div
            className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`flex shrink-0 items-start gap-3 border-b px-4 py-4 sm:px-5 ${
                confirmDialog.confirmTone === "danger"
                  ? "border-rose-100 bg-rose-50/60"
                  : confirmDialog.confirmTone === "emerald"
                  ? "border-emerald-100 bg-emerald-50/60"
                  : confirmDialog.confirmTone === "sky"
                  ? "border-sky-100 bg-sky-50/60"
                  : "border-amber-100 bg-amber-50/60"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  confirmDialog.confirmTone === "danger"
                    ? "bg-rose-100 text-rose-700"
                    : confirmDialog.confirmTone === "emerald"
                    ? "bg-emerald-100 text-emerald-700"
                    : confirmDialog.confirmTone === "sky"
                    ? "bg-sky-100 text-sky-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {confirmDialog.confirmTone === "danger" ? (
                  <AlertTriangle size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900">
                  {confirmDialog.title}
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">
                  {confirmDialog.message}
                </p>
              </div>
              <button
                type="button"
                onClick={closeConfirm}
                className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
              <button
                type="button"
                onClick={closeConfirm}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:h-9 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const fn = confirmDialog.onConfirm;
                  closeConfirm();
                  fn?.();
                }}
                className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold text-white transition-colors sm:h-9 sm:w-auto ${
                  confirmDialog.confirmTone === "danger"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : confirmDialog.confirmTone === "emerald"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : confirmDialog.confirmTone === "sky"
                    ? "bg-sky-600 hover:bg-sky-700"
                    : "bg-[#002244] hover:bg-[#00335f]"
                }`}
              >
                <CheckCircle2 size={14} />
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceModal({ invoice, onClose }) {
  if (!invoice) return null;

  const seller = invoice.seller || {};
  const buyer = invoice.buyer || {};
  const consignee = invoice.consignee || {};

  const items = invoice.items || [];

  const formatInvoiceCurrencyNoSymbol = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatInvoiceDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const isIGST = invoice.taxType === "IGST";
  const taxPercent = isIGST
    ? invoice.igstPercent || 18
    : invoice.cgstPercent || 9;
  const taxAmount = isIGST
    ? invoice.igstAmount
    : (Number(invoice.cgstAmount || 0) + Number(invoice.sgstAmount || 0));

  // Primary HSN from first item (classic format shows one row in tax table)
  const primaryHsn = items[0]?.hsnSac || "—";

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
      {/* MODAL HEADER / ACTIONS */}
      <div className="mx-auto flex max-w-[900px] items-center justify-between gap-3 pb-3 print:hidden">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Tax Invoice</p>
          <p className="mt-0.5 truncate text-xs text-slate-300">
            {invoice.invoiceNumber || "Invoice"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/20 sm:h-9"
          >
            <FileText size={14} />
            Print
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20 sm:h-9 sm:w-9"
            aria-label="Close invoice"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <p className="mx-auto max-w-[794px] pb-2 text-center text-[11px] text-slate-300 md:hidden print:hidden">
        Swipe sideways to see the full invoice
      </p>

      {/* The invoice keeps its fixed A4-style width; on small screens it scrolls sideways */}
      <div className="mx-auto max-w-[794px] overflow-x-auto print:max-w-none print:overflow-visible">
      {/* =================================================
          CLASSIC GST TAX INVOICE (bordered layout)
      ================================================= */}
      <div
        id="invoice-print"
        className="invoice-paper mx-auto w-full min-w-[794px] max-w-[794px] bg-white text-[10px] text-black shadow-2xl print:min-w-0 print:max-w-none print:shadow-none"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        {/* TITLE */}
        <div className="border border-black border-b-0 px-2 py-1.5 text-center">
          <h1 className="text-[16px] font-bold tracking-wide">Tax Invoice</h1>
        </div>

        {/* SELLER + INVOICE META GRID */}
        <div className="grid grid-cols-12 border border-black">
          {/* LEFT: Seller details */}
          <div className="col-span-6 border-r border-black p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-[12px] font-bold uppercase leading-tight">
                  {seller.name || "CORVEX STEEL WIRES"}
                </p>
                <p className="mt-1 whitespace-pre-line text-[9px] leading-3.5">
                  {seller.address || "Seller address not configured"}
                </p>
                <p className="mt-1.5 text-[9px]">
                  <span className="font-semibold">GSTIN/UIN :</span>{" "}
                  {seller.gstin || "—"}
                </p>
                <p className="text-[9px]">
                  <span className="font-semibold">State Name :</span>{" "}
                  {seller.state || "—"}
                  {seller.stateCode ? `, Code : ${seller.stateCode}` : ""}
                </p>
              </div>

              {/* LOGO (right side of seller details) */}
              <img
                src={logo}
                alt="Company Logo"
                className="h-16 w-auto max-w-[120px] shrink-0 object-contain"
              />
            </div>
          </div>

          {/* RIGHT: Invoice fields (2-col grid of cells) */}
          <div className="col-span-6">
            <div className="grid grid-cols-2">
              <div className="border-b border-r border-black px-1.5 py-1">
                <p className="text-[8px] text-slate-600">Invoice No.</p>
                <p className="font-semibold">{invoice.invoiceNumber || "—"}</p>
              </div>
              <div className="border-b border-black px-1.5 py-1">
                <p className="text-[8px] text-slate-600">e-Way Bill No.</p>
                <p className="font-semibold">{invoice.eWayBillNumber || "—"}</p>
              </div>

              <div className="border-b border-r border-black px-1.5 py-1">
                <p className="text-[8px] text-slate-600">Dated</p>
                <p className="font-semibold">
                  {formatInvoiceDate(invoice.invoiceDate)}
                </p>
              </div>
              <div className="border-b border-black px-1.5 py-1">
                <p className="text-[8px] text-slate-600">Mode/Terms of Payment</p>
                <p className="font-semibold">
                  {invoice.paymentTerms || "As per Order"}
                </p>
              </div>

              <div className="border-b border-r border-black px-1.5 py-1">
                <p className="text-[8px] text-slate-600">Reference No. & Date</p>
                <p className="font-semibold">{invoice.reference || "—"}</p>
              </div>
              <div className="border-b border-black px-1.5 py-1">
                <p className="text-[8px] text-slate-600">Other References</p>
                <p className="font-semibold">{invoice.otherReferences || "—"}</p>
              </div>

              <div className="border-b border-r border-black px-1.5 py-1">
                <p className="text-[8px] text-slate-600">Buyer's Order No.</p>
                <p className="font-semibold">
                  {invoice.buyersOrderNumber || invoice.reference || "—"}
                </p>
              </div>
              <div className="border-b border-black px-1.5 py-1">
                <p className="text-[8px] text-slate-600">Dated</p>
                <p className="font-semibold">
                  {formatInvoiceDate(invoice.buyersOrderDate || invoice.invoiceDate)}
                </p>
              </div>

              <div className="border-b border-r border-black px-1.5 py-1">
                <p className="text-[8px] text-slate-600">Dispatch Doc No.</p>
                <p className="font-semibold">{invoice.dispatchDocNumber || "—"}</p>
              </div>
              <div className="border-b border-black px-1.5 py-1">
                <p className="text-[8px] text-slate-600">Delivery Note Date</p>
                <p className="font-semibold">
                  {formatInvoiceDate(invoice.deliveryNoteDate)}
                </p>
              </div>

              <div className="border-r border-black px-1.5 py-1">
                <p className="text-[8px] text-slate-600">Dispatched through</p>
                <p className="font-semibold">{invoice.dispatchedThrough || "—"}</p>
              </div>
              <div className="px-1.5 py-1">
                <p className="text-[8px] text-slate-600">Destination</p>
                <p className="font-semibold">
                  {invoice.destination || consignee.state || buyer.state || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CONSIGNEE + BUYER */}
        <div className="grid grid-cols-2 border border-black border-t-0">
          <div className="border-r border-black p-2">
            <p className="text-[9px] font-bold">Consignee (Ship to)</p>
            <p className="mt-1 text-[11px] font-bold uppercase leading-tight">
              {consignee.company || consignee.name || "—"}
            </p>
            <p className="mt-0.5 whitespace-pre-line text-[9px] leading-3.5">
              {consignee.address || "—"}
            </p>
            <p className="mt-1 text-[9px]">
              <span className="font-semibold">GSTIN/UIN</span>{" "}
              : {consignee.gstin || "—"}
            </p>
            <p className="text-[9px]">
              <span className="font-semibold">State Name</span>{" "}
              : {consignee.state || "—"}
              {consignee.stateCode ? `, Code : ${consignee.stateCode}` : ""}
            </p>
          </div>

          <div className="p-2">
            <p className="text-[9px] font-bold">Buyer (Bill to)</p>
            <p className="mt-1 text-[11px] font-bold uppercase leading-tight">
              {buyer.company || buyer.name || "—"}
            </p>
            <p className="mt-0.5 whitespace-pre-line text-[9px] leading-3.5">
              {buyer.address || "—"}
            </p>
            <p className="mt-1 text-[9px]">
              <span className="font-semibold">GSTIN/UIN</span>{" "}
              : {buyer.gstin || "—"}
            </p>
            <p className="text-[9px]">
              <span className="font-semibold">State Name</span>{" "}
              : {buyer.state || "—"}
              {buyer.stateCode ? `, Code : ${buyer.stateCode}` : ""}
            </p>
          </div>
        </div>

        {/* TERMS OF DELIVERY */}
        <div className="border border-black border-t-0 px-2 py-1">
          <p className="text-[9px]">
            <span className="font-semibold">Terms of Delivery</span>
            <span className="ml-2">{invoice.termsOfDelivery || "—"}</span>
          </p>
        </div>

        {/* ITEMS TABLE */}
        <table className="w-full border-collapse border border-black border-t-0">
          <thead>
            <tr className="border-b border-black">
              <th className="w-[6%] border-r border-black px-1 py-1.5 text-center text-[9px] font-bold">
                SI<br />No.
              </th>
              <th className="w-[32%] border-r border-black px-1 py-1.5 text-left text-[9px] font-bold">
                Description of Goods
              </th>
              <th className="w-[12%] border-r border-black px-1 py-1.5 text-center text-[9px] font-bold">
                HSN/SAC
              </th>
              <th className="w-[14%] border-r border-black px-1 py-1.5 text-right text-[9px] font-bold">
                Quantity
              </th>
              <th className="w-[12%] border-r border-black px-1 py-1.5 text-right text-[9px] font-bold">
                Rate
              </th>
              <th className="w-[8%] border-r border-black px-1 py-1.5 text-center text-[9px] font-bold">
                per
              </th>
              <th className="w-[16%] px-1 py-1.5 text-right text-[9px] font-bold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item._id || index} className="border-b border-black">
                <td className="border-r border-black px-1 py-2 text-center align-top">
                  {index + 1}
                </td>
                <td className="border-r border-black px-1 py-2 align-top">
                  <p className="font-semibold uppercase">
                    {item.description || "—"}
                  </p>
                </td>
                <td className="border-r border-black px-1 py-2 text-center align-top">
                  {item.hsnSac || "—"}
                </td>
                <td className="border-r border-black px-1 py-2 text-right align-top">
                  {Number(item.quantity || 0).toLocaleString("en-IN")}{" "}
                  {item.unit || ""}
                </td>
                <td className="border-r border-black px-1 py-2 text-right align-top">
                  {formatInvoiceCurrencyNoSymbol(item.rate)}
                </td>
                <td className="border-r border-black px-1 py-2 text-center align-top">
                  {item.unit || "kg"}
                </td>
                <td className="px-1 py-2 text-right align-top font-semibold">
                  {formatInvoiceCurrencyNoSymbol(item.amount)}
                </td>
              </tr>
            ))}

            {/* IGST / CGST+SGST row inside table (classic style) */}
            {isIGST ? (
              <tr className="border-b border-black">
                <td className="border-r border-black px-1 py-1" />
                <td className="border-r border-black px-1 py-1 text-right font-semibold italic">
                  IGST
                </td>
                <td className="border-r border-black px-1 py-1" />
                <td className="border-r border-black px-1 py-1" />
                <td className="border-r border-black px-1 py-1 text-right">
                  {taxPercent}
                </td>
                <td className="border-r border-black px-1 py-1 text-center">%</td>
                <td className="px-1 py-1 text-right font-semibold">
                  {formatInvoiceCurrencyNoSymbol(invoice.igstAmount)}
                </td>
              </tr>
            ) : (
              <>
                <tr className="border-b border-black">
                  <td className="border-r border-black px-1 py-1" />
                  <td className="border-r border-black px-1 py-1 text-right font-semibold italic">
                    CGST
                  </td>
                  <td className="border-r border-black px-1 py-1" />
                  <td className="border-r border-black px-1 py-1" />
                  <td className="border-r border-black px-1 py-1 text-right">
                    {invoice.cgstPercent || 9}
                  </td>
                  <td className="border-r border-black px-1 py-1 text-center">%</td>
                  <td className="px-1 py-1 text-right font-semibold">
                    {formatInvoiceCurrencyNoSymbol(invoice.cgstAmount)}
                  </td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black px-1 py-1" />
                  <td className="border-r border-black px-1 py-1 text-right font-semibold italic">
                    SGST
                  </td>
                  <td className="border-r border-black px-1 py-1" />
                  <td className="border-r border-black px-1 py-1" />
                  <td className="border-r border-black px-1 py-1 text-right">
                    {invoice.sgstPercent || 9}
                  </td>
                  <td className="border-r border-black px-1 py-1 text-center">%</td>
                  <td className="px-1 py-1 text-right font-semibold">
                    {formatInvoiceCurrencyNoSymbol(invoice.sgstAmount)}
                  </td>
                </tr>
              </>
            )}

            {/* TOTAL row */}
            <tr className="border-b border-black bg-slate-50">
              <td className="border-r border-black px-1 py-1.5" />
              <td className="border-r border-black px-1 py-1.5 text-right font-bold">
                Total
              </td>
              <td className="border-r border-black px-1 py-1.5" />
              <td className="border-r border-black px-1 py-1.5 text-right font-semibold">
                {items
                  .reduce((sum, i) => sum + Number(i.quantity || 0), 0)
                  .toLocaleString("en-IN")}{" "}
                {items[0]?.unit || ""}
              </td>
              <td className="border-r border-black px-1 py-1.5" />
              <td className="border-r border-black px-1 py-1.5" />
              <td className="px-1 py-1.5 text-right text-[11px] font-bold">
                ₹ {formatInvoiceCurrencyNoSymbol(invoice.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* AMOUNT IN WORDS */}
        <div className="border border-black border-t-0 px-2 py-1.5">
          <p className="text-[9px]">
            <span className="font-semibold">Amount Chargeable (in words)</span>
          </p>
          <p className="mt-0.5 text-[10px] font-semibold">
            { invoice.amountInWords || "Amount in words not available"}
          </p>
          <p className="mt-0.5 text-right text-[8px] italic text-slate-500">
            E. & O.E
          </p>
        </div>

        {/* TAX SUMMARY TABLE (HSN-based) */}
        <table className="w-full border-collapse border border-black border-t-0">
          <thead>
            <tr className="border-b border-black">
              <th className="border-r border-black px-1 py-1 text-left text-[8px] font-bold">
                HSN/SAC
              </th>
              <th className="border-r border-black px-1 py-1 text-right text-[8px] font-bold">
                Taxable<br />Value
              </th>
              {isIGST ? (
                <>
                  <th
                    colSpan={2}
                    className="border-r border-black px-1 py-1 text-center text-[8px] font-bold"
                  >
                    Integrated Tax
                  </th>
                  <th className="px-1 py-1 text-right text-[8px] font-bold">
                    Total<br />Tax Amount
                  </th>
                </>
              ) : (
                <>
                  <th
                    colSpan={2}
                    className="border-r border-black px-1 py-1 text-center text-[8px] font-bold"
                  >
                    Central Tax
                  </th>
                  <th
                    colSpan={2}
                    className="border-r border-black px-1 py-1 text-center text-[8px] font-bold"
                  >
                    State Tax
                  </th>
                  <th className="px-1 py-1 text-right text-[8px] font-bold">
                    Total<br />Tax Amount
                  </th>
                </>
              )}
            </tr>
            <tr className="border-b border-black">
              <th className="border-r border-black px-1 py-0.5" />
              <th className="border-r border-black px-1 py-0.5" />
              {isIGST ? (
                <>
                  <th className="border-r border-black px-1 py-0.5 text-center text-[8px] font-semibold">
                    Rate
                  </th>
                  <th className="border-r border-black px-1 py-0.5 text-right text-[8px] font-semibold">
                    Amount
                  </th>
                  <th className="px-1 py-0.5" />
                </>
              ) : (
                <>
                  <th className="border-r border-black px-1 py-0.5 text-center text-[8px] font-semibold">
                    Rate
                  </th>
                  <th className="border-r border-black px-1 py-0.5 text-right text-[8px] font-semibold">
                    Amount
                  </th>
                  <th className="border-r border-black px-1 py-0.5 text-center text-[8px] font-semibold">
                    Rate
                  </th>
                  <th className="border-r border-black px-1 py-0.5 text-right text-[8px] font-semibold">
                    Amount
                  </th>
                  <th className="px-1 py-0.5" />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black">
              <td className="border-r border-black px-1 py-1.5 text-[9px]">
                {primaryHsn}
              </td>
              <td className="border-r border-black px-1 py-1.5 text-right text-[9px]">
                {formatInvoiceCurrencyNoSymbol(invoice.taxableAmount)}
              </td>
              {isIGST ? (
                <>
                  <td className="border-r border-black px-1 py-1.5 text-center text-[9px]">
                    {taxPercent}%
                  </td>
                  <td className="border-r border-black px-1 py-1.5 text-right text-[9px]">
                    {formatInvoiceCurrencyNoSymbol(invoice.igstAmount)}
                  </td>
                  <td className="px-1 py-1.5 text-right text-[9px] font-semibold">
                    {formatInvoiceCurrencyNoSymbol(invoice.igstAmount)}
                  </td>
                </>
              ) : (
                <>
                  <td className="border-r border-black px-1 py-1.5 text-center text-[9px]">
                    {invoice.cgstPercent || 9}%
                  </td>
                  <td className="border-r border-black px-1 py-1.5 text-right text-[9px]">
                    {formatInvoiceCurrencyNoSymbol(invoice.cgstAmount)}
                  </td>
                  <td className="border-r border-black px-1 py-1.5 text-center text-[9px]">
                    {invoice.sgstPercent || 9}%
                  </td>
                  <td className="border-r border-black px-1 py-1.5 text-right text-[9px]">
                    {formatInvoiceCurrencyNoSymbol(invoice.sgstAmount)}
                  </td>
                  <td className="px-1 py-1.5 text-right text-[9px] font-semibold">
                    {formatInvoiceCurrencyNoSymbol(taxAmount)}
                  </td>
                </>
              )}
            </tr>
            <tr>
              <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">
                Total
              </td>
              <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">
                {formatInvoiceCurrencyNoSymbol(invoice.taxableAmount)}
              </td>
              {isIGST ? (
                <>
                  <td className="border-r border-black px-1 py-1" />
                  <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">
                    {formatInvoiceCurrencyNoSymbol(invoice.igstAmount)}
                  </td>
                  <td className="px-1 py-1 text-right text-[9px] font-bold">
                    {formatInvoiceCurrencyNoSymbol(invoice.igstAmount)}
                  </td>
                </>
              ) : (
                <>
                  <td className="border-r border-black px-1 py-1" />
                  <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">
                    {formatInvoiceCurrencyNoSymbol(invoice.cgstAmount)}
                  </td>
                  <td className="border-r border-black px-1 py-1" />
                  <td className="border-r border-black px-1 py-1 text-right text-[9px] font-bold">
                    {formatInvoiceCurrencyNoSymbol(invoice.sgstAmount)}
                  </td>
                  <td className="px-1 py-1 text-right text-[9px] font-bold">
                    {formatInvoiceCurrencyNoSymbol(taxAmount)}
                  </td>
                </>
              )}
            </tr>
          </tbody>
        </table>

        {/* TAX AMOUNT IN WORDS */}
        <div className="border border-black border-t-0 px-2 py-1.5">
          <p className="text-[9px]">
            <span className="font-semibold">Tax Amount (in words) :</span>{" "}
            <span className="font-semibold">
              {invoice.taxAmountInWords || "Tax amount in words not available"}
            </span>
          </p>
        </div>

        {/* DECLARATION + SIGNATURE */}
        <div className="grid grid-cols-2 border border-black border-t-0">
          <div className="min-h-[100px] border-r border-black p-2">
            <p className="text-[9px] font-bold underline">Declaration</p>
            <p className="mt-1 text-[9px] leading-3.5">
              {invoice.declaration ||
                "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."}
            </p>
          </div>

          <div className="relative min-h-[100px] p-2">
            <p className="text-right text-[9px] font-semibold">
              for {seller.name || "CORVEX STEEL WIRES"}
            </p>
            <div className="absolute bottom-2 right-2 text-right">
              <div className="mb-6 h-6" />
              <p className="text-[9px] font-semibold">
                {invoice.authorisedSignatory || "Authorised Signatory"}
              </p>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="border border-black border-t-0 px-2 py-1.5 text-center">
          <p className="text-[8px] text-slate-600">
            This is a Computer Generated Invoice
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, description, icon: Icon }) {
  return (
    <div className="card min-w-0">
      <div className="card-body !p-3 sm:!p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[var(--color-text-secondary)]">{label}</p>
            <p className="mt-1.5 truncate text-xl font-bold tracking-tight !text-black sm:mt-2 sm:text-2xl">{value}</p>
            <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">{description}</p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 sm:h-9 sm:w-9">
            <Icon size={17} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton({ width = "w-20", rounded = false }) {
  return (
    <div
      className={`h-4 ${width} animate-pulse bg-slate-100 ${rounded ? "rounded-full" : "rounded"}`}
    />
  );
}

function SectionHeading({ icon: Icon, title, iconWrapper = "bg-slate-100 text-slate-500" }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconWrapper}`}>
        <Icon size={14} />
      </div>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h3>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[11px] font-medium text-slate-400">{label}</span>
      <span className="max-w-[65%] break-words text-right text-xs font-semibold leading-5 text-slate-700">
        {value || "—"}
      </span>
    </div>
  );
}

function DetailMetric({ label, value, strong = false }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span
        className={`mt-1 block break-words text-xs ${
          strong ? "font-bold text-slate-800" : "font-semibold text-slate-700"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function TimelineItem({ title, description, date, active = false }) {
  return (
    <div className="relative">
      <span
        className={`absolute -left-6 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white ring-1 ${
          active ? "bg-[#002244] ring-[#002244]/20" : "bg-slate-300 ring-slate-200"
        }`}
      />
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p>
      <span className="mt-1.5 block text-[10px] font-medium text-slate-400">{date}</span>
    </div>
  );
}

export default Orders;