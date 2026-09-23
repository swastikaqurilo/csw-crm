import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./components/AuthContext";
import PrivateRoute from "./components/PrivateRoute";

import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import Enquiries from "./pages/Enquiries";
import Contacts from "./pages/Contacts";
import FollowUps from "./pages/FollowUps";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import Orders from "./pages/Orders";
import Payments from "./pages/Payments";
import Revenue from "./pages/Revenue";
import Accounting from "./pages/Accounting";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Expenses from "./pages/Expenses";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public — no Layout (no sidebar / header) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected — all app pages with Layout */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="enquiries" element={<Enquiries />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="follow-ups" element={<FollowUps />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="products" element={<Products />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="orders" element={<Orders />} />
            <Route path="payments" element={<Payments />} />
            <Route path="revenue" element={<Revenue />} />
            <Route path="accounting" element={<Accounting />} />
            <Route path="expenses" element={<Expenses/>} />
          </Route>

          {/* Catch-all → dashboard (will redirect to login if not authenticated) */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;