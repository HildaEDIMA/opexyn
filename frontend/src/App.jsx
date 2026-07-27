import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/dashboard/Dashboard";
import Billing from "./pages/dashboard/Billing";
import Context from "./pages/dashboard/Context";
import AgentDashboard from "./pages/dashboard/AgentDashboard";
import ConnectTools from "./pages/dashboard/ConnectTools";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import OnboardingAlex from "./pages/dashboard/OnboardingAlex";
import AuthCallback from "./pages/auth/AuthCallback";
import Marketplace from "./pages/dashboard/Marketplace";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const token = localStorage.getItem("token");
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/billing" element={<PrivateRoute><Billing /></PrivateRoute>} />
        <Route path="/context" element={<PrivateRoute><Context /></PrivateRoute>} />
        <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />
        {/* Dashboard/chat d'un agent précis */}
        <Route path="/agent/:agentId" element={<PrivateRoute><AgentDashboard /></PrivateRoute>} />
        {/* Briefing/configuration d'un agent précis — route distincte, plus de chevauchement */}
        <Route path="/agent/:agentId/onboarding" element={<PrivateRoute><OnboardingAlex /></PrivateRoute>} />
        <Route path="/connect" element={<PrivateRoute><ConnectTools /></PrivateRoute>} />
        <Route path="/marketplace" element={<PrivateRoute><Marketplace /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}