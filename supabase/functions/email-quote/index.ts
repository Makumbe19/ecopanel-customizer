// supabase/functions/email-quote/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

/* ---------- CORS ---------- */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ---------- Secrets / Config ----------
   Set these in Supabase Studio → Edge Functions → email-quote → Secrets
   Required (Resend): EMAIL_PROVIDER=resend, RESEND_API_KEY, FROM_EMAIL
   Optional: REPLY_TO, BCC_EMAIL, COMPANY_NAME, BRAND_LOGO_URL
*/
const EMAIL_PROVIDER = (Deno.env.get("EMAIL_PROVIDER") || "resend").toLowerCase();

const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") || "";                 // e.g. qoutes@builderscorner.co.zw
const REPLY_TO       = Deno.env.get("REPLY_TO") || undefined;            // optional
const BCC_EMAIL      = Deno.env.get("BCC_EMAIL") || undefined;           // optional
const COMPANY_NAME   = Deno.env.get("COMPANY_NAME") || "Ecopanel Quotes";
const BRAND_LOGO_URL = Deno.env.get("BRAND_LOGO_URL") || "";             // optional logo

// Provider keys
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") || "";
// (Optional fallback if you ever switch): const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";

// Supabase (Functions usually have these by default)
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

/* ---------- Utils ---------- */
function usd(n: unknown) {
  return Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/* ---------- Handler ---------- */
serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    if (!FROM_EMAIL) throw new Error("Missing FROM_EMAIL");
    if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

    const { quoteId, leadId, buildId, pricing } = await req.json();
    if (!quoteId || !leadId) throw new Error("Missing quoteId or leadId");

    const dbHeaders = {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    };

    // ---- Load lead ----
    const leadResp = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}&select=first_name,last_name,email`,
      { headers: dbHeaders }
    );
    if (!leadResp.ok) throw new Error(`Lead fetch failed: ${await leadResp.text()}`);
    const [lead] = await leadResp.json();
    if (!lead?.email) throw new Error("Lead email not found");

    // ---- Optional: build name ----
    let buildName = String(buildId ?? "");
    try {
      const b = await fetch(`${SUPABASE_URL}/rest/v1/builds?id=eq.${buildId}&select=name`, { headers: dbHeaders });
      if (b.ok) {
        const [row] = await b.json();
        if (row?.name) buildName = row.name;
      }
    } catch { /* ignore */ }

    // ---- Pricing: use body or pull from DB ----
    let p = pricing as any;
    if (!p) {
      const qp = await fetch(`${SUPABASE_URL}/rest/v1/quotes?id=eq.${quoteId}&select=pricing`, { headers: dbHeaders });
      if (!qp.ok) throw new Error(`Pricing fetch failed: ${await qp.text()}`);
      const [row] = await qp.json();
      p = row?.pricing || {};
    }

    const items: Array<{ room: string; property: string; attribute: string; value: string; price: number }> =
      Array.isArray(p?.items) ? p.items : [];
    const basePrice = Number(p?.basePrice || 0);
    const optionsSubtotal = Number(p?.optionsSubtotal || 0);
    const grandTotal = Number(p?.grandTotal || basePrice + optionsSubtotal);

    const rowsHtml = items.length
      ? items.map(it => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee">${it.room}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${it.property}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${it.attribute}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${it.value}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${usd(it.price)}</td>
          </tr>`).join("")
      : `<tr><td colspan="5" style="padding:10px;color:#666">No optional items selected.</td></tr>`;

    const headerBlock = BRAND_LOGO_URL
      ? `<div style="text-align:center;margin:0 0 14px">
           <img src="${BRAND_LOGO_URL}" alt="${COMPANY_NAME}" style="max-width:180px;height:auto"/>
         </div>`
      : "";

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#111;line-height:1.55">
        ${headerBlock}
        <h2 style="margin:0 0 8px">${COMPANY_NAME}</h2>
        <p style="margin:0 0 10px">Hello ${[lead.first_name, lead.last_name].filter(Boolean).join(" ") || ""},</p>
        <p style="margin:0 0 14px">Thanks for designing with Ecopanel. Here is your quotation for <strong>${buildName}</strong>:</p>

        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:760px;margin:8px 0 16px">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #333">Room</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #333">Property</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #333">Attribute</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #333">Value</th>
              <th style="text-align:right;padding:8px;border-bottom:2px solid #333">Price</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="padding:10px;text-align:right;color:#555">Base price</td>
              <td style="padding:10px;text-align:right;font-weight:600">${usd(basePrice)}</td>
            </tr>
            <tr>
              <td colspan="4" style="padding:10px;text-align:right;color:#555">Options subtotal</td>
              <td style="padding:10px;text-align:right;font-weight:600">${usd(optionsSubtotal)}</td>
            </tr>
            <tr>
              <td colspan="4" style="padding:12px 10px;text-align:right;font-weight:700;border-top:2px solid #333">Grand Total</td>
              <td style="padding:12px 10px;text-align:right;font-weight:800;border-top:2px solid #333">${usd(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        <p style="margin:0 0 10px">We’ll contact you shortly to finalize details or answer any questions.</p>
        <hr style="margin:16px 0;border:none;border-top:1px solid #eee"/>
        <small style="color:#666">Quote ID: ${quoteId}</small>
      </div>
    `;
    const subject = `Your Ecopanel Quotation (${buildName}) — #${quoteId}`;
    const textFallback = stripHtml(html);

    // ---- Send email via chosen provider ----
    if (EMAIL_PROVIDER === "resend") {
      if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
      const body: Record<string, unknown> = {
        from: `${COMPANY_NAME} <${FROM_EMAIL}>`,
        to: [lead.email],
        subject,
        html,
        text: textFallback,
      };
      if (REPLY_TO) body.reply_to = REPLY_TO;
      if (BCC_EMAIL) body.bcc = [BCC_EMAIL];

      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`Resend failed: ${await r.text()}`);

    } else {
      throw new Error(`Unsupported EMAIL_PROVIDER: ${EMAIL_PROVIDER}. Use "resend" (or add another branch).`);
      // If you want to keep SendGrid as a fallback, we can add that branch back in a single edit.
    }

    // ---- Stamp emailed_at on the quote ----
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/quotes?id=eq.${quoteId}`, {
        method: "PATCH",
        headers: dbHeaders,
        body: JSON.stringify({ emailed_at: new Date().toISOString() }),
      });
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });

  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }
});
