// GET /api/yo -> perfil, productos comprados e historial de compras de la persona con sesión.
import { conDb } from "../lib/db.mjs";
import { usuarioActual } from "../lib/sesion.mjs";
import { PRODUCTOS } from "../lib/catalogo.mjs";
import { json } from "../lib/util.mjs";

const manejar = async req => {
  let sql;
  try { sql = await conDb(); } catch (e) { console.error("[yo]", e.message); return json({ error: "servidor" }, 503); }
  const u = await usuarioActual(req, sql);
  if (!u) return json({ error: "sin_sesion" }, 401);

  const accesos = await sql`select producto, otorgado, ultimo_uso, pedido_ref from accesos where usuario_id = ${u.id} order by otorgado`;
  const pedidos = await sql`select ref, creado, pagado, estado, pasarela, moneda, total, lineas from pedidos
                            where usuario_id = ${u.id} or (usuario_id is null and email = ${u.email})
                            order by creado desc limit 50`;
  return json({
    usuario: {
      email: u.email, nombre: u.nombre, celular: u.celular, pais: u.pais, idioma: u.idioma,
      acepta_novedades: u.acepta_novedades, creado: u.creado
    },
    productos: accesos.filter(a => PRODUCTOS[a.producto]).map(a => ({
      id: a.producto, es: PRODUCTOS[a.producto].es, en: PRODUCTOS[a.producto].en, eje: PRODUCTOS[a.producto].eje,
      otorgado: a.otorgado, ultimo_uso: a.ultimo_uso, url: `/productos/${a.producto}/`
    })),
    pedidos: pedidos.map(p => ({ ...p, total: Number(p.total) }))
  });
};

// Vercel: cada archivo de /api es una ruta (por ejemplo /api/yo).
export const GET = manejar;
export const POST = manejar;
