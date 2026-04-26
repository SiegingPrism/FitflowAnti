import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { Sparkles, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedBackground } from "@/components/theme/AnimatedBackground";
import { toast } from "sonner";

const emailSchema = z.string().trim().email({ message: "Enter a valid email address" }).max(255);
const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password is too long" });

type Mode = "signin" | "signup" | "forgot";

const AuthPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && session) navigate("/", { replace: true });
  }, [session, authLoading, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const parsedEmail = emailSchema.safeParse(email);
      if (!parsedEmail.success) {
        toast.error(parsedEmail.error.issues[0].message);
        return;
      }

      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your inbox for a reset link.");
        setMode("signin");
        return;
      }

      const parsedPw = passwordSchema.safeParse(password);
      if (!parsedPw.success) {
        toast.error(parsedPw.error.issues[0].message);
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsedEmail.data,
          password: parsedPw.data,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name.trim() || undefined },
          },
        });
        if (error) throw error;
        toast.success("Account created — check your email to verify before signing in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsedEmail.data,
          password: parsedPw.data,
        });
        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            toast.error("Please verify your email first. Check your inbox.");
          } else if (error.message.toLowerCase().includes("invalid login")) {
            toast.error("Wrong email or password.");
          } else {
            toast.error(error.message);
          }
          return;
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Couldn't sign in with Google. Please try again.");
        return;
      }
      // result.redirected → browser is navigating away
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <AnimatedBackground />
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10">
      <AnimatedBackground />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center text-3xl shadow-elevated">
            🌐
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mt-4">
            {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {mode === "signup"
              ? "Your tasks, habits, and progress — synced everywhere."
              : mode === "forgot"
                ? "We'll send a reset link to your inbox."
                : "Sign in to continue your flow."}
          </p>
        </div>

        <div className="glass-card">
          {mode !== "forgot" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 font-semibold"
                onClick={handleGoogle}
                disabled={busy}
              >
                <GoogleIcon className="w-4 h-4 mr-2" />
                Continue with Google
              </Button>
              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Display name (optional)</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                  maxLength={64}
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={8}
                />
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full h-11 bg-gradient-primary font-semibold">
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between text-xs">
            {mode === "signin" ? (
              <>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-muted-foreground hover:text-foreground transition-smooth"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-primary font-semibold hover:underline"
                >
                  Create account
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-primary font-semibold hover:underline mx-auto"
              >
                ← Back to sign in
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3" /> Encrypted, private, yours.
        </p>
      </motion.div>
    </div>
  );
};

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default AuthPage;
