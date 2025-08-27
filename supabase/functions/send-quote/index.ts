import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

/** CORS */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---- Secrets (set in Supabase Studio/CLI) ----
const MAILGUN_API_KEY   = Deno.env.get("MAILGUN_API_KEY")!;           // key-xxxxxxxx
const MAILGUN_DOMAIN    = Deno.env.get("MAILGUN_DOMAIN")!;            // e.g. builderscorner.co.zw OR mg.builderscorner.co.zw
const FROM_EMAIL        = Deno.env.get("FROM_EMAIL") || `quotes@${MAILGUN_DOMAIN}`;
const REPLY_TO          = Deno.env.get("REPLY_TO") || FROM_EMAIL;
const BCC_EMAIL         = Deno.env.get("BCC_EMAIL") || "";

const API_BASE = "https://api.mailgun.net"; // US region
const SEND_URL = `${API_BASE}/v3/${MAILGUN_DOMAIN}/messages`;

function authHeader() {
  // HTTP Basic: api:<key>
  const token = btoa(`api:${MAILGUN_API_KEY}`);
  return { "Authorization": `Basic ${token}` };
}

function htmlTemplate(payload: any) {
  const { customerName, customerEmail, phone, quoteNumber, items = [], subtotal, tax, total, notes } = payload;
  const rows = items.map((it: any) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${it.name}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${it.qty}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${it.price}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${it.total}</td>
    </tr>
  `).join("");

  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:auto">
    <h2 style="color:#111">Quote #${quoteNumber}</h2>
    <p>Hi ${customerName || "there"},</p>
    <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:16px">
      <thead>
        <tr style="text-align:left;background:#fafafa">
          <th style="padding:8px;border-bottom:1px solid #ddd">Item</th>
          <th style="padding:8px;border-bottom:1px solid #ddd">Qty</th>
          <th style="padding:8px;border-bottom:1px solid #ddd">Price</th>
          <th style="padding:8px;border-bottom:1px solid #ddd">Line Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:16px">
      <p><strong>Subtotal:</strong> ${subtotal}</p>
      <p><strong>Tax:</strong> ${tax}</p>
      <p style="font-size:18px"><strong>Total:</strong> ${total}</p>
    </div>
    ${notes ? `<p style="margin-top:16px"><strong>Notes:</strong> ${notes}</p>` : ""}
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee" />
    <p style="color:#555;font-size:13px">Contact: ${phone || "-"} · Email: ${customerEmail || "-"}</p>
  </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const { to, subject = "Your Quote", textFallback } = payload;
    if (!to) {
      return new Response(JSON.stringify({ error: "`to` is required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const form = new URLSearchParams();
    form.append("from", FROM_EMAIL);
    form.append("to", to);
    if (BCC_EMAIL) form.append("bcc", BCC_EMAIL);
    form.append("subject", subject);
    form.append("text", textFallback || "Please view this quote in an HTML-capable email client.");
    form.append("html", htmlTemplate(payload));
    form.append("h:Reply-To", REPLY_TO);

    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: { ...authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, status: res.status, data }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
