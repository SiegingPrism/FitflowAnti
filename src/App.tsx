import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/lib/store";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ThemeUnlockWatcher } from "@/components/shared/ThemeUnlockWatcher";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AnimatedBackground } from "@/components/theme/AnimatedBackground";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Tasks from "./pages/Tasks.tsx";
import Focus from "./pages/Focus.tsx";
import Habits from "./pages/Habits.tsx";
import Calendar from "./pages/Calendar.tsx";
import Rewards from "./pages/Rewards.tsx";
import Insights from "./pages/Insights.tsx";
import Settings from "./pages/Settings.tsx";
import Coach from "./pages/Coach.tsx";
import SkillTree from "./pages/SkillTree.tsx";
import Life from "./pages/Life.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const FullScreenLoader = () => (
  <div className="min-h-screen relative flex items-center justify-center">
    <AnimatedBackground />
    <Loader2 className="w-6 h-6 animate-spin text-primary relative z-10" />
  </div>
);

const ProtectedRoutes = () => {
  const { session, loading } = useAuth();
  const location = useLocation();
  const bindUser = useAppStore((s) => s.bindUser);
  const hydrated = useAppStore((s) => s.hydrated);
  const onboardedAt = useAppStore((s) => s.onboardedAt);

  useEffect(() => {
    if (session?.user) {
      bindUser(session.user.id);
    } else if (!loading) {
      bindUser(null);
    }
  }, [session?.user?.id, loading, bindUser]);

  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/auth" replace state={{ from: location }} />;
  if (!hydrated) return <FullScreenLoader />;
  if (!onboardedAt) return <OnboardingWizard />;

  return (
    <>
      <ThemeUnlockWatcher />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/focus" element={<Focus />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/life" element={<Life />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/skill-tree" element={<SkillTree />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
