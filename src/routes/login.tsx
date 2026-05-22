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
            <h2 className="text-2xl font-semibold">Welcome back, captain</h2>
            <p className="text-sm text-muted-foreground">Sign in to your bridge</p>
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
              {busy ? "..." : "Set course"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Private project — access by invitation only.
          </p>

          <p className="text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
