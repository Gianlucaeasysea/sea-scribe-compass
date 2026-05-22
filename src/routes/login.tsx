import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Anchor, Compass } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/dashboard" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleEmail = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-[oklch(0.2_0.05_258)] via-[oklch(0.18_0.06_240)] to-[oklch(0.14_0.03_260)] p-12 flex-col justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Anchor className="size-6" />
          <span className="font-mono text-sm tracking-widest">SEAMARKETING HUB</span>
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Compass className="size-12 text-primary animate-[spin_24s_linear_infinite]" />
            <div>
              <h1 className="text-4xl font-semibold text-foreground tracking-tight">
                Navigate every customer.
              </h1>
              <p className="text-muted-foreground mt-2 max-w-md">
                Marine marketing intelligence — Shopify, Klaviyo, Facebook Ads & Circle, unified.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            {["Champion fleet", "At Risk signal", "Next-best action"].map((s) => (
              <div key={s} className="glow-card p-3 text-xs text-muted-foreground">
                {s}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          Easysea · Repeat sales engine
        </p>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">
              {mode === "signin" ? "Welcome back, captain" : "Set sail with us"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signin" ? "Sign in to your bridge" : "Create your bridge account"}
            </p>
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            <svg className="size-4 mr-2" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.2C40.8 35 44 29.9 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or email</span>
            </div>
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="captain@easysea.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "..." : mode === "signin" ? "Set course" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already aboard?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary hover:underline"
            >
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
