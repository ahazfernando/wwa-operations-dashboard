import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clock from "./pages/Clock";
import Ratings from "./pages/Ratings";
import Leads from "./pages/Leads";
import Settings from "./pages/Settings";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Dashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/clock"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Clock />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ratings"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Ratings />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/leads"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Leads />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/leave"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ComingSoon
                      title="Leave Management"
                      description="Employee leave request and approval system"
                      features={[
                        'Submit leave requests with date ranges',
                        'Manager approval workflow',
                        'Leave balance tracking',
                        'Calendar integration',
                        'Automatic conflict detection'
                      ]}
                    />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/saas"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ComingSoon
                      title="SaaS Monetization"
                      description="Productization and monetization configuration"
                      features={[
                        'Subscription plan management',
                        'Pricing tier configuration',
                        'Usage tracking and billing',
                        'Customer portal integration',
                        'Revenue analytics dashboard'
                      ]}
                    />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cv-automation"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ComingSoon
                      title="CV Creation Automation"
                      description="Automated CV/resume generation system"
                      features={[
                        'Template-based CV generation',
                        'Employee data integration',
                        'Multiple format exports (PDF, DOCX)',
                        'Custom branding options',
                        'Bulk generation capabilities'
                      ]}
                    />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Settings />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
