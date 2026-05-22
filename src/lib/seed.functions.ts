// Seed function: populates ~200 mock customers with full marketing intelligence data.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PRODUCTS,
  scoreRecency,
  scoreFrequency,
  scoreMonetary,
  rfmTier,
  churnRisk,
  nextBestProducts,
  bestChannel,
  messageAngle,
  bestSendTime,
  currentSeason,
} from "@/lib/intelligence";

const FIRST_NAMES = [
  "Marco", "Luca", "Giulia", "Sofia", "Alessandro", "Chiara", "Matteo", "Anna",
  "Lars", "Anke", "Hans", "Greta", "Jean", "Marie", "Pierre", "Camille",
  "Erik", "Astrid", "Nils", "Freja", "James", "Emma", "Oliver", "Mia",
  "Hugo", "Léa", "Diego", "Carmen", "Tomás", "Sofía", "Klaus", "Helga",
];
const LAST_NAMES = [
  "Rossi", "Bianchi", "Müller", "Schmidt", "Lindemann", "Dubois", "Martin",
  "Andersen", "Larsen", "Nielsen", "Johansson", "Smith", "Brown", "Garcia",
  "Rodríguez", "López", "Weber", "Fischer", "Marino", "Costa",
];
const COUNTRIES = [
  { name: "Italy", city: "Genoa", lat: 44.41, lng: 8.93 },
  { name: "Italy", city: "Naples", lat: 40.85, lng: 14.27 },
  { name: "Italy", city: "Sardinia", lat: 40.12, lng: 9.01 },
  { name: "France", city: "Marseille", lat: 43.3, lng: 5.37 },
  { name: "France", city: "Nice", lat: 43.71, lng: 7.27 },
  { name: "Germany", city: "Hamburg", lat: 53.55, lng: 9.99 },
  { name: "Germany", city: "Kiel", lat: 54.32, lng: 10.13 },
  { name: "Denmark", city: "Aarhus", lat: 56.16, lng: 10.2 },
  { name: "Denmark", city: "Copenhagen", lat: 55.68, lng: 12.57 },
  { name: "Sweden", city: "Stockholm", lat: 59.33, lng: 18.06 },
  { name: "UK", city: "Southampton", lat: 50.9, lng: -1.4 },
  { name: "UK", city: "Cowes", lat: 50.76, lng: -1.3 },
  { name: "Spain", city: "Palma", lat: 39.57, lng: 2.65 },
  { name: "Spain", city: "Barcelona", lat: 41.39, lng: 2.17 },
  { name: "Netherlands", city: "Amsterdam", lat: 52.37, lng: 4.9 },
  { name: "USA", city: "Newport", lat: 41.49, lng: -71.31 },
  { name: "USA", city: "Miami", lat: 25.76, lng: -80.19 },
];
const BOAT_TYPES = ["Sailboat", "Motorboat", "RIB", "Catamaran", "Yacht"];

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    // Skip if already seeded
    const { count } = await supabase.from("customers").select("*", { count: "exact", head: true });
    if ((count ?? 0) > 50) {
      return { skipped: true, existing: count };
    }

    // Wipe partial data to be safe
    await supabase.from("recommendations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("rfm_scores").delete().neq("customer_id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("circle_activity").delete().neq("customer_id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("email_events").delete().neq("customer_id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("fb_ad_events").delete().neq("customer_id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("orders").delete().neq("customer_id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("customers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("marketing_actions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("segments").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const season = currentSeason();
    const now = Date.now();
    const customers: any[] = [];

    const COUNT = 200;
    for (let i = 0; i < COUNT; i++) {
      const first = rand(FIRST_NAMES);
      const last = rand(LAST_NAMES);
      const loc = rand(COUNTRIES);
      const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@easysea.demo`;
      const boat = Math.random() > 0.25 ? rand(BOAT_TYPES) : null;

      const orderCount = randInt(1, 12);
      const orders: any[] = [];
      const productsBought = new Set<string>();
      let ltv = 0;
      let firstOrderAt = now;
      let lastOrderAt = 0;

      for (let o = 0; o < orderCount; o++) {
        const items = [];
        const itemCount = randInt(1, 3);
        let orderTotal = 0;
        for (let k = 0; k < itemCount; k++) {
          const p = rand(PRODUCTS);
          productsBought.add(p.name);
          items.push({ name: p.name, price: p.price, image: p.image, qty: 1 });
          orderTotal += p.price;
        }
        const orderDaysAgo = randInt(5, 600);
        const orderDate = new Date(now - orderDaysAgo * 86400000);
        const discount = Math.random() > 0.6;
        if (discount) orderTotal = Math.round(orderTotal * 0.85);
        ltv += orderTotal;
        firstOrderAt = Math.min(firstOrderAt, orderDate.getTime());
        lastOrderAt = Math.max(lastOrderAt, orderDate.getTime());
        orders.push({
          total: orderTotal,
          discount_used: discount,
          line_items: items,
          created_at: orderDate.toISOString(),
        });
      }

      const tags: string[] = [];
      if (boat) tags.push(boat);
      if (productsBought.has("Olli Winch Cover")) tags.push("olli-owner");
      if (productsBought.has("Premium Fender Set")) tags.push("safety-buyer");
      if (orders.some((o) => o.discount_used) && orders.length > 2) tags.push("discount-sensitive");

      customers.push({
        _orders: orders,
        _products: [...productsBought],
        email,
        name: `${first} ${last}`,
        avatar_seed: `${first}${last}${i}`,
        shopify_id: `shop_${10000 + i}`,
        klaviyo_id: `klv_${10000 + i}`,
        circle_id: Math.random() > 0.4 ? `circle_${10000 + i}` : null,
        boat_type: boat,
        country: loc.name,
        city: loc.city,
        lat: loc.lat + (Math.random() - 0.5) * 0.6,
        lng: loc.lng + (Math.random() - 0.5) * 0.6,
        lifetime_value: ltv,
        total_orders: orderCount,
        first_order_at: new Date(firstOrderAt).toISOString(),
        last_order_at: new Date(lastOrderAt).toISOString(),
        tags,
      });
    }

    // Insert customers
    const customerRows = customers.map(({ _orders, _products, ...rest }) => rest);
    const { data: insertedCustomers, error: ce } = await supabase
      .from("customers")
      .insert(customerRows)
      .select("id, email, last_order_at, total_orders, lifetime_value");
    if (ce) throw new Error(ce.message);
    if (!insertedCustomers) throw new Error("No customers returned");

    // Map back by email
    const byEmail = new Map(insertedCustomers.map((c) => [c.email, c]));

    const orderRows: any[] = [];
    const emailRows: any[] = [];
    const fbRows: any[] = [];
    const circleRows: any[] = [];
    const rfmRows: any[] = [];
    const recRows: any[] = [];

    for (const c of customers) {
      const dbc = byEmail.get(c.email);
      if (!dbc) continue;

      // orders
      for (const o of c._orders) {
        orderRows.push({
          customer_id: dbc.id,
          shopify_order_id: `so_${Math.floor(Math.random() * 1e9)}`,
          total: o.total,
          discount_used: o.discount_used,
          line_items: o.line_items,
          created_at: o.created_at,
        });
      }

      // email events: opens + clicks
      const emailEventCount = randInt(2, 30);
      const openRate = Math.random() * 0.6 + 0.05;
      for (let i = 0; i < emailEventCount; i++) {
        const daysAgo = randInt(1, 300);
        const r = Math.random();
        const event = r < openRate ? "opened" : r < openRate + 0.2 ? "clicked" : "sent";
        emailRows.push({
          customer_id: dbc.id,
          event_type: event,
          campaign_name: rand(["Spring Drop", "Winch Care", "Fender Restock", "Loyalty Reward", "Newsletter #" + randInt(1, 24)]),
          flow_name: rand(["welcome", "post-purchase", "winback", "abandoned-cart"]),
          occurred_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
        });
      }

      // FB ad events
      const fbCount = randInt(0, 8);
      for (let i = 0; i < fbCount; i++) {
        fbRows.push({
          customer_id: dbc.id,
          campaign_name: rand(["Spring 2026 — Cold", "Retargeting — Cart", "Lookalike — Champions", "Brand Awareness"]),
          ad_set: rand(["Sailors EU", "Motorboat NA", "Yacht Premium"]),
          event_type: rand(["impression", "click", "conversion"]),
          spend: Math.round(Math.random() * 12 * 100) / 100,
          occurred_at: new Date(Date.now() - randInt(1, 180) * 86400000).toISOString(),
        });
      }

      // Circle activity
      const inCircle = c.circle_id !== null;
      const cScore = inCircle ? randInt(20, 95) : 0;
      circleRows.push({
        customer_id: dbc.id,
        posts: inCircle ? randInt(0, 25) : 0,
        comments: inCircle ? randInt(0, 80) : 0,
        reactions: inCircle ? randInt(0, 200) : 0,
        badges: inCircle && cScore > 60 ? ["Skipper", "Helpful"] : inCircle && cScore > 30 ? ["Skipper"] : [],
        last_active_at: inCircle ? new Date(Date.now() - randInt(0, 60) * 86400000).toISOString() : null,
        engagement_score: cScore,
      });

      // RFM
      const daysSinceLast = Math.max(1, Math.round((Date.now() - new Date(c.last_order_at).getTime()) / 86400000));
      const r = scoreRecency(daysSinceLast);
      const f = scoreFrequency(c.total_orders);
      const m = scoreMonetary(c.lifetime_value);
      const tier = rfmTier(r, f, m);
      const risk = churnRisk(daysSinceLast, openRate, c.total_orders);
      rfmRows.push({
        customer_id: dbc.id,
        recency_score: r,
        frequency_score: f,
        monetary_score: m,
        tier,
        churn_risk: risk,
        trend: Math.random() > 0.5 ? "improving" : "declining",
      });

      // Recommendations
      const recs = nextBestProducts(c._products, season);
      const channel = bestChannel(openRate, cScore);
      const angle = messageAngle(tier, c._products);
      const send = bestSendTime();
      for (const rec of recs) {
        recRows.push({
          customer_id: dbc.id,
          product_name: rec.name,
          product_image: PRODUCTS.find((p) => p.name === rec.name)?.image ?? "🛟",
          confidence: rec.confidence,
          reason: rec.reason,
          channel,
          best_send: send,
          angle,
          status: "pending",
        });
      }
    }

    // Bulk insert in chunks
    const chunk = async (table: string, rows: any[], size = 500) => {
      for (let i = 0; i < rows.length; i += size) {
        const { error } = await (supabase.from(table as any) as any).insert(rows.slice(i, i + size));
        if (error) throw new Error(`${table}: ${error.message}`);
      }
    };

    await chunk("orders", orderRows);
    await chunk("email_events", emailRows);
    await chunk("fb_ad_events", fbRows);
    await chunk("circle_activity", circleRows);
    await chunk("rfm_scores", rfmRows);
    await chunk("recommendations", recRows);

    // Segments
    await supabase.from("segments").insert([
      { name: "Champions", description: "RFM 555 — top sailors", rules: [{ field: "tier", op: "=", value: "Champion" }] },
      { name: "Loyal Customers", description: "Frequent repeat buyers", rules: [{ field: "tier", op: "=", value: "Loyal" }] },
      { name: "At Risk", description: "Bought well, no activity 90+ days", rules: [{ field: "tier", op: "=", value: "At Risk" }] },
      { name: "New Customers", description: "First purchase < 30 days", rules: [{ field: "first_order_days", op: "<", value: 30 }] },
      { name: "Olli Owners", description: "Bought Olli winch cover", rules: [{ field: "product", op: "includes", value: "Olli Winch Cover" }] },
      { name: "Discount Sensitive", description: "Only buys on sale", rules: [{ field: "tag", op: "=", value: "discount-sensitive" }] },
      { name: "Sailboat Fleet", description: "Sailboat owners", rules: [{ field: "boat_type", op: "=", value: "Sailboat" }] },
    ]);

    // Marketing actions
    await supabase.from("marketing_actions").insert([
      { title: "Spring reactivation — At Risk sailors", segment_name: "At Risk", channel: "Email", objective: "Reactivation", subject_line: "We miss you on the water ⛵", expected_revenue: 8400, priority: 92, status: "todo" },
      { title: "Cross-sell Mooring Kit to Fender buyers", segment_name: "Safety Buyers", channel: "Email", objective: "Cross-sell", subject_line: "Complete your dock setup", expected_revenue: 5200, priority: 81, status: "todo" },
      { title: "Champions early access — Boat Cover XL", segment_name: "Champions", channel: "Email + SMS", objective: "Upsell", subject_line: "First dibs: new Boat Cover XL", expected_revenue: 12300, priority: 88, status: "in_progress" },
      { title: "FB retargeting — abandoned cart", segment_name: "FB Clickers", channel: "Facebook", objective: "Conversion", subject_line: "—", expected_revenue: 3400, priority: 70, status: "in_progress" },
      { title: "Welcome flow refresh", segment_name: "New Customers", channel: "Email", objective: "Onboarding", subject_line: "Welcome aboard, captain", expected_revenue: 2800, priority: 60, status: "scheduled" },
      { title: "Olli winch maintenance push", segment_name: "Olli Owners", channel: "Community", objective: "Retention", subject_line: "Pre-season winch care guide", expected_revenue: 1900, priority: 55, status: "scheduled" },
      { title: "Q4 newsletter — recap & gifts", segment_name: "All", channel: "Email", objective: "Engagement", subject_line: "Best of the season", expected_revenue: 6700, priority: 50, status: "launched", launched_at: new Date(Date.now() - 7 * 86400000).toISOString() },
      { title: "Discount sensitive winter sale", segment_name: "Discount Sensitive", channel: "Email", objective: "Conversion", subject_line: "-25% — final hours", expected_revenue: 4100, priority: 65, status: "launched", launched_at: new Date(Date.now() - 14 * 86400000).toISOString() },
    ]);

    // Mark integrations as synced (mock)
    const integUpdates = [
      { id: "shopify", records: insertedCustomers.length },
      { id: "klaviyo", records: emailRows.length },
      { id: "facebook", records: fbRows.length },
      { id: "circle", records: circleRows.length },
    ];
    for (const u of integUpdates) {
      await supabase
        .from("integrations_status")
        .update({ connected: true, last_sync_at: new Date().toISOString(), records_synced: u.records, status_message: "Demo data" })
        .eq("id", u.id);
    }

    return {
      ok: true,
      customers: insertedCustomers.length,
      orders: orderRows.length,
      recommendations: recRows.length,
    };
  });
