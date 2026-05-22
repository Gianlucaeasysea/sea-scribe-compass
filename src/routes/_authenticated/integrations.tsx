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
  syncZendesk,
  syncGsheetBoats,
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
import { Loader2, RefreshCw, Package } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/format";
import { relativeTimeIT, translateStatusMessage } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: Integrations,
});

type IntegrationId = "shopify" | "klaviyo" | "facebook" | "circle" | "zendesk" | "gsheet_boats";

const META: Record<IntegrationId, { color: string; desc: string }> = {
  shopify: { color: "#96BF48", desc: "Orders, products, customers" },
  klaviyo: { color: "#FF6B35", desc: "Email opens, clicks, flows" },
  facebook: { color: "#1877F2", desc: "Ad spend, audiences, conversions" },
  circle: { color: "#9333EA", desc: "Community posts & engagement" },
  zendesk: { color: "#03363D", desc: "Support tickets & satisfaction" },
  gsheet_boats: { color: "#0F9D58", desc: "Community boat details — type, model, lead status. Sheet must be shared publicly (view only) for sync to work." },
};

type FieldDef = { key: string; label: string; placeholder?: string; type?: string; defaultValue?: string };

const CREDENTIAL_FORMS: Partial<Record<IntegrationId, {
  title: string;
  description: string;
  help: string;
  fields: FieldDef[];
}>> = {
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
  zendesk: {
    title: "Connect Zendesk",
    description: "Enter your Zendesk API credentials",
    help: "Find these in Zendesk Admin Center → Apps and integrations → APIs → Zendesk API → Settings.",
    fields: [
      { key: "subdomain", label: "Subdomain", placeholder: "easysea" },
      { key: "email", label: "Admin email", placeholder: "admin@yourstore.com" },
      { key: "api_token", label: "API token", placeholder: "xxx...", type: "password" },
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
    zendesk: useServerFn(syncZendesk),
    gsheet_boats: useServerFn(syncGsheetBoats),
  } as const;

  const saveCreds = useServerFn(saveIntegrationCredentials);

  const [openId, setOpenId] = useState<IntegrationId | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mutation = useMutation({
    mutationFn: async (id: IntegrationId) => {
      if (id !== "shopify") return { id, result: await syncFns[id]({}) };

      const shopifyFn = syncFns.shopify;
      let result: any = await shopifyFn({ data: {} });
      while (result?.ok && !result.done) {
        qc.invalidateQueries({ queryKey: ["integrations"] });
        result = await shopifyFn({
          data: {
            nextCustomersPath: result.nextCustomersPath,
            nextOrdersPath: result.nextOrdersPath,
            productCount: result.productCount,
            customersSynced: result.customersSynced,
            ordersSynced: result.ordersSynced,
          },
        });
      }
      return { id, result };
    },
    onSuccess: ({ id, result }) => {
      toast.success(`${id}: ${result.message}`);
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message.slice(0, 200)),
  });

  const openConnect = (id: IntegrationId) => {
    const form = CREDENTIAL_FORMS[id];
    if (!form) {
      // No credentials needed — sync immediately
      mutation.mutate(id);
      return;
    }
    const defaults: Record<string, string> = {};
    for (const f of form.fields) {
      if (f.defaultValue) defaults[f.key] = f.defaultValue;
    }
    setValues(defaults);
    setError(null);
    setOpenId(id);
  };

  const handleSaveCredentials = async () => {
    if (!openId) return;
    const form = CREDENTIAL_FORMS[openId];
    if (!form) return;
    setBusy(true);
    setError(null);
    const id = openId;
    try {
      // Require all fields filled
      const missing = form.fields.filter((f) => !values[f.key]?.trim());
      if (missing.length) {
        throw new Error(`Missing: ${missing.map((m) => m.label).join(", ")}`);
      }
      await saveCreds({ data: { id: id as any, credentials: values } });
      qc.invalidateQueries({ queryKey: ["integrations"] });
      setOpenId(null);
      toast.success("Credentials saved — syncing now…");
      // Auto-trigger the first sync so the user doesn't have to click again
      mutation.mutate(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const form = openId ? CREDENTIAL_FORMS[openId] ?? null : null;

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <p className="font-mono text-xs text-primary tracking-widest">CONNETTORI</p>
        <h1 className="text-3xl font-semibold mt-1">Sorgenti dati</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Importa i dati live dello stack marketing di Easysea nella bridge.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {(data ?? []).map((i: any) => {
          const id = i.id as IntegrationId;
          const meta = META[id] ?? { color: "#00D4FF", desc: "" };
          const isLoading = mutation.isPending && mutation.variables === id;
          const rawMsg: string = i.status_message ?? "";
          const msg = translateStatusMessage(rawMsg);
          const lower = rawMsg.toLowerCase();
          const isWarn =
            lower.includes("not configured") || lower.includes("not connected");
          const isError =
            !isWarn &&
            (lower.includes("non valido") ||
              lower.includes("invalid") ||
              lower.includes("error") ||
              lower.includes("failed") ||
              lower.includes("exceeded"));
          const statusTone = isError
            ? "text-destructive"
            : isWarn
              ? "text-amber-400"
              : i.connected
                ? "text-emerald-400"
                : "text-muted-foreground";
          return (
            <div
              key={i.id}
              className="glow-card p-5 space-y-3 relative overflow-hidden"
              style={{ borderLeft: `3px solid ${meta.color}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="size-10 rounded-lg grid place-items-center font-bold text-white shrink-0"
                    style={{ background: meta.color }}
                  >
                    {i.name[0]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold flex items-center gap-2">
                      {i.name}
                      <span className="relative inline-flex">
                        <span
                          className={`size-2 rounded-full ${i.connected ? "bg-emerald-400" : "bg-muted-foreground/50"}`}
                        />
                        {i.connected && (
                          <span className="absolute inset-0 size-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
                        )}
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground">{meta.desc}</p>
                    {msg && (
                      <p className={`text-xs mt-1 break-words ${statusTone}`}>
                        {msg}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                <span className="inline-flex items-center gap-1 truncate">
                  <Package className="size-3" />
                  {i.connected
                    ? `${formatNumber(i.records_synced ?? 0)} record`
                    : "In attesa prima sync"}
                </span>
                {i.last_sync_at && (
                  <span className="font-mono shrink-0">
                    Ultima sync: {relativeTimeIT(i.last_sync_at)}
                  </span>
                )}
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
                      <Loader2 className="size-4 mr-2 animate-spin" /> Sincronizzazione…
                    </>
                  ) : i.connected ? (
                    <>
                      <RefreshCw className="size-4 mr-2" /> Sincronizza ora
                    </>
                  ) : (
                    "Connetti e sincronizza"
                  )}
                </Button>
                {CREDENTIAL_FORMS[id] && (
                  <Button variant="ghost" size="sm" onClick={() => openConnect(id)}>
                    Modifica credenziali
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
                <Button onClick={handleSaveCredentials} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save credentials"
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
