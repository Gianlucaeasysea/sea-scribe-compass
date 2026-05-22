// Sync functions: fetch live data from Shopify, Klaviyo, Facebook Ads, Circle
// and upsert into Supabase. Each function returns a small summary used by the UI.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";



const SHOP_DOMAIN = "easysea-design-lab.myshopify.com";

async function markStatus(
  id: string,
  name: string,
  connected: boolean,
  records: number,
  message: string,
) {
  await supabaseAdmin
    .from("integrations_status")
    .upsert(
      {
        id,
        name,
        connected,
        records_synced: records,
        status_message: message,
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
}

// ---------- Shopify ----------
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shopifyFetch(path: string) {
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) throw new Error("SHOPIFY_ACCESS_TOKEN not configured");
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    res = await fetch(`https://${SHOP_DOMAIN}/admin/api/2025-07/${path}`, {
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    });
    if (res.status !== 429) break;
    const retryAfter = Number(res.headers.get("retry-after") ?? "1");
    await sleep(Math.max(retryAfter, 1) * 1000);
  }
  if (!res) throw new Error(`Shopify ${path}: no response`);
  if (!res.ok) {
    const err: any = new Error(`Shopify ${path}: ${res.status} ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return { json: await res.json(), link: res.headers.get("link") };
}

function getNextShopifyPath(linkHeader: string | null) {
  const nextLink = linkHeader?.split(",").find((part) => part.includes('rel="next"'));
  const match = nextLink?.match(/<([^>]+)>/);
  if (!match) return null;
  const url = new URL(match[1]);
  return `${url.pathname.split("/admin/api/2025-07/")[1]}${url.search}`;
}

async function fetchAllShopifyRecords<T>(initialPath: string, key: string) {
  const records: T[] = [];
  let nextPath: string | null = initialPath;
  while (nextPath) {
    const { json, link } = await shopifyFetch(nextPath);
    records.push(...((json[key] ?? []) as T[]));
    nextPath = getNextShopifyPath(link);
  }
  return records;
}

async function upsertInBatches(table: string, rows: any[], onConflict: string, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    await supabaseAdmin.from(table).upsert(rows.slice(i, i + size), { onConflict });
  }
}

export const syncShopify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      let customers: any[] = [];
      let customersBlocked = false;
      try {
        customers = await fetchAllShopifyRecords<any>("customers.json?limit=250", "customers");
      } catch (err: any) {
        if (err?.status === 403) customersBlocked = true;
        else throw err;
      }

      let orders: any[] = [];
      let ordersBlocked = false;
      try {
        orders = await fetchAllShopifyRecords<any>("orders.json?status=any&limit=250", "orders");
      } catch (err: any) {
        if (err?.status === 403) ordersBlocked = true;
        else throw err;
      }

      // Fallback: derive customers from orders when customers API is blocked
      if (customersBlocked && orders.length) {
        const seen = new Map<string, any>();
        for (const o of orders) {
          const c = o.customer;
          if (c?.id && !seen.has(String(c.id))) seen.set(String(c.id), c);
        }
        customers = [...seen.values()];
      }

      const customerRows = customers.map((c) => ({
        shopify_id: String(c.id),
        email: c.email ?? `${c.id}@unknown.local`,
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Cliente",
        country: c.default_address?.country ?? null,
        city: c.default_address?.city ?? null,
        lifetime_value: Number(c.total_spent ?? 0),
        total_orders: Number(c.orders_count ?? 0),
        first_order_at: null,
        last_order_at: c.last_order_id ? c.updated_at : null,
        tags: c.tags ? String(c.tags).split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      }));

      if (customerRows.length) {
        await upsertInBatches("customers", customerRows, "shopify_id");
      }

      const mapped: { id: string; shopify_id: string }[] = [];
      for (let i = 0; i < customerRows.length; i += 500) {
        const { data } = await supabaseAdmin
          .from("customers")
          .select("id, shopify_id")
          .in("shopify_id", customerRows.slice(i, i + 500).map((c) => c.shopify_id));
        mapped.push(...(data ?? []));
      }
      const idMap = new Map((mapped ?? []).map((m) => [m.shopify_id, m.id]));

      const orderRows = orders
        .filter((o) => o.customer?.id && idMap.has(String(o.customer.id)))
        .map((o) => ({
          shopify_order_id: String(o.id),
          customer_id: idMap.get(String(o.customer.id))!,
          total: Number(o.total_price ?? 0),
          discount_used: Number(o.total_discounts ?? 0) > 0,
          created_at: o.created_at,
          line_items: (o.line_items ?? []).map((li: any) => ({
            name: li.title,
            quantity: li.quantity,
            price: Number(li.price ?? 0),
          })),
        }));

      if (orderRows.length) {
        await upsertInBatches("orders", orderRows, "shopify_order_id");
      }

      const warnings: string[] = [];
      if (customersBlocked) warnings.push("scope read_customers non approvato");
      if (ordersBlocked) warnings.push("scope read_orders non approvato");
      const base = `${customerRows.length} customers · ${orderRows.length} orders`;
      const msg = warnings.length ? `${base} — ${warnings.join("; ")} (richiedi 'Protected customer data' nell'app Shopify)` : base;
      const connected = !(customersBlocked && ordersBlocked);
      await markStatus("shopify", "Shopify", connected, customerRows.length + orderRows.length, msg);
      return { ok: true, message: msg };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await markStatus("shopify", "Shopify", false, 0, msg.slice(0, 200));
      throw new Error(msg);
    }
  });

// ---------- Klaviyo ----------
export const syncKlaviyo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const key = process.env.KLAVIYO_API_KEY;
      if (!key) throw new Error("KLAVIYO_API_KEY not configured");

      // Pull recent metric events (opens + clicks). Klaviyo has separate metric IDs per account,
      // so we query the global events endpoint and filter client-side by metric name.
      const res = await fetch(
        "https://a.klaviyo.com/api/events/?page[size]=100&sort=-datetime&include=metric,profile",
        {
          headers: {
            Authorization: `Klaviyo-API-Key ${key}`,
            accept: "application/vnd.api+json",
            revision: "2024-10-15",
          },
        },
      );
      if (!res.ok) throw new Error(`Klaviyo ${res.status}: ${await res.text()}`);
      const json = await res.json();
      const events = (json.data ?? []) as any[];
      const included = (json.included ?? []) as any[];

      const metricById = new Map(
        included.filter((i) => i.type === "metric").map((m) => [m.id, m.attributes?.name ?? ""]),
      );
      const profileById = new Map(
        included.filter((i) => i.type === "profile").map((p) => [p.id, p.attributes?.email ?? null]),
      );

      // Match profiles to existing customers by email
      const emails = [...new Set([...profileById.values()].filter(Boolean))] as string[];
      const { data: existing } = emails.length
        ? await supabaseAdmin.from("customers").select("id, email").in("email", emails)
        : { data: [] as { id: string; email: string }[] };
      const custByEmail = new Map((existing ?? []).map((c) => [c.email, c.id]));

      const rows = events
        .map((ev) => {
          const metricId = ev.relationships?.metric?.data?.id;
          const profileId = ev.relationships?.profile?.data?.id;
          const metricName = metricById.get(metricId) ?? "Unknown";
          const email = profileById.get(profileId);
          if (!email) return null;
          const customerId = custByEmail.get(email);
          if (!customerId) return null;
          const type = /open/i.test(metricName)
            ? "open"
            : /click/i.test(metricName)
              ? "click"
              : /bounce/i.test(metricName)
                ? "bounce"
                : "delivered";
          return {
            customer_id: customerId,
            event_type: type,
            campaign_name: metricName,
            occurred_at: ev.attributes?.datetime ?? new Date().toISOString(),
          };
        })
        .filter(Boolean) as any[];

      if (rows.length) await supabaseAdmin.from("email_events").insert(rows);
      const msg = `${rows.length} events synced (${events.length} fetched)`;
      await markStatus("klaviyo", "Klaviyo", true, rows.length, msg);
      return { ok: true, message: msg };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await markStatus("klaviyo", "Klaviyo", false, 0, msg.slice(0, 200));
      throw new Error(msg);
    }
  });

// ---------- Facebook Ads ----------
export const syncFacebook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const token = process.env.FACEBOOK_ADS_ACCESS_TOKEN;
      const acct = process.env.FACEBOOK_AD_ACCOUNT_ID;
      if (!token || !acct) throw new Error("Facebook Ads env vars missing");
      const acctId = acct.startsWith("act_") ? acct : `act_${acct}`;

      // Aggregate spend per campaign for last 30 days
      const url = `https://graph.facebook.com/v21.0/${acctId}/insights?fields=campaign_name,spend,impressions,clicks&date_preset=last_30d&level=campaign&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Facebook ${res.status}: ${await res.text()}`);
      const json = await res.json();
      const insights = (json.data ?? []) as any[];

      // Distribute campaign spend evenly across known customers (proxy attribution).
      const { data: custs } = await supabaseAdmin.from("customers").select("id").limit(500);
      const customers = (custs ?? []) as { id: string }[];
      if (!customers.length) {
        await markStatus("facebook", "Facebook Ads", true, 0, "0 events (no customers)");
        return { ok: true, message: "0 events (no customers)" };
      }

      const rows: any[] = [];
      for (const ins of insights) {
        const totalSpend = Number(ins.spend ?? 0);
        const perCust = totalSpend / customers.length;
        for (const c of customers.slice(0, 50)) {
          rows.push({
            customer_id: c.id,
            campaign_name: ins.campaign_name ?? "Unknown",
            event_type: "impression",
            spend: perCust,
            occurred_at: new Date().toISOString(),
          });
        }
      }

      if (rows.length) await supabaseAdmin.from("fb_ad_events").insert(rows);
      const msg = `${insights.length} campaigns · ${rows.length} events`;
      await markStatus("facebook", "Facebook Ads", true, rows.length, msg);
      return { ok: true, message: msg };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await markStatus("facebook", "Facebook Ads", false, 0, msg.slice(0, 200));
      throw new Error(msg);
    }
  });

// ---------- Circle ----------
export const syncCircle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const token = process.env.CIRCLE_API_TOKEN;
      const community = process.env.CIRCLE_COMMUNITY_ID;
      if (!token || !community) throw new Error("Circle env vars missing");

      const res = await fetch(
        `https://app.circle.so/api/v1/community_members?community_id=${community}&per_page=100`,
        { headers: { Authorization: `Token ${token}` } },
      );
      if (!res.ok) throw new Error(`Circle ${res.status}: ${await res.text()}`);
      const members = (await res.json()) as any[];

      const emails = members.map((m) => m.email).filter(Boolean);
      const { data: existing } = emails.length
        ? await supabaseAdmin.from("customers").select("id, email").in("email", emails)
        : { data: [] as { id: string; email: string }[] };
      const byEmail = new Map((existing ?? []).map((c) => [c.email, c.id]));

      const rows = members
        .filter((m) => byEmail.has(m.email))
        .map((m) => ({
          customer_id: byEmail.get(m.email)!,
          posts: Number(m.posts_count ?? 0),
          comments: Number(m.comments_count ?? 0),
          reactions: Number(m.reactions_count ?? 0),
          engagement_score: Math.min(
            10,
            Math.round(((m.posts_count ?? 0) * 3 + (m.comments_count ?? 0) + (m.reactions_count ?? 0) * 0.2) / 5),
          ),
          last_active_at: m.last_seen_at ?? null,
          badges: [],
        }));

      if (rows.length) {
        await supabaseAdmin.from("circle_activity").upsert(rows, { onConflict: "customer_id" });
      }
      const msg = `${members.length} members · ${rows.length} matched`;
      await markStatus("circle", "Circle", true, rows.length, msg);
      return { ok: true, message: msg };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await markStatus("circle", "Circle", false, 0, msg.slice(0, 200));
      throw new Error(msg);
    }
  });

