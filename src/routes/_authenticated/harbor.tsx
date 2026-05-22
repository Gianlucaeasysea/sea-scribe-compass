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
        <p className="font-mono text-xs text-primary tracking-widest">THE HARBOR</p>
        <h1 className="text-3xl font-semibold mt-1">Saved segments</h1>
        <p className="text-muted-foreground text-sm mt-1">Where your defined fleets drop anchor.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.segments ?? []).map((s: any) => (
          <div key={s.id} className="glow-card p-5 hover:translate-y-[-2px] transition cursor-pointer">
            <div className="flex items-start justify-between">
              <Layers className="size-5 text-primary" />
              <span className="font-mono text-xs text-muted-foreground">
                ~{data?.tierCounts?.[s.name] ?? Math.floor((data?.totalCustomers ?? 0) / 6)} sailors
              </span>
            </div>
            <h3 className="font-semibold mt-3">{s.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
          </div>
        ))}
        {(!data?.segments || data.segments.length === 0) && (
          <p className="text-sm text-muted-foreground col-span-3 text-center py-12">
            No segments yet. Load the demo fleet from The Bridge.
          </p>
        )}
      </div>
    </div>
  );
}
