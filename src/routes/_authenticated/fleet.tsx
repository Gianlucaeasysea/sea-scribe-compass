import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapCustomers, updateCustomerTags, unifyCustomerProfiles } from "@/lib/queries.functions";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { Tag, Plus, X, MessageCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fleet")({
  component: Fleet,
});

const TIERS = ["Champion", "Loyal", "Potential", "New", "At Risk", "Lost"];
const PAGE_SIZE = 50;

function Fleet() {
  const fetch = useServerFn(getMapCustomers);
  const updateTags = useServerFn(updateCustomerTags);
  const unify = useServerFn(unifyCustomerProfiles);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["map"], queryFn: () => fetch({}) });
  const [q, setQ] = useState("");
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [communityFilter, setCommunityFilter] = useState<"all" | "in" | "out" | "both" | "circle_only">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const [page, setPage] = useState(1);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    (data ?? []).forEach((c: any) => (c.tags ?? []).forEach((t: string) => s.add(t)));
    return Array.from(s).sort();
  }, [data]);

  const inCommunity = (c: any) => !!c.circle_id || (c.tags ?? []).includes("circle-member");
  const isShopify = (c: any) => !!c.shopify_id;

  const rows = useMemo(() => {
    const list = data ?? [];
    const Q = q.toLowerCase();
    return list.filter((c: any) => {
      if (tierFilter && c.rfm?.tier !== tierFilter) return false;
      if (tagFilter && !(c.tags ?? []).includes(tagFilter)) return false;
      if (communityFilter === "in" && !inCommunity(c)) return false;
      if (communityFilter === "out" && inCommunity(c)) return false;
      if (communityFilter === "both" && !(inCommunity(c) && isShopify(c))) return false;
      if (communityFilter === "circle_only" && !(inCommunity(c) && !isShopify(c))) return false;
      if (!Q) return true;
      return (
        c.name?.toLowerCase().includes(Q) ||
        c.email?.toLowerCase().includes(Q) ||
        c.country?.toLowerCase().includes(Q)
      );
    });
  }, [data, q, tierFilter, tagFilter, communityFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [rows, safePage],
  );

  const refreshMut = useMutation({
    mutationFn: () => unify({}),
    onSuccess: (r: any) => {
      const unmatched: string[] = [];
      if (r.klaviyoOnly) unmatched.push(`${r.klaviyoOnly} Klaviyo`);
      if (r.circleOnly) unmatched.push(`${r.circleOnly} Circle`);
      toast.success(
        `Unified ${r.shopify} Shopify · ${r.klaviyoMatched} Klaviyo · ${r.circleMatched} Circle · ${r.facebookMatched} Facebook`,
        {
          description: unmatched.length
            ? `No Shopify match for: ${unmatched.join(", ")}`
            : "Every connector profile matched a Shopify customer.",
        },
      );
      qc.invalidateQueries({ queryKey: ["map"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const tagMut = useMutation({
    mutationFn: (vars: { id: string; tags: string[] }) => updateTags({ data: vars }),
    onSuccess: () => {
      toast.success("Tags updated");
      qc.invalidateQueries({ queryKey: ["map"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addTag = (c: any, t: string) => {
    const tag = t.trim();
    if (!tag) return;
    const tags = Array.from(new Set([...(c.tags ?? []), tag]));
    tagMut.mutate({ id: c.id, tags });
    setNewTag("");
  };
  const removeTag = (c: any, t: string) => {
    const tags = (c.tags ?? []).filter((x: string) => x !== t);
    tagMut.mutate({ id: c.id, tags });
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-primary tracking-widest">FLEET</p>
          <h1 className="text-3xl font-semibold mt-1">All sailors</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Unified profiles matched by email across Shopify, Klaviyo, Facebook & Circle.
          </p>
        </div>
        <Button
          onClick={() => refreshMut.mutate()}
          disabled={refreshMut.isPending}
          className="shrink-0"
        >
          <RefreshCw className={`size-4 mr-2 ${refreshMut.isPending ? "animate-spin" : ""}`} />
          {refreshMut.isPending ? "Refreshing…" : "Refresh & unify"}
        </Button>
      </div>

      <div className="space-y-3">
        <Input
          placeholder="Search by name, email, country…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          <Chip label="All tiers" active={tierFilter === null} onClick={() => { setTierFilter(null); setPage(1); }} />
          {TIERS.map((t) => (
            <Chip key={t} label={t} active={tierFilter === t} onClick={() => { setTierFilter(t); setPage(1); }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <MessageCircle className="size-3.5 text-muted-foreground" />
          <Chip label="All" active={communityFilter === "all"} onClick={() => { setCommunityFilter("all"); setPage(1); }} />
          <Chip label="In Circle community" active={communityFilter === "in"} onClick={() => { setCommunityFilter("in"); setPage(1); }} />
          <Chip label="Not in community" active={communityFilter === "out"} onClick={() => { setCommunityFilter("out"); setPage(1); }} />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <Tag className="size-3.5 text-muted-foreground" />
            <Chip label="Any tag" active={tagFilter === null} onClick={() => { setTagFilter(null); setPage(1); }} />
            {allTags.map((t) => (
              <Chip key={t} label={t} active={tagFilter === t} onClick={() => { setTagFilter(t); setPage(1); }} />
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {rows.length} sailor{rows.length === 1 ? "" : "s"} matched · page {safePage}/{totalPages}
        </p>
      </div>

      <div className="glow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Sailor</th>
              <th className="text-left p-3">Tier</th>
              <th className="text-left p-3">Tags</th>
              <th className="text-right p-3">LTV</th>
              <th className="text-right p-3">Orders</th>
              <th className="text-right p-3">Last order</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c: any) => (
              <tr key={c.id} className="border-t border-border hover:bg-surface-2/40 transition align-top">
                <td className="p-3">
                  <Link to="/customer/$id" params={{ id: c.id }} className="hover:text-primary">
                    <p className="font-medium flex items-center gap-1.5">
                      {c.name}
                      {inCommunity(c) && (
                        <span title="In Circle community" className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/40">
                          <MessageCircle className="size-2.5" /> Circle
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                    {(c.city || c.country) && (
                      <p className="text-[11px] text-muted-foreground">{[c.city, c.country].filter(Boolean).join(", ")}</p>
                    )}
                  </Link>
                </td>
                <td className="p-3">
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
                    {c.rfm?.tier ?? "—"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1 items-center max-w-xs">
                    {(c.tags ?? []).map((t: string) => (
                      <Badge key={t} variant="outline" className="text-[10px] gap-1 pr-1">
                        {t}
                        <button
                          onClick={() => removeTag(c, t)}
                          className="hover:text-destructive"
                          aria-label={`Remove tag ${t}`}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                    {editingId === c.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          addTag(c, newTag);
                          setEditingId(null);
                        }}
                        className="flex gap-1"
                      >
                        <Input
                          autoFocus
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onBlur={() => setEditingId(null)}
                          placeholder="tag"
                          className="h-6 text-xs w-24"
                        />
                      </form>
                    ) : (
                      <button
                        onClick={() => { setEditingId(c.id); setNewTag(""); }}
                        className="text-[10px] text-muted-foreground hover:text-primary inline-flex items-center gap-0.5"
                      >
                        <Plus className="size-3" /> tag
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-3 text-right font-mono">€{Math.round(c.lifetime_value)}</td>
                <td className="p-3 text-right font-mono text-muted-foreground">{c.total_orders}</td>
                <td className="p-3 text-right text-xs text-muted-foreground">
                  {formatDate(c.last_order_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-muted-foreground text-sm">No sailors match these filters.</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              <ChevronLeft className="size-3 mr-1" /> Prev
            </Button>
            <span className="font-mono">{safePage} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
              Next <ChevronRight className="size-3 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded-full border transition-all ${
        active
          ? "bg-primary/20 text-primary border-primary/50"
          : "text-muted-foreground border-border hover:text-foreground hover:border-primary/30"
      }`}
    >
      {label}
    </button>
  );
}
