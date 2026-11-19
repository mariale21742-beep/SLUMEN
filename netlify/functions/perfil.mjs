// POST /api/perfil  { nombre, celular, pais, idioma, acepta_novedades } -> actualiza el perfil.
import { conDb } from "../lib/db.mjs";
import { usuarioActual } from "../lib/sesion.mjs";
import { json } from "../lib/util.mjs";

const texto = (v, n) => { const s = String(v == null ? "" : v).trim().slice(0, n); return s || null; };

export default async req => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const sql = await conDb();
  const u = await usuarioActual(req, sql);
  if (!u) return json({ error: "sin_sesion" }, 401);
  let d = {};
  try { d = await req.json(); } catch {}
  const filas = await sql`update usuarios set
      nombre = ${texto(d.nombre, 80)},
      celular = ${texto(String(d.celular || "").replace(/[^\d+ ]/g, ""), 20)},
      pais = ${texto(d.pais, 60)},
      idioma = ${d.idioma === "en" ? "en" : "es"},
      acepta_novedades = ${!!d.acepta_novedades}
    where id = ${u.id}
    returning email, nombre, celular, pais, idioma, acepta_novedades, creado`;
  return json({ usuario: filas[0] });
};

export const config = { path: "/api/perfil" };
