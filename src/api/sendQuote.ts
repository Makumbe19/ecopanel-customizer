/// <reference types="vite/client" />

export async function sendQuoteEmail(quote: {
  to: string;
  customerName?: string;
  customerEmail?: string;
  phone?: string;
  quoteNumber: string;
  items: Array<{ name: string; qty: number; price: string; total: string }>;
  subtotal: string;
  tax: string;
  total: string;
  notes?: string;
}) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-quote`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      subject: `Quote ${quote.quoteNumber} from Ecopanel`,
      textFallback: `Quote total: ${quote.total}`,
      ...quote,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Email failed: ${res.status} ${JSON.stringify(err)}`);
  }
  return res.json();
}
