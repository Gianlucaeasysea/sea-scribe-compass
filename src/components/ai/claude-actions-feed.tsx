import { useQuery } from "@tanstack/react-query";
import { Brain, RefreshCw, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAiAnalysis } from "@/lib/ai-cache";

export type DailyAction = {
  priority_score: number;
  title: string;
  description: string;
  channel: string;
  segment: string;
  expected_revenue: string;
  effort: "low" | "medium" | "high";
  cta: string;
};

type Snapshot = Record<string, unknown>;

const EFFORT_COLOR: Record<string, string> = {
  low: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  medium: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  high: "text-orange-300 border-orange-500/40 bg-orange-500/10",
};

export function ClaudeActionsFeed({
  snapshot,
  cacheKey,
}: {
  snapshot: Snapshot;
  cacheKey: string;
}) {
  const { data, isFetching, error, refetch } = useQuery<{ actions: DailyAction[] }>({
    queryKey: ["claude-actions", cacheKey],
    queryFn: () =>
      fetchAiAnalysis<{ actions: DailyAction[] }>({
        cacheKey,
        kind: "dashboard",
        functionName: "generate-actions",
        body: { snapshot },
      }),
    enabled: !!snapshot && Object.keys(snapshot).length > 0,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  const refresh = () =>
    fetchAiAnalysis<{ actions: DailyAction[] }>({
      cacheKey,
      kind: "dashboard",
      functionName: "generate-actions",
      body: { snapshot },
      force: true,
    }).finally(() => refetch());

  const actions = (data?.actions ?? []).slice().sort((a, b) => b.priority_score - a.priority_score);

  return (
    <div className="glow-card p-6 space-y-4 border-primary/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-primary animate-pulse" />
          <h3 className="font-semibold">Azioni di oggi</h3>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
            Claude AI
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={isFetching}>
          <RefreshCw className={`size-3 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Aggiorna
        </Button>
      </div>

      {isFetching && !data && (
        <div className="py-8 text-center space-y-2">
          <Sparkles className="size-6 text-primary mx-auto animate-pulse" />
          <p className="text-xs text-muted-foreground">Sto tracciando la rotta di oggi…</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-orange-300 flex items-center gap-2">
          <AlertTriangle className="size-3" /> {(error as Error).message}
        </p>
      )}

      {actions.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {actions.map((a, i) => (
            <div
              key={i}
              className="p-4 rounded-md bg-surface-2/50 border border-border hover:border-primary/40 transition-all space-y-2"
            >
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs text-primary mt-0.5">#{a.priority_score}</span>
                <p className="text-sm font-semibold flex-1">{a.title}</p>
              </div>
              <p className="text-xs text-muted-foreground">{a.description}</p>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
                  {a.channel}
                </span>
                <span className="px-1.5 py-0.5 rounded border border-border bg-surface-2">
                  {a.segment}
                </span>
                <span className={`px-1.5 py-0.5 rounded border ${EFFORT_COLOR[a.effort]}`}>
                  effort {a.effort === "low" ? "basso" : a.effort === "medium" ? "medio" : "alto"}
                </span>
                <span className="px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                  {a.expected_revenue}
                </span>
              </div>
              <Button size="sm" variant="outline" className="w-full mt-1">
                {a.cta}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
