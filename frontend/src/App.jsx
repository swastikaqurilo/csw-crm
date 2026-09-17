import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;