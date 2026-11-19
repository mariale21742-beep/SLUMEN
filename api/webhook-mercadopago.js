// POST /api/webhook-mercadopago  (se envía solo: va en notification_url de cada preferencia)
// Si MP_WEBHOOK_SECRET está configurado, se valida la firma x-signature. En todo caso
// el pago se vuelve a consultar en la API de Mercado Pago con el access token.
import { mercadopago } from "../lib/pasarelas.mjs";
import { confirmarPago } from "../lib/pedidos.mjs";
import { env, hmacSha256, iguales, json } from "../lib/util.mjs";

const manejar = async req => {
  const url = new URL(req.url);
  let cuerpo = {};
  try { cuerpo = await req.json(); } catch {}
  const tipo = cuerpo.type || url.searchParams.get("type") || url.searchParams.get("topic");
  const id = String((cuerpo.data && cuerpo.data.id) || url.searchParams.get("data.id") || url.searchParams.get("id") || "");
  if (tipo !== "payment" || !id) return json({ ok: true });

  const secreto = env("MP_WEBHOOK_SECRET");
  if (secreto) {
    const partes = Object.fromEntries((req.headers.get("x-signature") || "").split(",").map(p => p.trim().split("=")));
    const manifiesto = `id:${id.toLowerCase()};request-id:${req.headers.get("x-request-id") || ""};ts:${partes.ts};`;
    if (!iguales(await hmacSha256(secreto, manifiesto), partes.v1)) return json({ ok: false, error: "firma" }, 401);
  }
  try {
    await confirmarPago("mercadopago", await mercadopago.verificar(id), id);
  } catch (e) {
    console.error("[webhook-mercadopago]", e.message);
    return json({ ok: false }, 500);
  }
  return json({ ok: true });
};

// Vercel: cada archivo de /api es una ruta (por ejemplo /api/webhook-mercadopago).
export const GET = manejar;
export const POST = manejar;
