// Correos con Resend (https://resend.com): acceso para quien compra y aviso de venta para Aleja.
import { env } from "./util.mjs";
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

export async function enviarAcceso(pedido) {
  const en = pedido.idioma === "en";
  const ids = productosAEntregar(pedido.items);
  let faltan = 0;
  const filas = ids.map(id => {
    const p = PRODUCTOS[id];
    const url = env(p.acceso || "");
    if (!url) faltan++;
    const boton = url
      ? `<a href="${esc(url)}" style="display:inline-block;background:#826643;color:#F8F3EB;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:999px">${en ? "Open" : "Entrar"} →</a>`
      : `<span style="color:#7A6A60;font-size:14px">${en ? "Aleja will send you this access shortly." : "Aleja te enviará este acceso en breve."}</span>`;
    return `<tr><td style="padding:14px 0;border-top:1px solid #eadfd3"><b>${esc(en ? p.en : p.es)}</b><br><span style="font-size:13px;color:#7A6A60">${esc(p.eje[en ? 1 : 0])}</span></td><td align="right" style="padding:14px 0;border-top:1px solid #eadfd3">${boton}</td></tr>`;
  }).join("");

  const nombre = esc((pedido.nombre || "").split(" ")[0]);
  const cuerpo = en
    ? `<p style="font-family:Georgia,serif;font-size:26px;margin:0 0 12px">Thank you, ${nombre}.</p>
       <p>Your payment was confirmed. Here is everything you bought. Save this email: these links are your access.</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>
       <p style="margin-top:24px">Go slowly, at your own pace. I’m walking with you.<br>— Aleja</p>
       <p style="font-size:13px;color:#7A6A60">Order ${esc(pedido.ref)}</p>`
    : `<p style="font-family:Georgia,serif;font-size:26px;margin:0 0 12px">Gracias, ${nombre}.</p>
       <p>Tu pago quedó confirmado. Aquí tienes todo lo que elegiste. Guarda este correo: estos enlaces son tu acceso.</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>
       <p style="margin-top:24px">Ve despacio, a tu ritmo. Aquí camino contigo.<br>— Aleja</p>
       <p style="font-size:13px;color:#7A6A60">Pedido ${esc(pedido.ref)}</p>`;

  await enviar({
    para: pedido.email,
    asunto: en ? "Your Slumen access" : "Tu acceso a Slumen",
    html: marco(cuerpo),
    responderA: env("EMAIL_AVISO")
  });
  if (faltan) console.warn(`[correo] Pedido ${pedido.ref}: ${faltan} producto(s) sin enlace de acceso configurado.`);
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
