// POST /api/crear-pago
//   { items: ["metodo", ...], pasarela, comprador: { nombre, email, celular }, idioma, acepta, novedades }
// Calcula el total con catalogo.json, guarda el pedido en PostgreSQL y devuelve la URL de pago.
// Si hay sesión, el pedido queda en la cuenta de esa persona (con su correo).
import { TODAS } from "../lib/pasarelas.mjs";
import { PASARELAS, PRODUCTOS, armarPedido } from "../lib/catalogo.mjs";
import { guardarPedido } from "../lib/pedidos.mjs";
import { conDb } from "../lib/db.mjs";
import { usuarioActual } from "../lib/sesion.mjs";
import { json, nuevaReferencia, CORREO_VALIDO } from "../lib/util.mjs";

const manejar = async req => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  let datos;
  try { datos = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }

  const idioma = datos.idioma === "en" ? "en" : "es";
  const t = (es, en) => idioma === "en" ? en : es;
  const pasarela = String(datos.pasarela || "");
  const motor = TODAS[pasarela];
  if (!motor || !motor.habilitada()) return json({ error: t("Este medio de pago no está disponible.", "This payment method isn’t available.") }, 400);
  if (!datos.acepta) return json({ error: t("Acepta la política de datos para continuar.", "Please accept the data policy to continue.") }, 400);

  const c = datos.comprador || {};
  let nombre = String(c.nombre || "").trim().slice(0, 80);
  let email = String(c.email || "").trim().toLowerCase().slice(0, 120);
  const celular = String(c.celular || "").replace(/[^\d+ ]/g, "").slice(0, 20);

  let usuarioId = null;
  try {
    const sql = await conDb();
    const u = await usuarioActual(req, sql);
    if (u) { usuarioId = u.id; email = u.email; nombre = nombre || u.nombre || ""; }
  } catch (e) {
    console.error("[crear-pago] base de datos", e.message);
    return json({ error: t("No pudimos abrir el pago. Intenta de nuevo en un momento.", "We couldn’t open the payment. Please try again in a moment.") }, 503);
  }
  if (nombre.length < 2) return json({ error: t("Escribe tu nombre.", "Please write your name.") }, 400);
  if (!CORREO_VALIDO.test(email)) return json({ error: t("Revisa tu correo.", "Check your email.") }, 400);

  const base = armarPedido(datos.items, PASARELAS[pasarela].moneda, idioma);
  if (!base.items.length) return json({ error: t("Tu carrito está vacío.", "Your cart is empty.") }, 400);
  if (base.items.some(id => PRODUCTOS[id].evento) && celular.replace(/\D/g, "").length < 7) return json({ error: t("Para el encuentro necesitamos tu celular.", "We need your phone number for the gathering.") }, 400);

  const pedido = { ref: nuevaReferencia(), pasarela, ...base, nombre, email, celular, idioma, usuarioId, aceptaNovedades: !!datos.novedades };
  try {
    await guardarPedido(pedido);
    const url = await motor.crear(pedido);
    return json({ url, ref: pedido.ref });
  } catch (e) {
    console.error("[crear-pago]", pasarela, e.message, JSON.stringify(e.datos || "").slice(0, 600));
    return json({ error: t("No pudimos abrir el pago. Intenta de nuevo en un momento.", "We couldn’t open the payment. Please try again in a moment.") }, 502);
  }
};

// Vercel: cada archivo de /api es una ruta (por ejemplo /api/crear-pago).
export const GET = manejar;
export const POST = manejar;
