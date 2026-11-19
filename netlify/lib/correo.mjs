// Correos con Resend (https://resend.com): acceso para quien compra y aviso de venta para Aleja.
import { env, sitioUrl } from "./util.mjs";
import { PRODUCTOS, productosAEntregar } from "./catalogo.mjs";

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function enviar({ para, asunto, html, responderA }) {
  if (!env("RESEND_API_KEY") || !env("EMAIL_REMITENTE")) {
    console.warn("[correo] Falta RESEND_API_KEY o EMAIL_REMITENTE: no se envió", asunto, "a", para);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + env("RESEND_API_KEY"), "content-type": "application/json" },
    body: JSON.stringify({ from: env("EMAIL_REMITENTE"), to: [para], subject: asunto, html, reply_to: responderA || undefined })
  });
  if (!r.ok) throw new Error("Resend respondió " + r.status + ": " + (await r.text()).slice(0, 300));
}

const marco = cuerpo => `<!doctype html><html><body style="margin:0;background:#F8F3EB;font-family:Mulish,Segoe UI,Arial,sans-serif;color:#594B43">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F3EB;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFDF9;border-radius:24px;overflow:hidden">
<tr><td style="background:#ADFEF5;padding:28px 32px;font-family:Georgia,serif;font-size:30px;color:#826643">Slumen</td></tr>
<tr><td style="padding:32px;font-size:16px;line-height:1.6">${cuerpo}</td></tr>
<tr><td style="padding:0 32px 28px;font-size:13px;color:#7A6A60">Slumen · Reconecta con tu ser</td></tr>
</table></td></tr></table></body></html>`;

const boton = (url, texto) => `<a href="${esc(url)}" style="display:inline-block;background:#826643;color:#F8F3EB;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${texto}</a>`;

// Correo después de pagar: lista de productos y enlace para entrar a la cuenta sin contraseña.
export async function enviarAcceso(pedido, enlaceEntrar) {
  const en = pedido.idioma === "en";
  const filas = productosAEntregar(pedido.items).map(id => {
    const p = PRODUCTOS[id];
    const url = `${sitioUrl()}/productos/${id}/`;
    return `<tr><td style="padding:14px 0;border-top:1px solid #eadfd3"><b>${esc(en ? p.en : p.es)}</b><br><span style="font-size:13px;color:#7A6A60">${esc(p.eje[en ? 1 : 0])}</span></td><td align="right" style="padding:14px 0;border-top:1px solid #eadfd3"><a href="${esc(url)}" style="color:#826643;font-weight:700">${en ? "Open" : "Abrir"} →</a></td></tr>`;
  }).join("");

  const nombre = esc((pedido.nombre || "").split(" ")[0]);
  const cuerpo = en
    ? `<p style="font-family:Georgia,serif;font-size:26px;margin:0 0 12px">Thank you, ${nombre}.</p>
       <p>Your payment was confirmed and your Slumen account is ready. Everything you bought lives there, together with your purchase history.</p>
       <p style="margin:22px 0">${boton(enlaceEntrar, "Enter my account →")}</p>
       <p style="font-size:14px;color:#7A6A60">This button signs you in without a password and works for 3 days. After that, sign in any time with your email at ${esc(sitioUrl())}/cuenta.html</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>
       <p style="margin-top:24px">Go slowly, at your own pace. I’m walking with you.<br>— Aleja</p>
       <p style="font-size:13px;color:#7A6A60">Order ${esc(pedido.ref)}</p>`
    : `<p style="font-family:Georgia,serif;font-size:26px;margin:0 0 12px">Gracias, ${nombre}.</p>
       <p>Tu pago quedó confirmado y tu cuenta de Slumen ya está lista. Ahí encuentras todo lo que elegiste y el historial de tus compras.</p>
       <p style="margin:22px 0">${boton(enlaceEntrar, "Entrar a mi cuenta →")}</p>
       <p style="font-size:14px;color:#7A6A60">Este botón te deja entrar sin contraseña y sirve por 3 días. Después, entra cuando quieras con tu correo en ${esc(sitioUrl())}/cuenta.html</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>
       <p style="margin-top:24px">Ve despacio, a tu ritmo. Aquí camino contigo.<br>— Aleja</p>
       <p style="font-size:13px;color:#7A6A60">Pedido ${esc(pedido.ref)}</p>`;

  await enviar({ para: pedido.email, asunto: en ? "Your Slumen access" : "Tu acceso a Slumen", html: marco(cuerpo), responderA: env("EMAIL_AVISO") });
}

// Correo para iniciar sesión (enlace mágico, sin contraseña).
export async function enviarEnlace(email, enlace, idioma = "es") {
  const en = idioma === "en";
  const cuerpo = en
    ? `<p style="font-family:Georgia,serif;font-size:26px;margin:0 0 12px">Your way back in.</p>
       <p>Tap the button to enter your Slumen account. It works once and expires in 30 minutes.</p>
       <p style="margin:22px 0">${boton(enlace, "Enter Slumen →")}</p>
       <p style="font-size:14px;color:#7A6A60">If you didn’t ask for this, you can ignore this email.</p>`
    : `<p style="font-family:Georgia,serif;font-size:26px;margin:0 0 12px">Tu camino de regreso.</p>
       <p>Toca el botón para entrar a tu cuenta de Slumen. Sirve una sola vez y vence en 30 minutos.</p>
       <p style="margin:22px 0">${boton(enlace, "Entrar a Slumen →")}</p>
       <p style="font-size:14px;color:#7A6A60">Si no lo pediste, puedes ignorar este correo.</p>`;
  await enviar({ para: email, asunto: en ? "Enter Slumen" : "Entra a Slumen", html: marco(cuerpo) });
}

export async function avisarVenta(pedido, nota = "") {
  if (!env("EMAIL_AVISO")) return;
  const total = pedido.moneda === "USD" ? "US$" + (pedido.total / 100).toFixed(2) : "$" + pedido.total.toLocaleString("es-CO") + " COP";
  const lista = pedido.lineas.map(l => `<li>${esc(l.nombre)}</li>`).join("");
  await enviar({
    para: env("EMAIL_AVISO"),
    asunto: (nota ? "⚠️ Revisar venta " : "Nueva venta ") + pedido.ref + " · " + total,
    html: marco(`${nota ? `<p style="color:#9b2c2c"><b>${esc(nota)}</b></p>` : ""}
      <p><b>${esc(pedido.nombre)}</b> · ${esc(pedido.email)}${pedido.celular ? " · " + esc(pedido.celular) : ""}</p>
      <ul>${lista}</ul><p>Total: <b>${total}</b> por ${esc(pedido.pasarela)}<br>Pedido ${esc(pedido.ref)}</p>`)
  });
}
