import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCustomerProfile } from "@/lib/queries.functions";
import { ArrowLeft, Mail, MapPin, Anchor, MessageCircle, TrendingDown, ShoppingBag, LifeBuoy, AlertTriangle } from "lucide-react";
import { formatDate, formatEuro } from "@/lib/format";
import { ClaudeCustomerInsights } from "@/components/ai/claude-customer-insights";

export const Route = createFileRoute("/_authenticated/customer/$id")({
  component: CustomerProfile,
});

function CustomerProfile() {
  const { id } = useParams({ from: "/_authenticated/customer/$id" });
  const fetch = useServerFn(getCustomerProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetch({ data: { id } }),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Charting course…</div>;
  if (!data?.customer) return <div className="p-8 text-muted-foreground">Sailor not found.</div>;

  const c = data.customer;
  const opens = data.emails.filter((e: any) => e.event_type === "opened").length;
  const sent = data.emails.length;
  const openRate = sent ? Math.round((opens / sent) * 100) : 0;

  const tickets = (data as any).tickets ?? [];
  const solvedStatuses = new Set(["solved", "closed"]);
  const openStatuses = new Set(["open", "new"]);
  const ticketsSolved = tickets.filter((t: any) => solvedStatuses.has((t.status ?? "").toLowerCase())).length;
  const ticketsOpen = tickets.filter((t: any) => openStatuses.has((t.status ?? "").toLowerCase())).length;
  const badSat = tickets.some((t: any) => (t.satisfaction_rating ?? "").toLowerCase() === "bad");
  const supportRisk = ticketsOpen >= 2 || badSat;
  const ticketCountTone =
    tickets.length === 0
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
      : tickets.length <= 2
        ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
        : "bg-red-500/15 text-red-300 border-red-500/40";
  const resolutionRate = tickets.length ? Math.round((ticketsSolved / tickets.length) * 100) : 0;

  const lastOrderAt = c.last_order_at ? new Date(c.last_order_at) : null;
  const daysSince = lastOrderAt
    ? Math.max(0, Math.floor((Date.now() - lastOrderAt.getTime()) / 86_400_000))
    : 999;
  const aiCustomer = {
    id: c.id,
    name: c.name,
    email: c.email,
    country: c.country ?? undefined,
    boat_type: c.boat_type ?? undefined,
    lifetime_value: Number(c.lifetime_value ?? 0),
    last_purchase_days_ago: daysSince,
    email_open_rate: sent ? opens / sent : 0,
    circle_activity_score: data.circle?.engagement_score ?? 0,
    orders: (data.orders ?? []).slice(0, 20).map((o: any) => ({
      product: (Array.isArray(o.line_items) ? o.line_items : [])
        .map((it: any) => it.name)
        .join(" + ") || "order",
      price: Number(o.total ?? 0),
      date: typeof o.created_at === "string" ? o.created_at.slice(0, 10) : "",
    })),
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <Link to="/map" className="inline-flex items-center text-xs text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-3 mr-1" /> Back to Honeycomb
      </Link>

      <div className="glow-card p-6 flex items-start gap-6">
        <div className="size-20 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 grid place-items-center text-3xl font-mono text-primary border border-primary/40">
          {c.name?.[0] ?? "?"}
        </div>
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {c.name}
            {(c.circle_id || (c.tags ?? []).includes("circle-member")) && (
              <span title="Member of Circle community" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/40">
                <MessageCircle className="size-3" /> Circle community
              </span>
            )}
            {supportRisk && (
              <span title={`${ticketsOpen} open ticket(s)${badSat ? " · bad satisfaction" : ""}`} className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/40">
                <AlertTriangle className="size-3" /> Support risk
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="size-3" /> {c.email}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-2"><MapPin className="size-3" /> {c.city}, {c.country}</p>
          {c.boat_type && <p className="text-sm text-muted-foreground flex items-center gap-2"><Anchor className="size-3" /> {c.boat_type}</p>}
          <div className="flex gap-2 mt-2 flex-wrap">
            {(c.tags ?? []).map((t: string) => (
              <span key={t} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">{t}</span>
            ))}
          </div>
        </div>
        <div className="text-right space-y-3">
          {data.rfm && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Tier</p>
              <p className="text-xl font-semibold text-primary">{data.rfm.tier}</p>
              <p className="font-mono text-xs text-muted-foreground">RFM {data.rfm.recency_score}{data.rfm.frequency_score}{data.rfm.monetary_score}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Lifetime value" value={formatEuro(Math.round(c.lifetime_value))} />
        <Stat label="Orders" value={c.total_orders} icon={ShoppingBag} />
        <Stat label="Email open rate" value={`${openRate}%`} icon={Mail} />
        <Stat label="Churn risk" value={`${data.rfm?.churn_risk ?? 0}%`} icon={TrendingDown} tone={data.rfm && data.rfm.churn_risk > 60 ? "coral" : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glow-card p-5 lg:col-span-2 space-y-3">
          <h3 className="font-semibold">Order history</h3>
          {data.orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
          <div className="space-y-2 max-h-[420px] overflow-auto pr-2">
            {data.orders.map((o: any) => (
              <div key={o.id} className="flex items-center gap-3 p-3 rounded-md bg-surface-2/40 border border-border">
                <div className="flex-1 min-w-0">
                  <div className="flex gap-1 text-xl">
                    {(Array.isArray(o.line_items) ? o.line_items : []).map((it: any, i: number) => (
                      <span key={i} title={it.name}>{it.image}</span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(o.created_at)} · {(Array.isArray(o.line_items) ? o.line_items : []).map((it: any) => it.name).join(", ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-primary">€{Math.round(o.total)}</p>
                  {o.discount_used && <p className="text-[10px] text-amber-400 uppercase tracking-wide">Discount</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glow-card p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageCircle className="size-4 text-primary" /> Circle community
            </h3>
            {(() => {
              const inCircle = !!c.circle_id || (c.tags ?? []).includes("circle-member");
              if (!inCircle) {
                return <p className="text-xs text-muted-foreground">Not in Circle community.</p>;
              }
              const a = data.circle;
              return (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/40">
                      Active member
                    </span>
                    {c.circle_id && (
                      <span className="font-mono text-[10px] text-muted-foreground">ID {c.circle_id}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-surface-2/40 border border-border p-2">
                      <p className="text-lg font-mono text-primary">{a?.posts ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Posts</p>
                    </div>
                    <div className="rounded bg-surface-2/40 border border-border p-2">
                      <p className="text-lg font-mono text-primary">{a?.comments ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Comments</p>
                    </div>
                    <div className="rounded bg-surface-2/40 border border-border p-2">
                      <p className="text-lg font-mono text-primary">{a?.reactions ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Reactions</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Engagement</span>
                    <span className="font-mono text-primary">{a?.engagement_score ?? 0}/10</span>
                  </div>
                  {a?.last_active_at && (
                    <p className="text-[11px] text-muted-foreground">
                      Last active {formatDate(a.last_active_at)}
                    </p>
                  )}
                  {a && (a.badges ?? []).length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {(a.badges ?? []).map((b: string) => (
                        <span key={b} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">{b}</span>
                      ))}
                    </div>
                  )}
                  {!a && (
                    <p className="text-[11px] text-muted-foreground italic">
                      No engagement tracked yet — run a Circle sync to fetch activity.
                    </p>
                  )}
                </>
              );
            })()}
          </div>


          <div className="glow-card p-5 space-y-3">
            <h3 className="font-semibold">Next-best actions</h3>
            {data.recs.length === 0 && <p className="text-xs text-muted-foreground">No recommendations.</p>}
            {data.recs.map((r: any) => (
              <div key={r.id} className="p-3 rounded-md bg-surface-2/40 border border-border space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{r.product_image}</span>
                  <span className="flex-1 text-sm">{r.product_name}</span>
                  <span className="font-mono text-primary text-xs">{r.confidence}%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{r.reason}</p>
                <p className="text-[11px] text-primary">{r.channel} · {r.best_send}</p>
                <p className="text-[11px] italic text-muted-foreground">"{r.angle}"</p>
              </div>
            ))}
          </div>

          <ClaudeCustomerInsights customer={aiCustomer} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: any; icon?: any; tone?: "coral" }) {
  const color = tone === "coral" ? "text-orange-400" : "text-foreground";
  return (
    <div className="glow-card p-4 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
      </div>
      <p className={`text-2xl font-mono ${color}`}>{value}</p>
    </div>
  );
}
