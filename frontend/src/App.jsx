import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./components/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Enquiries from "./pages/Enquiries";
import Contacts from "./pages/Contacts";
import FollowUps from "./pages/FollowUps";
import Settings from "./pages/Settings";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Payments from "./pages/Payments";
import Accounting from "./pages/Accounting";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Expenses from "./pages/Expenses";
import RawMaterials from "./pages/RawMaterials";
import Salary from "./pages/Salary";
import Workers from "./pages/Worker";


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

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
            <Route path="settings" element={<Settings />} />
            <Route path="products" element={<Products />} />
            <Route path="orders" element={<Orders />} />
            <Route path="payments" element={<Payments />} />
            <Route path="accounting" element={<Accounting />} />
            <Route path="expenses" element={<Expenses/>} />
            <Route path="rawmats" element={<RawMaterials/>} />
            <Route path="salary" element={<Salary/>} />
            <Route path="worker" element={<Workers/>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        <ToastContainer
          position="top-right"
          autoClose={3200}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          draggable
          theme="light"
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;