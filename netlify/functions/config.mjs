// GET /api/config -> qué pasarelas están activas y si hay base de datos (cuentas).
import { TODAS } from "../lib/pasarelas.mjs";
import { hayDb } from "../lib/db.mjs";
import { json } from "../lib/util.mjs";

export default async () => {
  const activas = Object.keys(TODAS).filter(k => TODAS[k].habilitada());
  return json({ pasarelas: activas, cuentas: hayDb() });
};

export const config = { path: "/api/config" };
