// GET /api/confirmar?pasarela=wompi&id=...  (lo llama gracias.html al volver de la pasarela)
// Verifica el pago directamente con la pasarela y, si está aprobado, entrega los productos.
import { TODAS } from "../lib/pasarelas.mjs";
import { confirmarPago } from "../lib/pedidos.mjs";
import { json } from "../lib/util.mjs";

export default async req => {
  const q = new URL(req.url).searchParams;
  const pasarela = q.get("pasarela") || "";
  const id = (q.get("id") || "").slice(0, 200);
  const motor = TODAS[pasarela];
  if (!motor || !motor.habilitada() || !id) return json({ estado: "desconocido" }, 400);
  try {
    const resultado = await motor.verificar(id);
    const r = await confirmarPago(pasarela, resultado, id);
    return json({ estado: r.estado, ref: r.ref, email: r.email ? r.email.replace(/^(.).*?(@.*)$/, "$1•••$2") : undefined });
  } catch (e) {
    console.error("[confirmar]", pasarela, e.message, JSON.stringify(e.datos || "").slice(0, 600));
    return json({ estado: "pendiente" });
  }
};

export const config = { path: "/api/confirmar" };
