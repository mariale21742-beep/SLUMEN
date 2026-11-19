// POST /api/auth/verificar  { t }  -> abre la sesión (cookie) si el enlace es válido y no se ha usado.
// Es POST (no GET) para que los antivirus de correo que abren enlaces no gasten el acceso.
import { conDb } from "../../lib/db.mjs";
import { crearSesion, usuarioPorCorreo } from "../../lib/sesion.mjs";
import { json, sha256 } from "../../lib/util.mjs";

const manejar = async req => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  let d = {};
  try { d = await req.json(); } catch {}
  const token = String(d.t || "");
  if (token.length < 20) return json({ error: "enlace" }, 400);
  try {
    const sql = await conDb();
    const filas = await sql`update enlaces_acceso set usado = now()
                            where token_hash = ${await sha256(token)} and usado is null and expira > now()
                            returning email, acepta`;
    if (!filas.length) return json({ error: "enlace" }, 400);
    const usuario = await usuarioPorCorreo(sql, filas[0].email, { acepta: filas[0].acepta });
    const setCookie = await crearSesion(sql, usuario.id, req.headers.get("user-agent") || "");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "set-cookie": setCookie }
    });
  } catch (e) {
    console.error("[auth-verificar]", e.message);
    return json({ error: "servidor" }, 500);
  }
};

// Vercel: cada archivo de /api es una ruta (por ejemplo /api/auth/verificar).
export const GET = manejar;
export const POST = manejar;
