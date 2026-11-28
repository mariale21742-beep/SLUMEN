// GET /api/confirmar?pasarela=wompi&id=...  (lo llama gracias.html al volver de la pasarela)
// Verifica el pago directamente con la pasarela y, si está aprobado, entrega los productos.
import { TODAS } from "../lib/pasarelas.mjs";
import { confirmarPago } from "../lib/pedidos.mjs";
import { json } from "../lib/util.mjs";
import { hayDb, conDb } from "../lib/db.mjs";
import { crearSesion } from "../lib/sesion.mjs";
import { productosAEntregar } from "../lib/catalogo.mjs";

// Al volver de pagar, quien compró entra directo a su cuenta en este navegador.
// Solo si trae la referencia del pedido que guardó su propio checkout y el pago es de las últimas 24 horas.
async function abrirSesion(req, ref) {
  const sql = await conDb();
  const f = (await sql`select usuario_id, items from pedidos where ref = ${ref} and estado = 'entregado'
                       and usuario_id is not null and pagado > now() - interval '24 hours'`)[0];
  if (!f) return null;
  return { cookie: await crearSesion(sql, f.usuario_id, req.headers.get("user-agent") || ""), productos: productosAEntregar(f.items) };
}

const manejar = async req => {
  const q = new URL(req.url).searchParams;
  const pasarela = q.get("pasarela") || "";
  const id = (q.get("id") || "").slice(0, 200);
  const motor = TODAS[pasarela];
  if (!motor || !motor.habilitada() || !id) return json({ estado: "desconocido" }, 400);
  try {
    const resultado = await motor.verificar(id);
    if (!hayDb()) return json({ estado: resultado.estado === "aprobado" ? "aprobado" : resultado.estado, ref: resultado.ref, sinCuenta: true });
    const r = await confirmarPago(pasarela, resultado, id);
    const datos = { estado: r.estado, ref: r.ref, email: r.email ? r.email.replace(/^(.).*?(@.*)$/, "$1•••$2") : undefined };
    const miRef = (q.get("ref") || "").slice(0, 60);
    if (r.estado === "aprobado" && miRef && miRef === r.ref) {
      const s = await abrirSesion(req, r.ref).catch(e => { console.error("[confirmar] sesión", e.message); return null; });
      if (s) {
        datos.sesion = true; datos.productos = s.productos;
        return new Response(JSON.stringify(datos), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "set-cookie": s.cookie } });
      }
    }
    return json(datos);
  } catch (e) {
    console.error("[confirmar]", pasarela, e.message, JSON.stringify(e.datos || "").slice(0, 600));
    return json({ estado: "pendiente" });
  }
};

// Vercel: cada archivo de /api es una ruta (por ejemplo /api/confirmar).
export const GET = manejar;
export const POST = manejar;
