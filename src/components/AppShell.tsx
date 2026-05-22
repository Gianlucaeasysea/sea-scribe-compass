import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  Anchor, Compass, Hexagon, Users, Layers, ListTodo, BarChart3, Plug, LogOut, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { searchCustomers } from "@/lib/queries.functions";

const NAV = [
  { to: "/dashboard", label: "Bridge", icon: Compass, key: "D" },
  { to: "/map", label: "Honeycomb", icon: Hexagon, key: "M" },
  { to: "/fleet", label: "Fleet", icon: Users, key: "F" },
  { to: "/harbor", label: "Harbor", icon: Layers, key: "H" },
  { to: "/queue", label: "Action Queue", icon: ListTodo, key: "Q" },
  { to: "/analytics", label: "Charts", icon: BarChart3, key: "A" },
  { to: "/integrations", label: "Integrations", icon: Plug, key: "I" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
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
      <aside className="w-60 border-r border-border bg-surface/40 backdrop-blur flex flex-col">
        <div className="p-5 flex items-center gap-2 border-b border-border">
          <Anchor className="size-5 text-primary" />
          <span className="font-mono text-xs tracking-widest text-foreground">SEAMARKETING</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                  active
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                }`}
              >
                <Icon className="size-4" />
                <span className="flex-1">{n.label}</span>
                <kbd className="text-[10px] font-mono opacity-40">{n.key}</kbd>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border space-y-2">
          <button
            onClick={() => setCmdOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground bg-surface-2 hover:text-foreground transition"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Search fleet</span>
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
