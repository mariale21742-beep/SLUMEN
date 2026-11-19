// POST /api/webhook-stripe  (Stripe > Developers > Webhooks, evento checkout.session.completed)
// Verifica la cabecera Stripe-Signature con STRIPE_WEBHOOK_SECRET.
import { stripe } from "../lib/pasarelas.mjs";
import { confirmarPago } from "../lib/pedidos.mjs";
import { env, hmacSha256, iguales, json } from "../lib/util.mjs";

const manejar = async req => {
  const crudo = await req.text();
  const cabecera = req.headers.get("stripe-signature") || "";
  const t = (cabecera.match(/(?:^|,)t=(\d+)/) || [])[1];
  const firmas = [...cabecera.matchAll(/(?:^|,)v1=([0-9a-f]+)/g)].map(m => m[1]);
  const secreto = env("STRIPE_WEBHOOK_SECRET");
  if (!secreto || !t) return json({ ok: false }, 401);
  const esperada = await hmacSha256(secreto, `${t}.${crudo}`);
  const vigente = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  if (!vigente || !firmas.some(f => iguales(f, esperada))) return json({ ok: false, error: "firma" }, 401);

  const evento = JSON.parse(crudo);
  if (evento.type !== "checkout.session.completed" && evento.type !== "checkout.session.async_payment_succeeded") return json({ ok: true });
  const id = evento.data.object.id;
  try {
    await confirmarPago("stripe", await stripe.verificar(id), id);
  } catch (e) {
    console.error("[webhook-stripe]", e.message);
    return json({ ok: false }, 500);
  }
  return json({ ok: true });
};

// Vercel: cada archivo de /api es una ruta (por ejemplo /api/webhook-stripe).
export const GET = manejar;
export const POST = manejar;
