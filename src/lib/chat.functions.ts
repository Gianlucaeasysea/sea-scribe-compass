import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

type ChatMsg = { role: "user" | "assistant"; content: string };

async function buildBusinessSnapshot() {
  // Paginate where rows can exceed 1000
  async function paginate<T>(table: string, columns: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select(columns)
        .range(from, from + 999);
      if (error) break;
      if (!data || data.length === 0) break;
      out.push(...(data as T[]));
      if (data.length < 1000) break;
    }
    return out;
  }

  const [
    { count: totalCustomers },
    customers,
    rfm,
    actions,
    integrations,
    recentOrders,
    segments,
    tickets,
  ] = await Promise.all([
    supabaseAdmin.from("customers").select("*", { count: "exact", head: true }),
    paginate<{
      lifetime_value: number;
      total_orders: number;
      boat_type: string | null;
      country: string | null;
      tags: string[] | null;
      community_join_date: string | null;
      last_order_at: string | null;
    }>("customers", "lifetime_value, total_orders, boat_type, country, tags, community_join_date, last_order_at"),
    paginate<{ tier: string; churn_risk: number }>("rfm_scores", "tier, churn_risk"),
    supabaseAdmin.from("marketing_actions").select("title, segment_name, channel, status, expected_revenue, priority"),
    supabaseAdmin.from("integrations_status").select("id, name, connected, records_synced, last_sync_at"),
    supabaseAdmin
      .from("orders")
      .select("total, created_at, line_items")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin.from("segments").select("name, description, customer_count, avg_ltv"),
    supabaseAdmin.from("zendesk_tickets").select("status, priority, satisfaction_rating").limit(500),
  ]);

  const totalRevenue = customers.reduce((s, c) => s + Number(c.lifetime_value || 0), 0);
  const paying = customers.filter((c) => Number(c.lifetime_value) > 0);
  const avgLtvPaying = paying.length ? totalRevenue / paying.length : 0;

  const tierCounts: Record<string, number> = {};
  rfm.forEach((r) => (tierCounts[r.tier] = (tierCounts[r.tier] ?? 0) + 1));

  const countryCounts: Record<string, number> = {};
  customers.forEach((c) => {
    const k = c.country || "unknown";
    countryCounts[k] = (countryCounts[k] ?? 0) + 1;
  });
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const boatCounts: Record<string, number> = {};
  customers.forEach((c) => {
    const k = c.boat_type || "unknown";
    boatCounts[k] = (boatCounts[k] ?? 0) + 1;
  });

  const productCounts: Record<string, number> = {};
  const last30Revenue = (recentOrders.data ?? []).reduce(
    (s, o) => s + Number((o as any).total || 0),
    0,
  );
  (recentOrders.data ?? []).forEach((o: any) => {
    const items = Array.isArray(o.line_items) ? o.line_items : [];
    items.forEach((it: any) => {
      const name = it.name || "Unknown";
      productCounts[name] = (productCounts[name] ?? 0) + 1;
    });
  });
  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const circleMembers = customers.filter(
    (c) =>
      (c.tags ?? []).includes("circle-member") || !!c.community_join_date,
  ).length;

  const ticketStats: Record<string, number> = {};
  (tickets.data ?? []).forEach((t: any) => {
    const k = t.status || "unknown";
    ticketStats[k] = (ticketStats[k] ?? 0) + 1;
  });

  return {
    customers: {
      total: totalCustomers ?? 0,
      paying: paying.length,
      total_revenue_eur: Math.round(totalRevenue),
      avg_ltv_paying_eur: Math.round(avgLtvPaying),
      circle_members: circleMembers,
      by_boat_type: boatCounts,
      top_countries: topCountries,
    },
    rfm_tiers: tierCounts,
    segments: segments.data ?? [],
    integrations: integrations.data ?? [],
    marketing_actions: actions.data ?? [],
    recent_50_orders_revenue_eur: Math.round(last30Revenue),
    top_products_recent: topProducts,
    zendesk_tickets_by_status: ticketStats,
    generated_at: new Date().toISOString(),
  };
}

const SYSTEM = `Sei l'analista marketing AI di Easysea, brand italiano premium di accessori nautici (Olli, Jake Poles, Way2, Flipper, Copriwinch).

Ricevi all'inizio della conversazione uno snapshot JSON aggiornato con tutti i dati del business: clienti, segmenti RFM, ordini recenti, prodotti top, connettori sincronizzati, ticket Zendesk, azioni marketing pianificate.

Il tuo ruolo:
- Rispondere a qualsiasi domanda sui dati con numeri precisi presi dallo snapshot.
- Creare report, analisi, riassunti, confronti tra segmenti, ipotesi di campagne.
- Suggerire azioni marketing concrete con stima impatto.
- Quando ti viene chiesto un "report", strutturalo con titoli markdown (##), bullet, tabelle e una sezione finale "Azioni consigliate".

RISPONDI SEMPRE IN ITALIANO. Usa markdown (titoli, liste, **grassetto**, tabelle) per leggibilità. Usa il simbolo € per i valori. Se un dato non è nello snapshot, dillo esplicitamente invece di inventare.`;

export const chatWithClaude = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(8000),
            }),
          )
          .min(1)
          .max(40),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY non configurata");

    const snapshot = await buildBusinessSnapshot();

    const messages: ChatMsg[] = data.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Prepend the snapshot as a synthetic first user turn so Claude has full context
    const firstUser: ChatMsg = {
      role: "user",
      content: `Ecco lo snapshot aggiornato dei dati Easysea (in JSON):\n\n\`\`\`json\n${JSON.stringify(
        snapshot,
        null,
        2,
      )}\n\`\`\`\n\nUsa questi dati come base per rispondere alle mie domande successive.`,
    };
    const ack: ChatMsg = {
      role: "assistant",
      content:
        "Snapshot ricevuto. Sono pronto a rispondere a domande sui clienti, segmenti, ordini, prodotti, community Circle, ticket di supporto e azioni marketing. Cosa vuoi sapere?",
    };

    const body = {
      model: MODEL,
      max_tokens: 2500,
      system: SYSTEM,
      messages: [firstUser, ack, ...messages],
    };

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = await res.json();
    const reply =
      (json?.content ?? [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n") || "(nessuna risposta)";

    return {
      reply,
      snapshot_summary: {
        clienti: snapshot.customers.total,
        paganti: snapshot.customers.paying,
        ricavi_totali: snapshot.customers.total_revenue_eur,
        community: snapshot.customers.circle_members,
        generato_alle: snapshot.generated_at,
      },
    };
  });
