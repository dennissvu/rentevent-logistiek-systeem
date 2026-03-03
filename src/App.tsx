import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { OrdersProvider } from "@/context/OrdersContext";
import { TransportProvider } from "@/context/TransportContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Index from "./pages/Index";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Planning from "./pages/Planning";
import Transport from "./pages/Transport";
import Drivers from "./pages/Drivers";
import DriverPlanning from "./pages/DriverPlanning";
import DailyPlanning from "./pages/DailyPlanning";
import ChauffeurView from "./pages/ChauffeurView";
import RentalAgreement from "./pages/RentalAgreement";
import SignedAgreementView from "./pages/SignedAgreementView";
import Onderhoud from "./pages/Onderhoud";
import DayRouteBuilder from "./pages/DayRouteBuilder";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import { getRedirectToAfterLogin } from "@/utils/authRedirect";
import { useState } from "react";
import { Loader2 } from "lucide-react";

function LoginRoute({ session }: { session: ReturnType<typeof useAuth>["session"] }) {
  const location = useLocation();
  const redirectTo = getRedirectToAfterLogin(location.state as Parameters<typeof getRedirectToAfterLogin>[0]);
  if (session) {
    return <Navigate to={redirectTo} replace />;
  }
  return <Login />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    if (location.pathname === "/") {
      return <Landing />;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Login: redirect back to intended page after login */}
      <Route path="/login" element={<LoginRoute session={session} />} />

      {/* Publieke routes - geen login nodig */}
      <Route path="/chauffeur" element={<ChauffeurView />} />
      <Route path="/verhuurovereenkomst/:orderId" element={<RentalAgreement />} />
      <Route path="/verhuurovereenkomst/:orderId/bekijk" element={<SignedAgreementView />} />

      {/* Beveiligde kantoor routes */}
      <Route path="*" element={
        <ProtectedRoute>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/planning" element={<Planning />} />
              <Route path="/transport" element={<Transport />} />
              <Route path="/chauffeurs" element={<Drivers />} />
              <Route path="/medewerker-planning" element={<DriverPlanning />} />
              <Route path="/dagplanning" element={<DailyPlanning />} />
              <Route path="/route-builder" element={<DayRouteBuilder />} />
              <Route path="/onderhoud" element={<Onderhoud />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TransportProvider>
          <OrdersProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            </BrowserRouter>
          </OrdersProvider>
        </TransportProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
