import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHEET_ID = '1s2_b92JqVuNMDGsiXO6YHwKkJraYr85VpcskgGtsbl4';
const SHEET_GID = '0';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Google Sheets fetch failed: ${res.status}`);
    const csv = await res.text();

    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new Error('Sheet is empty');

    const headers = parseCSVLine(lines[0]).map((h) =>
      h.trim().toLowerCase().replace(/"/g, '')
    );

    const emailIdx = headers.findIndex((h) => h.includes('email'));
    const dateIdx = headers.findIndex((h) => h.includes('date'));
    const boatTypeIdx = headers.findIndex(
      (h) => h.includes('boat type') || h.includes('boat_type') || h === 'type'
    );
    const boatModelIdx = headers.findIndex(
      (h) => h.includes('boat model') || h.includes('boat_model') || h === 'model'
    );
    const leadStatusIdx = headers.findIndex(
      (h) =>
        h.includes('lead') ||
        h.includes('status') ||
        (h.includes('new') && h.includes('old'))
    );

    if (emailIdx < 0) throw new Error('No email column in sheet');

    const rowMap = new Map<string, {
      email: string;
      boatType: string | null;
      boatModel: string | null;
      date: string | null;
      leadStatus: string;
    }>();

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const email = cols[emailIdx]?.trim().toLowerCase().replace(/"/g, '');
      if (!email || !email.includes('@')) continue;

      const leadStatusRaw =
        leadStatusIdx >= 0
          ? (cols[leadStatusIdx] ?? '').trim().replace(/"/g, '').toUpperCase()
          : 'NEW';
      const leadStatus = leadStatusRaw.includes('OLD') ? 'OLD' : 'NEW';

      const row = {
        email,
        boatType: boatTypeIdx >= 0 ? (cols[boatTypeIdx]?.trim().replace(/"/g, '') || null) : null,
        boatModel: boatModelIdx >= 0 ? (cols[boatModelIdx]?.trim().replace(/"/g, '') || null) : null,
        date: dateIdx >= 0 ? (cols[dateIdx]?.trim().replace(/"/g, '') || null) : null,
        leadStatus,
      };

      const existing = rowMap.get(email);
      if (
        !existing ||
        (leadStatus === 'NEW' && existing.leadStatus !== 'NEW') ||
        (existing.leadStatus === leadStatus && (row.date ?? '') > (existing.date ?? ''))
      ) {
        rowMap.set(email, row);
      }
    }

    const allRows = [...rowMap.values()];

    // Match existing customers (chunk to avoid URL length limits)
    const customerByEmail = new Map<string, string>();
    const emails = allRows.map((r) => r.email);
    for (let i = 0; i < emails.length; i += 200) {
      const chunk = emails.slice(i, i + 200);
      const { data } = await supabase
        .from('customers')
        .select('id, email')
        .in('email', chunk);
      (data ?? []).forEach((c: any) =>
        customerByEmail.set(String(c.email).toLowerCase(), c.id)
      );
    }


    const matchedRows: any[] = [];
    const newRows: any[] = [];
    for (const row of allRows) {
      const isoDate = row.date ? new Date(row.date).toISOString() : null;
      const safeDate = isoDate && !isNaN(new Date(isoDate).getTime()) ? isoDate : null;
      const customerId = customerByEmail.get(row.email);
      if (customerId) {
        matchedRows.push({ id: customerId, row, safeDate });
      } else {
        newRows.push({ row, safeDate });
      }
    }

    // Parallel updates for matched customers (chunks of 50)
    const CHUNK = 50;
    for (let i = 0; i < matchedRows.length; i += CHUNK) {
      const slice = matchedRows.slice(i, i + CHUNK);
      await Promise.all(
        slice.map(({ id, row, safeDate }) =>
          supabase
            .from('customers')
            .update({
              boat_type: row.boatType,
              boat_model: row.boatModel,
              community_join_date: safeDate,
              community_lead_status: row.leadStatus,
            })
            .eq('id', id)
        )
      );
    }
    let updatedCount = matchedRows.length;

    // Bulk insert new community-only customers
    let unmatchedCount = 0;
    if (newRows.length > 0) {
      const payload = newRows.map(({ row, safeDate }) => ({
        email: row.email,
        name: row.email.split('@')[0],
        boat_type: row.boatType,
        boat_model: row.boatModel,
        community_join_date: safeDate,
        community_lead_status: row.leadStatus,
        tags: ['community-only'],
        lifetime_value: 0,
        total_orders: 0,
      }));
      for (let i = 0; i < payload.length; i += 500) {
        const slice = payload.slice(i, i + 500);
        const { data } = await supabase
          .from('customers')
          .upsert(slice, { onConflict: 'email' })
          .select('id');
        unmatchedCount += data?.length ?? slice.length;
      }
    }

    const msg = `${allRows.length} records · ${updatedCount} matched · ${unmatchedCount} new community members`;
    await supabase.from('integrations_status').upsert(
      {
        id: 'gsheet_boats',
        name: 'Google Sheet — Boats',
        connected: true,
        records_synced: allRows.length,
        status_message: msg,
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    return new Response(
      JSON.stringify({ ok: true, message: msg, total: allRows.length, matched: updatedCount, created: unmatchedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
