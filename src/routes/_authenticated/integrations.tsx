import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIntegrations } from "@/lib/queries.functions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: Integrations,
});

const META: Record<string, { color: string; desc: string }> = {
  shopify: { color: "#96BF48", desc: "Orders, products, customers" },
  klaviyo: { color: "#FF6B35", desc: "Email opens, clicks, flows" },
  facebook: { color: "#1877F2", desc: "Ad spend, audiences, conversions" },
  circle: { color: "#9333EA", desc: "Community posts & engagement" },
};

function Integrations() {
  const fetch = useServerFn(getIntegrations);
  const { data } = useQuery({ queryKey: ["integrations"], queryFn: () => fetch({}) });

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <p className="font-mono text-xs text-primary tracking-widest">INTEGRATIONS</p>
        <h1 className="text-3xl font-semibold mt-1">Data sources</h1>
        <p className="text-muted-foreground text-sm mt-1">Connect Easysea's marketing stack to the bridge.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {(data ?? []).map((i: any) => {
          const meta = META[i.id] ?? { color: "#00D4FF", desc: "" };
          return (
            <div key={i.id} className="glow-card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg grid place-items-center font-bold text-white" style={{ background: meta.color }}>
                    {i.name[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold">{i.name}</h3>
                    <p className="text-xs text-muted-foreground">{meta.desc}</p>
                  </div>
                </div>
                {i.connected ? (
                  <CheckCircle2 className="size-5 text-emerald-400" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{i.connected ? `${formatNumber(i.records_synced ?? 0)} records · ${i.status_message ?? "synced"}` : "Not connected"}</span>
                {i.last_sync_at && <span className="font-mono">{formatDate(i.last_sync_at)}</span>}
              </div>
              <Button
                variant={i.connected ? "outline" : "default"}
                size="sm"
                className="w-full"
                onClick={() => toast.info(`${i.name} OAuth coming soon — using demo data for now`)}
              >
                {i.connected ? "Reconfigure" : "Connect"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
