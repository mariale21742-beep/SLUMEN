// POST /api/auth/salir -> cierra la sesión actual.
import { conDb } from "../lib/db.mjs";
import { cerrarSesion, cookieBorrada } from "../lib/sesion.mjs";

export default async req => {
  try { await cerrarSesion(req, await conDb()); } catch (e) { console.error("[auth-salir]", e.message); }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json", "cache-control": "no-store", "set-cookie": cookieBorrada() }
  });
};

export const config = { path: "/api/auth/salir" };
