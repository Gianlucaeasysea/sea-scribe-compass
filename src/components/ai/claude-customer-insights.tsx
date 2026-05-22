import { useQuery } from "@tanstack/react-query";
import { Brain, RefreshCw, Sparkles, AlertTriangle, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAiAnalysis } from "@/lib/ai-cache";

type Recommendation = {
  product: string;
  confidence: number;
  reason: string;
  message_angle: string;
};

export type CustomerAnalysis = {
  profile_summary: string;
  inferred_boat_setup: string;
  recommendations: Recommendation[];
  best_channel: string;
  best_timing: string;
  churn_risk: "low" | "medium" | "high";
  churn_reason?: string;
  action_priority: "immediate" | "this_week" | "this_month";
  suggested_subject_line: string;
};

type CustomerInput = {
  id: string;
  name: string;
  email?: string;
  country?: string;
  boat_type?: string;
  lifetime_value: number;
  last_purchase_days_ago: number;
  email_open_rate: number;
  circle_activity_score: number;
  orders: { product: string; price: number; date: string }[];
};

const RISK_COLOR: Record<string, string> = {
  low: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  medium: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  high: "text-orange-300 border-orange-500/40 bg-orange-500/10",
};

export function ClaudeCustomerInsights({ customer }: { customer: CustomerInput }) {
  const { data, isFetching, error, refetch } = useQuery<CustomerAnalysis>({
    queryKey: ["claude-customer", customer.id],
    queryFn: () =>
      fetchAiAnalysis<CustomerAnalysis>({
        cacheKey: `customer:${customer.id}:v1`,
        kind: "customer",
        functionName: "analyze-customer",
        body: { customer },
      }),
    enabled: false, // manual trigger — user runs it via the button below
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  const run = () =>
    fetchAiAnalysis<CustomerAnalysis>({
      cacheKey: `customer:${customer.id}:v1`,
      kind: "customer",
      functionName: "analyze-customer",
      body: { customer },
      force: true,
    }).finally(() => refetch());

  const hasResult = !!data;

  return (
    <div className="glow-card p-5 space-y-4 border-primary/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className={`size-4 text-primary ${isFetching ? "animate-pulse" : ""}`} />
          <h3 className="font-semibold">Insight AI Claude</h3>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
            powered by Claude
          </span>
        </div>
        {hasResult && (
          <Button size="sm" variant="ghost" onClick={run} disabled={isFetching}>
            <RefreshCw className={`size-3 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Aggiorna
          </Button>
        )}
      </div>

      {!hasResult && !isFetching && (
        <div className="py-6 text-center space-y-3">
          <Sparkles className="size-6 text-primary mx-auto" />
          <p className="text-xs text-muted-foreground">
            Genera un'analisi AI su misura per questo velista, on demand.
          </p>
          <Button size="sm" onClick={run} disabled={isFetching}>
            <Brain className="size-3.5 mr-1.5" /> Esegui analisi Claude
          </Button>
        </div>
      )}

      {isFetching && (
        <div className="py-8 text-center space-y-2">
          <Sparkles className="size-6 text-primary mx-auto animate-pulse" />
          <p className="text-xs text-muted-foreground">Analisi dati cliente in corso…</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-orange-300 flex items-center gap-2">
          <AlertTriangle className="size-3" /> {(error as Error).message}
        </p>
      )}

      {data && (
        <div className="space-y-4">
          <p className="text-sm text-foreground/90 leading-relaxed">{data.profile_summary}</p>
          <p className="text-xs text-muted-foreground italic">{data.inferred_boat_setup}</p>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className={`px-2 py-1 rounded border ${RISK_COLOR[data.churn_risk]}`}>
              Churn: {data.churn_risk === "low" ? "basso" : data.churn_risk === "medium" ? "medio" : "alto"}
            </span>
            <span className="px-2 py-1 rounded border border-primary/30 bg-primary/10 text-primary">
              {data.action_priority === "immediate" ? "immediato" : data.action_priority === "this_week" ? "questa settimana" : "questo mese"}
            </span>
            <span className="px-2 py-1 rounded border border-border bg-surface-2/40">
              tramite {data.best_channel}
            </span>
          </div>

          {data.churn_reason && data.churn_risk !== "low" && (
            <p className="text-[11px] text-muted-foreground">↳ {data.churn_reason}</p>
          )}

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Prossime mosse</p>
            {data.recommendations.map((r, i) => (
              <div key={i} className="p-3 rounded-md bg-surface-2/40 border border-border space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium flex-1">{r.product}</span>
                  <span className="font-mono text-xs text-primary">
                    {Math.round(r.confidence * 100)}%
                  </span>
                </div>
                <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/40"
                    style={{ width: `${Math.round(r.confidence * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">{r.reason}</p>
                <p className="text-[11px] italic text-primary/80">"{r.message_angle}"</p>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-border space-y-2">
            <div className="flex items-start gap-2 text-xs">
              <Mail className="size-3 mt-0.5 text-primary" />
              <div>
                <p className="text-muted-foreground">Oggetto email</p>
                <p className="font-medium">{data.suggested_subject_line}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <Clock className="size-3 mt-0.5 text-primary" />
              <div>
                <p className="text-muted-foreground">Timing migliore</p>
                <p>{data.best_timing}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
