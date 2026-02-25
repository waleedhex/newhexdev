import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CodeVerification from "./pages/CodeVerification";
import RoleSelection from "./pages/RoleSelection";
import HostPage from "./pages/HostPage";
import DisplayPage from "./pages/DisplayPage";
import AdminPanel from "./pages/AdminPanel";
import InvitePage from "./pages/InvitePage";
import ContestantPage from "./pages/ContestantPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CodeVerification />} />
          <Route path="/select-role" element={<RoleSelection />} />
          <Route path="/host" element={<HostPage />} />
          <Route path="/display" element={<DisplayPage />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/contestant" element={<ContestantPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
