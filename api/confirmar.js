// GET /api/confirmar?pasarela=wompi&id=...  (lo llama gracias.html al volver de la pasarela)
// Verifica el pago directamente con la pasarela y, si está aprobado, entrega los productos.
import { TODAS } from "../lib/pasarelas.mjs";
import { confirmarPago } from "../lib/pedidos.mjs";
import { json } from "../lib/util.mjs";
import { hayDb, conDb } from "../lib/db.mjs";
import { crearSesion, crearEnlace } from "../lib/sesion.mjs";
import { productosAEntregar, PRODUCTOS } from "../lib/catalogo.mjs";
import { sitioUrl } from "../lib/util.mjs";

// Número para wa.me: solo dígitos; un celular colombiano de 10 dígitos lleva el 57 adelante.
function numeroWhatsapp(celular) {
  const d = String(celular || "").replace(/\D/g, "");
  if (/^3\d{9}$/.test(d)) return "57" + d;
  return d.length >= 10 ? d : "";
}

// Mensaje para que la persona se guarde el acceso en su propio WhatsApp.
// Lleva un enlace de entrada de un solo uso (7 días) que abre directo su producto.
async function mensajeWhatsapp(sql, f, productos, idioma) {
  const en = idioma === "en";
  const id = productos.length === 1 ? productos[0] : null;
  const volver = id ? `/productos/${id}/` : "/cuenta.html";
  const token = await crearEnlace(sql, f.email, { minutos: 7 * 24 * 60, acepta: true });
  const enlace = `${sitioUrl()}/entrar.html?t=${encodeURIComponent(token)}&volver=${encodeURIComponent(volver)}`;
  const nombres = productos.map(p => (PRODUCTOS[p] && (en ? PRODUCTOS[p].en : PRODUCTOS[p].es)) || p).join(", ");
  const texto = en
    ? `I completed my purchase at Slumen 💛\nMy product: ${nombres}\nOpen it here: ${enlace}\n\nIf this link was already used, sign in at ${sitioUrl()}/cuenta.html with ${f.email}`
    : `Ya hice mi compra en Slumen 💛\nMi producto: ${nombres}\nEntro aquí: ${enlace}\n\nSi este enlace ya se usó, entro en ${sitioUrl()}/cuenta.html con mi correo ${f.email}`;
  return `https://wa.me/${numeroWhatsapp(f.celular)}?text=${encodeURIComponent(texto)}`;
}

// Al volver de pagar, quien compró entra directo a su cuenta en este navegador.
// Solo si trae la referencia del pedido que guardó su propio checkout y el pago es de las últimas 24 horas.
async function abrirSesion(req, ref) {
  const sql = await conDb();
  const f = (await sql`select usuario_id, items, email, celular, idioma from pedidos where ref = ${ref} and estado = 'entregado'
                       and usuario_id is not null and pagado > now() - interval '24 hours'`)[0];
  if (!f) return null;
  const productos = productosAEntregar(f.items);
  const whatsapp = productos.length ? await mensajeWhatsapp(sql, f, productos, f.idioma).catch(() => null) : null;
  return { cookie: await crearSesion(sql, f.usuario_id, req.headers.get("user-agent") || ""), productos, whatsapp };
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
        datos.sesion = true; datos.productos = s.productos; if (s.whatsapp) datos.whatsapp = s.whatsapp;
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
