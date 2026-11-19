// GET /api/config -> qué pasarelas están activas (tienen sus llaves en Netlify).
import { TODAS } from "../lib/pasarelas.mjs";
import { json } from "../lib/util.mjs";

export default async () => {
  const activas = Object.keys(TODAS).filter(k => TODAS[k].habilitada());
  return json({ pasarelas: activas });
};

export const config = { path: "/api/config" };
