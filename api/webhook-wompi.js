// POST /api/webhook-wompi  (configúralo en el panel de Wompi > Desarrolladores > URL de eventos)
// Verifica la firma del evento con WOMPI_EVENTS_SECRET y vuelve a consultar la transacción.
import { wompi } from "../lib/pasarelas.mjs";
import { confirmarPago } from "../lib/pedidos.mjs";
import { env, sha256, iguales, json } from "../lib/util.mjs";

const valor = (obj, ruta) => ruta.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

const manejar = async req => {
  let evento;
  try { evento = await req.json(); } catch { return json({ ok: false }, 400); }
  const firma = evento.signature || {};
  const props = Array.isArray(firma.properties) ? firma.properties : [];
  const cadena = props.map(p => String(valor(evento.data, p) ?? "")).join("") + evento.timestamp + env("WOMPI_EVENTS_SECRET");
  if (!env("WOMPI_EVENTS_SECRET") || !iguales(await sha256(cadena), String(firma.checksum || "").toLowerCase())) {
    return json({ ok: false, error: "firma" }, 401);
  }
  if (evento.event !== "transaction.updated") return json({ ok: true });
  const id = valor(evento.data, "transaction.id");
  try {
    await confirmarPago("wompi", await wompi.verificar(id), id);
  } catch (e) {
    console.error("[webhook-wompi]", e.message);
    return json({ ok: false }, 500);
  }
  return json({ ok: true });
};

// Vercel: cada archivo de /api es una ruta (por ejemplo /api/webhook-wompi).
export const GET = manejar;
export const POST = manejar;
