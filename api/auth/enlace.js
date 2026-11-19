// POST /api/auth/enlace  { email, volver, idioma, acepta }
// Envía un enlace de acceso al correo. Siempre responde igual, exista o no la cuenta.
import { conDb } from "../../lib/db.mjs";
import { crearEnlace } from "../../lib/sesion.mjs";
import { enviarEnlace } from "../../lib/correo.mjs";
import { json, sitioUrl, rutaSegura, CORREO_VALIDO } from "../../lib/util.mjs";

const manejar = async req => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  let d = {};
  try { d = await req.json(); } catch {}
  const email = String(d.email || "").trim().toLowerCase().slice(0, 120);
  const idioma = d.idioma === "en" ? "en" : "es";
  if (!CORREO_VALIDO.test(email)) return json({ error: idioma === "en" ? "Check your email address." : "Revisa tu correo." }, 400);
  if (!d.acepta) return json({ error: idioma === "en" ? "Please accept the data policy to continue." : "Acepta la política de datos para continuar." }, 400);

  try {
    const sql = await conDb();
    await sql`delete from enlaces_acceso where expira < now() - interval '1 day'`;
    const recientes = await sql`select count(*)::int as n from enlaces_acceso where email = ${email} and creado > now() - interval '1 hour'`;
    if (recientes[0].n < 5) {
      const token = await crearEnlace(sql, email, { minutos: 30, acepta: true });
      const volver = rutaSegura(d.volver);
      const enlace = `${sitioUrl()}/entrar.html?t=${encodeURIComponent(token)}&volver=${encodeURIComponent(volver)}`;
      await enviarEnlace(email, enlace, idioma);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("[auth-enlace]", e.message);
    return json({ error: idioma === "en" ? "We couldn’t send the email. Try again in a moment." : "No pudimos enviar el correo. Intenta de nuevo en un momento." }, 500);
  }
};

// Vercel: cada archivo de /api es una ruta (por ejemplo /api/auth/enlace).
export const GET = manejar;
export const POST = manejar;
