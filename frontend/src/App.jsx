import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import Home from "./pages/Home";
import About from "./pages/About";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import AdminDashboard from "./pages/AdminDashboard";
import CourseDetail from "./pages/CourseDetail";
import Payment from "./pages/Payment";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ProtectAdmin from "./components/ProtectAdmin";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/courses/:id/pay" element={<Payment />} />
          <Route path="/about" element={<About />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin" element={<Navigate to="/login" replace />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectAdmin>
                <AdminDashboard />
              </ProtectAdmin>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
