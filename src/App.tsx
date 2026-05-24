// mapbox-gl CSS is loaded in main.tsx — do not duplicate here

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import TermsOfUse from "./pages/TermsOfUse";
import ContactPage from "./pages/ContactPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import AboutPage from "./pages/AboutPage";
import DriverRequirementsPage from "./pages/DriverRequirementsPage";
import RiderRequestPage from "./pages/RiderRequestPage";
import RideDestinationPage from "./pages/RideDestinationPage";
import RideReceiptPage from "./pages/RideReceiptPage";
import FareEstimatorPage from "./pages/FareEstimatorPage";
import DriverPayEstimatorPage from "./pages/DriverPayEstimatorPage";
import DriverTripEstimatorPage from "./pages/DriverTripEstimatorPage";
import SafetyPage from "./pages/SafetyPage";
import FAQHelpCenterPage from "./pages/FAQHelpCenterPage";
import UploadDocumentsPage from "./pages/UploadDocumentsPage";
import DocumentsSubmittedPage from "./pages/DocumentsSubmittedPage";
import ApplyToDrivePage from "./pages/ApplyToDrivePage";
import DriverOnboardingWelcomePage from "./pages/DriverOnboardingWelcomePage";

import AdminPanel from "@/components/admin/AdminPanel";
import AdminDiagnosticsPage from "./pages/AdminDiagnosticsPage";
















const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/terms" element={<TermsOfUse />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/driver-requirements" element={<DriverRequirementsPage />} />
            <Route path="/request-ride" element={<RiderRequestPage />} />
            <Route path="/ride-destination" element={<RideDestinationPage />} />
            <Route path="/receipt/:rideId" element={<RideReceiptPage />} />
            <Route path="/estimate-fare" element={<FareEstimatorPage />} />
            <Route path="/estimate-pay" element={<DriverPayEstimatorPage />} />
            <Route path="/driver-trip-estimator" element={<DriverTripEstimatorPage />} />
            <Route path="/safety" element={<SafetyPage />} />
            <Route path="/faq" element={<FAQHelpCenterPage />} />
            <Route path="/upload-documents" element={<UploadDocumentsPage />} />
            <Route path="/documents-submitted" element={<DocumentsSubmittedPage />} />
            <Route path="/apply-to-drive" element={<ApplyToDrivePage />} />
            <Route path="/onboarding-welcome" element={<DriverOnboardingWelcomePage />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/admin/diagnostics" element={<AdminDiagnosticsPage />} />





            <Route path="*" element={<NotFound />} />


          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;

