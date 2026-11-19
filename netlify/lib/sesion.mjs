// Sesiones con cookie HttpOnly. En la base solo se guarda el hash del token.
import { sha256, tokenAleatorio, leerCookies, sitioUrl } from "./util.mjs";

export const COOKIE = "slumen_sesion";
const DIAS_SESION = 30;

function cookie(valor, maxAge) {
  const segura = sitioUrl().startsWith("https://") ? "; Secure" : "";
  return `${COOKIE}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${segura}`;
}

export async function crearSesion(sql, usuarioId, agente = "") {
  const token = tokenAleatorio();
  await sql`insert into sesiones (id_hash, usuario_id, expira, agente)
            values (${await sha256(token)}, ${usuarioId}, now() + ${DIAS_SESION + " days"}::interval, ${String(agente).slice(0, 200)})`;
  await sql`update usuarios set ultimo_acceso = now() where id = ${usuarioId}`;
  return cookie(token, DIAS_SESION * 86400);
}

export const cookieBorrada = () => cookie("", 0);

// Devuelve el usuario de la sesión o null.
export async function usuarioActual(req, sql) {
  const token = leerCookies(req)[COOKIE];
  if (!token) return null;
  const filas = await sql`select u.* from sesiones s join usuarios u on u.id = s.usuario_id
                          where s.id_hash = ${await sha256(token)} and s.expira > now()`;
  return filas[0] || null;
}

export async function cerrarSesion(req, sql) {
  const token = leerCookies(req)[COOKIE];
  if (token) await sql`delete from sesiones where id_hash = ${await sha256(token)}`;
}

// Crea un enlace de acceso de un solo uso. Devuelve el token en claro (va en el correo).
export async function crearEnlace(sql, email, { minutos = 30, acepta = false } = {}) {
  const token = tokenAleatorio();
  await sql`insert into enlaces_acceso (token_hash, email, acepta, expira)
            values (${await sha256(token)}, ${email}, ${acepta}, now() + ${minutos + " minutes"}::interval)`;
  return token;
}

// Busca o crea el usuario por correo.
export async function usuarioPorCorreo(sql, email, datos = {}) {
  const filas = await sql`insert into usuarios (email, nombre, celular, idioma, acepta_novedades, acepta_datos_en)
    values (${email}, ${datos.nombre || null}, ${datos.celular || null}, ${datos.idioma || "es"},
            ${!!datos.acepta_novedades}, ${datos.acepta ? new Date() : null})
    on conflict (email) do update set
      nombre = coalesce(usuarios.nombre, excluded.nombre),
      celular = coalesce(usuarios.celular, excluded.celular),
      acepta_novedades = usuarios.acepta_novedades or excluded.acepta_novedades,
      acepta_datos_en = coalesce(usuarios.acepta_datos_en, excluded.acepta_datos_en)
    returning *`;
  return filas[0];
}
