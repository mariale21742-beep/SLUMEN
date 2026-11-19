// Sube los productos pagados (carpeta privado/productos/) a la base de datos PostgreSQL.
// Así los productos NO tienen que estar en el repositorio público de GitHub.
//
// Uso (en un computador con Node 20+ y esta carpeta, que sí tiene privado/productos/):
//   npm install
//   DATABASE_URL="postgres://..." node scripts/subir-productos.mjs
//
// Se puede volver a correr cada vez que cambies un producto: reemplaza los archivos.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { ESQUEMA } from "../lib/esquema.mjs";

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".pdf": "application/pdf",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".woff2": "font/woff2"
};

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) { console.error("Falta DATABASE_URL"); process.exit(1); }
const sql = postgres(url, { ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", max: 1, prepare: false });
const raiz = path.resolve("privado/productos");

async function archivos(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await archivos(p)); else out.push(p);
  }
  return out;
}

await sql.unsafe(ESQUEMA);
let total = 0;
for (const producto of await readdir(raiz)) {
  const carpeta = path.join(raiz, producto);
  for (const archivo of await archivos(carpeta)) {
    const ruta = path.relative(carpeta, archivo).split(path.sep).join("/");
    const tipo = TIPOS[path.extname(archivo).toLowerCase()] || "application/octet-stream";
    const contenido = await readFile(archivo);
    await sql`insert into archivos_producto (producto, ruta, tipo, contenido) values (${producto}, ${ruta}, ${tipo}, ${contenido})
              on conflict (producto, ruta) do update set tipo = excluded.tipo, contenido = excluded.contenido, actualizado = now()`;
    total++;
    console.log("✓", producto + "/" + ruta, Math.round(contenido.length / 1024) + " KB");
  }
}
console.log(`Listo: ${total} archivos en la base de datos.`);
await sql.end();
