// POST /api/crear-pago  { items: ["metodo", ...], pasarela, comprador: { nombre, email, celular }, idioma }
// Calcula el total con catalogo.json, guarda el pedido y devuelve la URL de pago de la pasarela.
import { TODAS } from "../lib/pasarelas.mjs";
import { PASARELAS, armarPedido } from "../lib/catalogo.mjs";
import { guardarPedido } from "../lib/pedidos.mjs";
import { json, nuevaReferencia } from "../lib/util.mjs";

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async req => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  let datos;
  try { datos = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }

  const pasarela = String(datos.pasarela || "");
  const motor = TODAS[pasarela];
  if (!motor || !motor.habilitada()) return json({ error: "Este medio de pago no está disponible" }, 400);

  const c = datos.comprador || {};
  const nombre = String(c.nombre || "").trim().slice(0, 80);
  const email = String(c.email || "").trim().toLowerCase().slice(0, 120);
  const celular = String(c.celular || "").replace(/[^\d+ ]/g, "").slice(0, 20);
  const idioma = datos.idioma === "en" ? "en" : "es";
  if (nombre.length < 2) return json({ error: "Escribe tu nombre" }, 400);
  if (!CORREO.test(email)) return json({ error: "Revisa tu correo" }, 400);

  const base = armarPedido(datos.items, PASARELAS[pasarela].moneda, idioma);
  if (!base.items.length) return json({ error: "Tu carrito está vacío" }, 400);

  const pedido = {
    ref: nuevaReferencia(), pasarela, ...base, nombre, email, celular, idioma,
    estado: "creado", creado: new Date().toISOString()
  };

  try {
    await guardarPedido(pedido);
    const url = await motor.crear(pedido);
    return json({ url, ref: pedido.ref });
  } catch (e) {
    console.error("[crear-pago]", pasarela, e.message, JSON.stringify(e.datos || "").slice(0, 600));
    return json({ error: "No pudimos abrir el pago. Intenta de nuevo en un momento." }, 502);
  }
};

export const config = { path: "/api/crear-pago" };
