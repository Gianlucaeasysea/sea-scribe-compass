import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, Users, Globe, Anchor, Zap, BarChart2, Plug, LogOut, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { searchCustomers } from "@/lib/queries.functions";

const NAV = [
  { to: "/dashboard",    label: "Panoramica",  icon: LayoutDashboard, key: "D" },
  { to: "/fleet",        label: "Clienti",     icon: Users,           key: "F" },
  { to: "/map",          label: "Mappa",       icon: Globe,           key: "M" },
  { to: "/harbor",       label: "Segmenti",    icon: Anchor,          key: "H" },
  { to: "/queue",        label: "Azioni",      icon: Zap,             key: "Q" },
  { to: "/analytics",    label: "Analisi",     icon: BarChart2,       key: "A" },
  { to: "/integrations", label: "Connettori",  icon: Plug,            key: "I" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [q, setQ] = useState("");
  const search = useServerFn(searchCustomers);
  const { data: results } = useQuery({
    queryKey: ["search", q],
    queryFn: () => search({ data: { q } }),
    enabled: q.length > 1,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen flex bg-background grid-bg">
      <aside
        className="w-[220px] shrink-0 flex flex-col"
        style={{
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <div
          className="p-5 flex flex-col items-start gap-2"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <img
            src="https://easysea.org/cdn/shop/files/Logo_Easysea_280x80_nero.png?v=1738336409&width=280"
            alt="Easysea"
            className="easysea-logo h-7 w-auto max-w-[140px] object-contain"
          />
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            Marketing Intelligence
          </span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className="group flex items-center gap-3 pl-3 pr-3 py-2.5 text-sm transition-all"
                style={
                  active
                    ? {
                        borderLeft: "3px solid var(--brand-accent)",
                        background: "var(--brand-accent-glow)",
                        color: "var(--brand-accent)",
                        paddingLeft: "calc(0.75rem - 3px)",
                      }
                    : {
                        borderLeft: "3px solid transparent",
                        color: "var(--text-secondary)",
                        paddingLeft: "calc(0.75rem - 3px)",
                      }
                }
              >
                <Icon className="size-4" />
                <span className="flex-1">{n.label}</span>
                <kbd className="text-[10px] font-mono opacity-40">{n.key}</kbd>
              </Link>
            );
          })}
        </nav>
        <div
          className="p-3 space-y-2"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <button
            onClick={() => setCmdOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground bg-surface-2 hover:text-foreground transition"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Cerca clienti</span>
            <kbd className="text-[10px] font-mono">⌘K</kbd>
          </button>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="size-7 rounded-full bg-primary/20 grid place-items-center text-[11px] font-mono text-primary">
              {(user?.email ?? "C").slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate text-foreground">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => signOut()} title="Disembark">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search customers, segments, actions…" value={q} onValueChange={setQ} />
        <CommandList>
          <CommandEmpty>No matches in the fleet.</CommandEmpty>
          {results && results.length > 0 && (
            <CommandGroup heading="Customers">
              {results.map((r: any) => (
                <CommandItem
                  key={r.id}
                  onSelect={() => {
                    setCmdOpen(false);
                    navigate({ to: "/customer/$id", params: { id: r.id } });
                  }}
                >
                  <span className="flex-1">{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Navigate">
            {NAV.map((n) => (
              <CommandItem key={n.to} onSelect={() => { setCmdOpen(false); navigate({ to: n.to }); }}>
                <n.icon className="size-4 mr-2" /> {n.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
