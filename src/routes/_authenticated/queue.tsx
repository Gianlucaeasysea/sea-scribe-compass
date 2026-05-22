import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActions, updateActionStatus } from "@/lib/queries.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/queue")({
  component: Queue,
});

const COLUMNS = [
  { id: "todo", label: "Plotted" },
  { id: "in_progress", label: "Underway" },
  { id: "scheduled", label: "Scheduled" },
  { id: "launched", label: "Launched" },
];

function Queue() {
  const fetch = useServerFn(getActions);
  const update = useServerFn(updateActionStatus);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["actions"], queryFn: () => fetch({}) });

  const mut = useMutation({
    mutationFn: (v: { id: string; status: string }) => update({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["actions"] });
      toast.success("Action moved");
    },
  });

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <p className="font-mono text-xs text-primary tracking-widest">ACTION QUEUE</p>
        <h1 className="text-3xl font-semibold mt-1">Marketing voyages</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const items = (data ?? []).filter((a: any) => a.status === col.id);
          return (
            <div key={col.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{col.label}</h3>
                <span className="font-mono text-xs text-primary">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {items.map((a: any) => (
                  <div key={a.id} className="glow-card p-3 space-y-2">
                    <p className="text-sm font-medium leading-snug">{a.title}</p>
                    {a.subject_line && a.subject_line !== "—" && (
                      <p className="text-[11px] italic text-muted-foreground">"{a.subject_line}"</p>
                    )}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">{a.channel}</span>
                      <span className="font-mono text-emerald-400">€{Math.round(a.expected_revenue)}</span>
                    </div>
                    <div className="flex gap-1 pt-1">
                      {COLUMNS.filter((c) => c.id !== a.status).map((target) => (
                        <button
                          key={target.id}
                          onClick={() => mut.mutate({ id: a.id, status: target.id })}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary transition"
                        >
                          → {target.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
