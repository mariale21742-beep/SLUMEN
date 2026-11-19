// Conexión a PostgreSQL (Neon, Supabase o cualquier Postgres).
// Variable de entorno: DATABASE_URL (o POSTGRES_URL, que crea la integración de Neon en Vercel).
import postgres from "postgres";
import { env } from "./util.mjs";
import { ESQUEMA } from "./esquema.mjs";

let sql = null;
let listo = null;

function conectar() {
  const url = env("DATABASE_URL") || env("POSTGRES_URL");
  if (!url) throw new Error("Falta la variable DATABASE_URL");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  return postgres(url, { ssl: local ? false : "require", max: 1, idle_timeout: 20, connect_timeout: 10, prepare: false });
}

// Devuelve la conexión lista, aplicando el esquema una vez por instancia.
export async function conDb() {
  if (!sql) sql = conectar();
  if (!listo) listo = sql.unsafe(ESQUEMA).catch(e => { listo = null; throw e; });
  await listo;
  return sql;
}

export const hayDb = () => !!(env("DATABASE_URL") || env("POSTGRES_URL"));
