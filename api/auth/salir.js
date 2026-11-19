// POST /api/auth/salir -> cierra la sesión actual.
import { conDb } from "../../lib/db.mjs";
import { cerrarSesion, cookieBorrada } from "../../lib/sesion.mjs";

const manejar = async req => {
  try { await cerrarSesion(req, await conDb()); } catch (e) { console.error("[auth-salir]", e.message); }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json", "cache-control": "no-store", "set-cookie": cookieBorrada() }
  });
};

// Vercel: cada archivo de /api es una ruta (por ejemplo /api/auth/salir).
export const GET = manejar;
export const POST = manejar;
