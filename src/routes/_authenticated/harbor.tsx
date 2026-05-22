import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSegments } from "@/lib/queries.functions";
import { Layers } from "lucide-react";

export const Route = createFileRoute("/_authenticated/harbor")({
  component: Harbor,
});

function Harbor() {
  const fetch = useServerFn(getSegments);
  const { data } = useQuery({ queryKey: ["segments"], queryFn: () => fetch({}) });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <p className="font-mono text-xs text-primary tracking-widest">SEGMENTI</p>
        <h1 className="text-3xl font-semibold mt-1">Segmenti clienti</h1>
        <p className="text-muted-foreground text-sm mt-1">Le flotte di clienti che hai definito.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.segments ?? []).map((s: any) => (
          <div key={s.id} className="glow-card p-5 hover:translate-y-[-2px] transition cursor-pointer">
            <div className="flex items-start justify-between">
              <Layers className="size-5 text-primary" />
              <span className="font-mono text-xs text-muted-foreground">
                ~{(s.customer_count ?? data?.tierCounts?.[s.name] ?? 0).toLocaleString("it-IT")} clienti
              </span>
            </div>
            <h3 className="font-semibold mt-3">{s.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
            {s.avg_ltv > 0 && (
              <p className="text-[11px] text-primary mt-2 font-mono">
                LTV medio €{Math.round(s.avg_ltv).toLocaleString("it-IT")}
              </p>
            )}
          </div>
        ))}
        {(!data?.segments || data.segments.length === 0) && (
          <p className="text-sm text-muted-foreground col-span-3 text-center py-12">
            Nessun segmento. Carica la demo flotta dai Connettori.
          </p>
        )}
      </div>
    </div>
  );
}
