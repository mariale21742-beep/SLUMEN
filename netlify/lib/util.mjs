// Utilidades compartidas por las funciones de pago (sin dependencias: Web Crypto de Node 18+).

export const env = (nombre, porDefecto = "") => (process.env[nombre] || porDefecto).trim();

export function json(datos, estado = 200) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const bytes = txt => new TextEncoder().encode(txt);

export async function sha256(texto) {
  return hex(await crypto.subtle.digest("SHA-256", bytes(texto)));
}

export async function hmacSha256(secreto, texto) {
  const llave = await crypto.subtle.importKey("raw", bytes(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", llave, bytes(texto)));
}

// Comparación en tiempo constante para firmas en hexadecimal.
export function iguales(a, b) {
  a = String(a || ""); b = String(b || "");
  if (a.length !== b.length || !a.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// URL pública del sitio: SITIO_URL o la que Netlify entrega en cada despliegue.
export function sitioUrl() {
  return (env("SITIO_URL") || env("URL") || "http://localhost:8888").replace(/\/+$/, "");
}

export function nuevaReferencia() {
  const azar = [...crypto.getRandomValues(new Uint8Array(3))].map(b => b.toString(16).padStart(2, "0")).join("");
  return ("SLM-" + Date.now().toString(36) + "-" + azar).toUpperCase();
}

// Token aleatorio seguro (base64url, 32 bytes) para sesiones y enlaces de acceso.
export function tokenAleatorio() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function leerCookies(req) {
  const out = {};
  (req.headers.get("cookie") || "").split(";").forEach(p => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

// Solo rutas internas del sitio (evita redirecciones a otros dominios).
export function rutaSegura(volver, porDefecto = "/cuenta.html") {
  const v = String(volver || "");
  return /^\/(?!\/)[\w\-./?=&#%]*$/.test(v) ? v : porDefecto;
}

export const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
