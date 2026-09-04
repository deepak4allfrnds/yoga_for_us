import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import Home from "./pages/Home";
import About from "./pages/About";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import AdminDashboard from "./pages/AdminDashboard";
import CourseDetail from "./pages/CourseDetail";
import Payment from "./pages/Payment";
import PaymentHistory from "./pages/PaymentHistory";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ProtectAdmin from "./components/ProtectAdmin";
import ProtectStudent from "./components/ProtectStudent";
import PageLoader from "./components/PageLoader";
import Trial from "./pages/Trial";
import PrivateYoga from "./pages/PrivateYoga";
import Membership from "./pages/Membership";
import Workshops from "./pages/Workshops";
import Checkout from "./pages/Checkout";
import StudentDashboard from "./pages/StudentDashboard";
import Attend from "./pages/Attend";
import OnlineClasses from "./pages/OnlineClasses";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PageLoader />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/courses/:id/pay" element={<Payment />} />
          <Route path="/pay" element={<Checkout />} />
          <Route path="/trial" element={<Trial />} />
          <Route path="/private" element={<PrivateYoga />} />
          <Route path="/membership" element={<Membership />} />
          <Route path="/online" element={<OnlineClasses />} />
          <Route path="/workshops" element={<Workshops />} />
          <Route path="/attend/:code" element={<Attend />} />
          <Route
            path="/dashboard"
            element={
              <ProtectStudent>
                <StudentDashboard />
              </ProtectStudent>
            }
          />
          <Route path="/payments/history" element={<PaymentHistory />} />
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
