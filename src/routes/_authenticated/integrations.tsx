import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getIntegrations } from "@/lib/queries.functions";
import {
  syncShopify,
  syncKlaviyo,
  syncFacebook,
  syncCircle,
  saveIntegrationCredentials,
} from "@/lib/sync.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, Circle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: Integrations,
});

type IntegrationId = "shopify" | "klaviyo" | "facebook" | "circle";

const META: Record<IntegrationId, { color: string; desc: string }> = {
  shopify: { color: "#96BF48", desc: "Orders, products, customers" },
  klaviyo: { color: "#FF6B35", desc: "Email opens, clicks, flows" },
  facebook: { color: "#1877F2", desc: "Ad spend, audiences, conversions" },
  circle: { color: "#9333EA", desc: "Community posts & engagement" },
};

type FieldDef = { key: string; label: string; placeholder?: string; type?: string; defaultValue?: string };

const CREDENTIAL_FORMS: Record<IntegrationId, {
  title: string;
  description: string;
  help: string;
  fields: FieldDef[];
}> = {
  shopify: {
    title: "Connect Shopify",
    description: "Enter your Shopify Admin API credentials",
    help: "Find this in Shopify Admin → Apps → Develop apps → your app → API credentials",
    fields: [
      { key: "shop_domain", label: "Store domain", placeholder: "yourstore.myshopify.com", defaultValue: "easysea-design-lab.myshopify.com" },
      { key: "access_token", label: "Admin API Access Token", placeholder: "shpat_...", type: "password" },
    ],
  },
  klaviyo: {
    title: "Connect Klaviyo",
    description: "Enter your Klaviyo Private API key",
    help: "Find this in Klaviyo → Settings → API keys → Create Private API Key",
    fields: [{ key: "api_key", label: "Private API key", placeholder: "pk_...", type: "password" }],
  },
  facebook: {
    title: "Connect Facebook Ads",
    description: "Enter your Meta Marketing API credentials",
    help: "Generate a long-lived access token from Meta Business Suite → System Users → Generate Token (ads_read scope).",
    fields: [
      { key: "access_token", label: "Access token", placeholder: "EAAB...", type: "password" },
      { key: "ad_account_id", label: "Ad account ID", placeholder: "act_1234567890" },
    ],
  },
  circle: {
    title: "Connect Circle",
    description: "Enter your Circle API credentials",
    help: "Find these in Circle → Settings → API & Webhooks.",
    fields: [
      { key: "api_token", label: "API token", placeholder: "circle_...", type: "password" },
      { key: "community_id", label: "Community ID", placeholder: "12345" },
    ],
  },
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

  const saveCreds = useServerFn(saveIntegrationCredentials);

  const [openId, setOpenId] = useState<IntegrationId | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mutation = useMutation({
    mutationFn: async (id: IntegrationId) => {
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

  const openConnect = (id: IntegrationId) => {
    const defaults: Record<string, string> = {};
    for (const f of CREDENTIAL_FORMS[id].fields) {
      if (f.defaultValue) defaults[f.key] = f.defaultValue;
    }
    setValues(defaults);
    setError(null);
    setOpenId(id);
  };

  const handleSaveAndConnect = async () => {
    if (!openId) return;
    setBusy(true);
    setError(null);
    try {
      // Require all fields filled
      const missing = CREDENTIAL_FORMS[openId].fields.filter((f) => !values[f.key]?.trim());
      if (missing.length) {
        throw new Error(`Missing: ${missing.map((m) => m.label).join(", ")}`);
      }
      await saveCreds({ data: { id: openId, credentials: values } });
      const result = await syncFns[openId]({});
      if (!result.ok) throw new Error(result.message);
      toast.success(`${openId}: ${result.message}`);
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpenId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const form = openId ? CREDENTIAL_FORMS[openId] : null;

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
          const id = i.id as IntegrationId;
          const meta = META[id] ?? { color: "#00D4FF", desc: "" };
          const isLoading = mutation.isPending && mutation.variables === id;
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
              <div className="flex gap-2">
                <Button
                  variant={i.connected ? "outline" : "default"}
                  size="sm"
                  className="flex-1"
                  disabled={isLoading}
                  onClick={() => {
                    if (i.connected) mutation.mutate(id);
                    else openConnect(id);
                  }}
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
                {i.connected && CREDENTIAL_FORMS[id] && (
                  <Button variant="ghost" size="sm" onClick={() => openConnect(id)}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog
        open={openId !== null}
        onOpenChange={(o) => {
          if (!o && !busy) setOpenId(null);
        }}
      >
        <DialogContent>
          {form && (
            <>
              <DialogHeader>
                <DialogTitle>{form.title}</DialogTitle>
                <DialogDescription>{form.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {form.fields.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={`cred-${f.key}`}>{f.label}</Label>
                    <Input
                      id={`cred-${f.key}`}
                      type={f.type ?? "text"}
                      placeholder={f.placeholder}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      autoComplete="off"
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">{form.help}</p>
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">
                    {error}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenId(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={handleSaveAndConnect} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" /> Connecting…
                    </>
                  ) : (
                    "Save & Connect"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
