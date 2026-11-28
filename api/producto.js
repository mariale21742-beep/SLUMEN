// /productos/<id>/...  (vercel.json lo reescribe a /api/producto?ruta=<id>/...)
// Sirve cada producto SOLO a quien lo compró.
// Los archivos se leen de la tabla archivos_producto (cargada con scripts/subir-productos.mjs).
// Si un archivo no está en la base, se busca en la carpeta privado/productos/ (útil en desarrollo).
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { conDb, hayDb } from "../lib/db.mjs";
import { usuarioActual } from "../lib/sesion.mjs";
import { PRODUCTOS } from "../lib/catalogo.mjs";

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".pdf": "application/pdf",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".woff2": "font/woff2"
};

const redirigir = url => new Response(null, { status: 302, headers: { location: url, "cache-control": "no-store" } });
const noEncontrado = () => new Response("No encontrado", { status: 404 });

// Mientras la base de datos no esté lista, quien compró ve este aviso en vez de un error.
const EN_CAMINO = nombre => new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tu acceso está en camino · Slumen</title><meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Mulish:wght@400;700&display=swap">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F8F3EB;color:#594B43;font:400 17px/1.6 'Mulish',system-ui,sans-serif;padding:24px;box-sizing:border-box}
main{max-width:520px;background:#fff;border-radius:24px;padding:36px 28px;box-shadow:0 20px 50px -30px rgba(89,75,67,.5);text-align:center}
h1{font:600 34px/1.15 'Cormorant Garamond',serif;margin:0 0 12px}a{display:inline-block;margin:8px 4px 0;padding:13px 20px;border-radius:999px;font-weight:700;text-decoration:none}
.lleno{background:#7FD6CF;color:#2f2925}.linea{border:1.5px solid #594B43;color:#594B43}</style></head>
<body><main><h1>Tu acceso está en camino</h1>
<p>Gracias por comprar <strong>${nombre}</strong>. Estamos activando tu acceso y te lo enviamos al correo que escribiste en las próximas horas.</p>
<p>Si lo necesitas ya, escríbenos por WhatsApp y te lo compartimos de una.</p>
<a class="lleno" href="https://wa.me/573207563404?text=${encodeURIComponent("Hola, compré " + nombre + " en Slumen y quiero mi acceso.")}">Escribir por WhatsApp</a>
<a class="linea" href="/">Volver a Slumen</a></main></body></html>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });

// Botón discreto para volver a la cuenta, agregado a cada producto.
const VOLVER = `<a href="/cuenta.html" style="position:fixed;left:12px;bottom:12px;z-index:2147483000;font:700 13px/1 'Mulish',system-ui,sans-serif;background:#594B43;color:#F8F3EB;text-decoration:none;padding:10px 14px;border-radius:999px;box-shadow:0 10px 24px -12px rgba(0,0,0,.6);opacity:.92">← Mi cuenta</a>`;

async function leerArchivo(sql, id, relativo) {
  const filas = await sql`select tipo, contenido from archivos_producto where producto = ${id} and ruta = ${relativo}`;
  if (filas.length) return { tipo: filas[0].tipo, datos: filas[0].contenido };
  const raiz = path.join(process.cwd(), "privado", "productos", id);
  const archivo = path.join(raiz, relativo);
  if (!archivo.startsWith(raiz + path.sep) || !existsSync(archivo)) return null;
  return { tipo: TIPOS[path.extname(archivo).toLowerCase()] || "application/octet-stream", datos: await readFile(archivo) };
}

const manejar = async req => {
  const url = new URL(req.url);
  // En Vercel llega como ?ruta=metodo/index.html; si no, se toma de la ruta /productos/...
  const crudo = url.searchParams.get("ruta") ?? url.pathname.replace(/^\/(api\/producto|productos)\/?/, "");
  const partes = crudo.split("/").filter(Boolean);
  const id = partes[0];
  if (!id || !PRODUCTOS[id] || PRODUCTOS[id].incluye || PRODUCTOS[id].evento) return noEncontrado();
  if (partes.length === 1 && !crudo.endsWith("/")) return redirigir(`/productos/${id}/`);

  const relativo = partes.slice(1).join("/") || "index.html";
  if (relativo.includes("..") || relativo.includes("\\")) return noEncontrado();
  const esPagina = relativo === "index.html";

  const nombre = PRODUCTOS[id].es || id;
  if (!hayDb()) return esPagina ? EN_CAMINO(nombre) : new Response("No disponible", { status: 503 });
  let sql, u;
  try { sql = await conDb(); u = await usuarioActual(req, sql); }
  catch (e) { console.error("[producto]", e); return esPagina ? EN_CAMINO(nombre) : new Response("No disponible", { status: 503 }); }
  if (!u) return esPagina ? redirigir(`/cuenta.html?volver=${encodeURIComponent(`/productos/${id}/`)}`) : new Response("Inicia sesión", { status: 401 });

  const acceso = await sql`select 1 from accesos where usuario_id = ${u.id} and producto = ${id}`;
  if (!acceso.length) return esPagina ? redirigir(`/cuenta.html?sin_acceso=${id}`) : new Response("Sin acceso", { status: 403 });

  const archivo = await leerArchivo(sql, id, relativo);
  if (!archivo) return noEncontrado();

  if (esPagina) {
    await sql`update accesos set ultimo_uso = now() where usuario_id = ${u.id} and producto = ${id}`;
    let html = new TextDecoder().decode(archivo.datos);
    html = html.includes("</body>") ? html.replace(/<\/body>(?![\s\S]*<\/body>)/, VOLVER + "</body>") : html + VOLVER;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex" } });
  }
  return new Response(archivo.datos, { headers: { "content-type": archivo.tipo, "cache-control": "private, max-age=86400" } });
};

// Vercel: ruta /api/producto (y /productos/* por la regla de vercel.json).
export const GET = manejar;
