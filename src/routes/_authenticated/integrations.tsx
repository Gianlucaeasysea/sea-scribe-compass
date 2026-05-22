import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIntegrations } from "@/lib/queries.functions";
import { syncShopify, syncKlaviyo, syncFacebook, syncCircle } from "@/lib/sync.functions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Loader2, RefreshCw } from "lucide-react";
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
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["integrations"], queryFn: () => fetch({}) });

  const syncFns = {
    shopify: useServerFn(syncShopify),
    klaviyo: useServerFn(syncKlaviyo),
    facebook: useServerFn(syncFacebook),
    circle: useServerFn(syncCircle),
  } as const;

  const mutation = useMutation({
    mutationFn: async (id: keyof typeof syncFns) => {
      const fn = syncFns[id];
      return { id, result: await fn({}) };
    },
    onSuccess: ({ id, result }) => {
      toast.success(`${id}: ${result.message}`);
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message.slice(0, 200)),
  });

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <p className="font-mono text-xs text-primary tracking-widest">INTEGRATIONS</p>
        <h1 className="text-3xl font-semibold mt-1">Data sources</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pull live data from Easysea's marketing stack into the bridge.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {(data ?? []).map((i: any) => {
          const meta = META[i.id] ?? { color: "#00D4FF", desc: "" };
          const isLoading = mutation.isPending && mutation.variables === i.id;
          return (
            <div key={i.id} className="glow-card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 rounded-lg grid place-items-center font-bold text-white"
                    style={{ background: meta.color }}
                  >
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
                <span className="truncate pr-2">
                  {i.connected
                    ? `${formatNumber(i.records_synced ?? 0)} records · ${i.status_message ?? "synced"}`
                    : i.status_message || "Not connected"}
                </span>
                {i.last_sync_at && <span className="font-mono shrink-0">{formatDate(i.last_sync_at)}</span>}
              </div>
              <Button
                variant={i.connected ? "outline" : "default"}
                size="sm"
                className="w-full"
                disabled={isLoading}
                onClick={() => mutation.mutate(i.id as keyof typeof syncFns)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" /> Syncing…
                  </>
                ) : i.connected ? (
                  <>
                    <RefreshCw className="size-4 mr-2" /> Sync now
                  </>
                ) : (
                  "Connect & sync"
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
