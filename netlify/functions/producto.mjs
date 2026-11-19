// GET /productos/<id>/...  -> sirve el producto SOLO a quien lo compró.
// Los archivos viven en privado/productos/<id>/ (bloqueado al público en netlify.toml)
// y se incluyen en esta función con included_files.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { conDb } from "../lib/db.mjs";
import { usuarioActual } from "../lib/sesion.mjs";
import { PRODUCTOS } from "../lib/catalogo.mjs";

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".pdf": "application/pdf",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".woff2": "font/woff2"
};

// Carpeta raíz de los productos: donde Netlify deja los included_files.
function raiz() {
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const candidatas = [
    path.join(process.cwd(), "privado", "productos"),
    path.resolve(aqui, "..", "..", "privado", "productos"),
    path.resolve(aqui, "privado", "productos")
  ];
  return candidatas.find(c => existsSync(c)) || candidatas[0];
}

const redirigir = url => new Response(null, { status: 302, headers: { location: url, "cache-control": "no-store" } });

// Botón discreto para volver a la cuenta, agregado a cada producto.
const VOLVER = `<a href="/cuenta.html" style="position:fixed;left:12px;bottom:12px;z-index:2147483000;font:700 13px/1 'Mulish',system-ui,sans-serif;background:#594B43;color:#F8F3EB;text-decoration:none;padding:10px 14px;border-radius:999px;box-shadow:0 10px 24px -12px rgba(0,0,0,.6);opacity:.92">← Mi cuenta</a>`;

export default async req => {
  const url = new URL(req.url);
  const partes = url.pathname.split("/").filter(Boolean); // ["productos", id, ...archivo]
  const id = partes[1];
  if (!id || !PRODUCTOS[id] || PRODUCTOS[id].incluye || PRODUCTOS[id].evento) return new Response("No encontrado", { status: 404 });
  if (partes.length === 2 && !url.pathname.endsWith("/")) return redirigir(`/productos/${id}/`);

  const relativo = partes.slice(2).join("/") || "index.html";
  if (relativo.includes("..") || relativo.includes("\\")) return new Response("No encontrado", { status: 404 });
  const esPagina = relativo === "index.html";

  const sql = await conDb();
  const u = await usuarioActual(req, sql);
  if (!u) return esPagina ? redirigir(`/cuenta.html?volver=${encodeURIComponent(`/productos/${id}/`)}`) : new Response("Inicia sesión", { status: 401 });

  const acceso = await sql`select 1 from accesos where usuario_id = ${u.id} and producto = ${id}`;
  if (!acceso.length) return esPagina ? redirigir(`/cuenta.html?sin_acceso=${id}`) : new Response("Sin acceso", { status: 403 });

  const archivo = path.join(raiz(), id, relativo);
  if (!archivo.startsWith(path.join(raiz(), id) + path.sep) || !existsSync(archivo)) return new Response("No encontrado", { status: 404 });

  const tipo = TIPOS[path.extname(archivo).toLowerCase()] || "application/octet-stream";
  if (esPagina) {
    await sql`update accesos set ultimo_uso = now() where usuario_id = ${u.id} and producto = ${id}`;
    let html = await readFile(archivo, "utf8");
    html = html.includes("</body>") ? html.replace(/<\/body>(?![\s\S]*<\/body>)/, VOLVER + "</body>") : html + VOLVER;
    return new Response(html, { headers: { "content-type": tipo, "cache-control": "private, no-store", "x-robots-tag": "noindex" } });
  }
  return new Response(await readFile(archivo), { headers: { "content-type": tipo, "cache-control": "private, max-age=86400" } });
};

export const config = { path: ["/productos/*"] };
