import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/lib/store";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ThemeUnlockWatcher } from "@/components/shared/ThemeUnlockWatcher";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AnimatedBackground } from "@/components/theme/AnimatedBackground";

// Lazy-loaded route chunks for fast initial bundle and split loading
const Index = lazy(() => import("./pages/Index.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Tasks = lazy(() => import("./pages/Tasks.tsx"));
const Focus = lazy(() => import("./pages/Focus.tsx"));
const Habits = lazy(() => import("./pages/Habits.tsx"));
const Calendar = lazy(() => import("./pages/Calendar.tsx"));
const Rewards = lazy(() => import("./pages/Rewards.tsx"));
const Insights = lazy(() => import("./pages/Insights.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Coach = lazy(() => import("./pages/Coach.tsx"));
const SkillTree = lazy(() => import("./pages/SkillTree.tsx"));
const Life = lazy(() => import("./pages/Life.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const MindDeveloper = lazy(() => import("./pages/MindDeveloper.tsx"));
const Import = lazy(() => import("./pages/Import.tsx"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const FullScreenLoader = () => (
  <div className="min-h-screen relative flex items-center justify-center">
    <AnimatedBackground />
    <Loader2 className="w-6 h-6 animate-spin text-primary relative z-10" />
  </div>
);

const ConfigError = () => (
  <div className="min-h-screen relative flex items-center justify-center p-6 text-center">
    <AnimatedBackground />
    <div className="glass-card max-w-md relative z-10">
      <h1 className="text-2xl font-bold mb-4">Configuration Missing</h1>
      <p className="text-muted-foreground mb-6">
        The application is missing its connection to Supabase. Please add 
        <code className="bg-black/20 px-1 rounded mx-1">VITE_SUPABASE_URL</code> and 
        <code className="bg-black/20 px-1 rounded mx-1">VITE_SUPABASE_PUBLISHABLE_KEY</code> 
        to your Vercel Environment Variables.
      </p>
      <button 
        onClick={() => window.location.reload()}
        className="w-full bg-gradient-primary py-3 rounded-xl font-bold shadow-glow"
      >
        Retry Connection
      </button>
    </div>
  </div>
);

const ProtectedRoutes = () => {
  const { session, loading } = useAuth();
  const location = useLocation();
  const bindUser = useAppStore((s) => s.bindUser);
  const hydrated = useAppStore((s) => s.hydrated);
  const onboardedAt = useAppStore((s) => s.onboardedAt);
  const hellMode = useAppStore((s) => s.hellMode);

  useEffect(() => {
    if (hellMode) {
      document.body.classList.add("hell-mode");
    } else {
      document.body.classList.remove("hell-mode");
    }
  }, [hellMode]);

  useEffect(() => {
    if (loading) return;
    
    if (session?.user) {
      bindUser(session.user.id);
    } else {
      bindUser(null);
    }
  }, [session?.user, loading, bindUser]);

  const isDeveloper =
    session?.user?.email === "ishanibassin@gmail.com" ||
    (import.meta.env.DEV && session?.user?.email === "dev@fitflow.app");

  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/auth" replace state={{ from: location }} />;
  if (!hydrated) return <FullScreenLoader />;
  if (!onboardedAt) return <OnboardingWizard />;

  return (
    <>
      <ThemeUnlockWatcher />
      <Suspense fallback={<FullScreenLoader />}>
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
          <Route path="/import" element={<Import />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/mind-developer" element={isDeveloper ? <MindDeveloper /> : <Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const WebBridgeRedirectPage = ({ appSchemeUrl }: { appSchemeUrl: string }) => {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 text-center">
      <AnimatedBackground />
      <div className="glass-card max-w-md w-full relative z-10 flex flex-col items-center p-8">
        <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-elevated border border-primary/20 mb-6">
          <img src="/logo.png" alt="Fitflow Logo" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Authentication Complete
        </h1>
        <p className="text-muted-foreground mb-8 text-sm leading-relaxed max-w-xs">
          Your account is authenticated successfully. Tap the button below to return to your Fitflow mobile app.
        </p>
        <a 
          href={appSchemeUrl}
          className="w-full bg-gradient-primary py-4 rounded-2xl font-bold shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-bounce inline-flex items-center justify-center text-primary-foreground gap-2"
        >
          Open Fitflow App
        </a>
        <p className="text-xs text-muted-foreground mt-4">
          Didn't open? Tap the button above to retry.
        </p>
      </div>
    </div>
  );
};

const App = () => {
  const isConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const [isWebBridgeRedirect, setIsWebBridgeRedirect] = useState(false);
  const [appSchemeUrl, setAppSchemeUrl] = useState("");

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let sub: PluginListenerHandle | undefined;
    
    CapApp.addListener("appUrlOpen", (data: { url: string }) => {
      const customScheme = "com.fitflowanti.app://";
      if (data.url.startsWith(customScheme)) {
        const pathAndHash = data.url.slice(customScheme.length);
        // Replace current location hash/route with the deep link target
        window.location.href = `${window.location.origin}/${pathAndHash}`;
      }
    }).then((handle) => {
      sub = handle;
    });

    return () => {
      if (sub) {
        sub.remove();
      }
    };
  }, []);

  // Web-side deep-link redirector
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("origin") === "app") {
      setIsWebBridgeRedirect(true);
      const pathAndHash = window.location.pathname + window.location.search + window.location.hash;
      const schemeUrl = `com.fitflowanti.app://${pathAndHash.replace(/^\//, "")}`;
      setAppSchemeUrl(schemeUrl);
      window.location.href = schemeUrl;
    }
  }, []);

  if (isWebBridgeRedirect) {
    return <WebBridgeRedirectPage appSchemeUrl={appSchemeUrl} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {!isConfigured ? (
          <ConfigError />
        ) : (
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<FullScreenLoader />}>
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/*" element={<ProtectedRoutes />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        )}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
