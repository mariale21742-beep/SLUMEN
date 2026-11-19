// Una entrada por pasarela. Cada una sabe:
//   habilitada()      -> true si está activa en catalogo.json y sus llaves están en Vercel
//   crear(pedido)     -> URL a donde se envía a la persona para pagar
//   verificar(id)     -> consulta a la pasarela (fuente de verdad) y devuelve
//                        { estado: "aprobado" | "pendiente" | "rechazado", ref, centavos, moneda, email, nombre }
import { env, sha256, sitioUrl } from "./util.mjs";
import { PASARELAS } from "./catalogo.mjs";

const gracias = () => sitioUrl() + "/gracias.html";
const volver = () => sitioUrl() + "/checkout.html";

async function pedirJson(url, opciones = {}) {
  const r = await fetch(url, opciones);
  const texto = await r.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = { crudo: texto }; }
  if (!r.ok) {
    const err = new Error(`HTTP ${r.status} en ${new URL(url).host}`);
    err.estado = r.status; err.datos = datos;
    throw err;
  }
  return datos;
}

/* ------------------------------ WOMPI (COP) ------------------------------ */
// Web Checkout por redirección: https://docs.wompi.co/docs/colombia/widget-checkout-web/
const wompiApi = () => env("WOMPI_PUBLIC_KEY").startsWith("pub_prod_")
  ? "https://production.wompi.co/v1" : "https://sandbox.wompi.co/v1";

const ESTADO_WOMPI = { APPROVED: "aprobado", PENDING: "pendiente" };

export const wompi = {
  habilitada: () => !!(env("WOMPI_PUBLIC_KEY") && env("WOMPI_INTEGRITY_SECRET")),
  async crear(p) {
    const centavos = String(p.total * 100);
    const firma = await sha256(p.ref + centavos + "COP" + env("WOMPI_INTEGRITY_SECRET"));
    const q = new URLSearchParams({
      "public-key": env("WOMPI_PUBLIC_KEY"),
      currency: "COP",
      "amount-in-cents": centavos,
      reference: p.ref,
      "signature:integrity": firma,
      "redirect-url": gracias(),
      "customer-data:email": p.email,
      "customer-data:full-name": p.nombre
    });
    return "https://checkout.wompi.co/p/?" + q.toString();
  },
  async verificar(id) {
    const { data: t } = await pedirJson(`${wompiApi()}/transactions/${encodeURIComponent(id)}`);
    return {
      estado: ESTADO_WOMPI[t.status] || "rechazado",
      ref: t.reference, centavos: t.amount_in_cents, moneda: t.currency,
      email: t.customer_email, nombre: t.customer_data && t.customer_data.full_name
    };
  }
};

/* --------------------------- MERCADO PAGO (COP) --------------------------- */
// Checkout Pro: https://www.mercadopago.com.co/developers/es/docs/checkout-pro
const mpAuth = () => ({ authorization: "Bearer " + env("MP_ACCESS_TOKEN") });
const ESTADO_MP = { approved: "aprobado", pending: "pendiente", in_process: "pendiente", authorized: "pendiente" };

export const mercadopago = {
  habilitada: () => !!env("MP_ACCESS_TOKEN"),
  async crear(p) {
    const pref = await pedirJson("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { ...mpAuth(), "content-type": "application/json", "x-idempotency-key": p.ref },
      body: JSON.stringify({
        items: p.lineas.map(l => ({ id: l.id, title: l.nombre, quantity: 1, unit_price: l.valor, currency_id: "COP" })),
        payer: { email: p.email, name: p.nombre },
        external_reference: p.ref,
        back_urls: { success: gracias(), pending: gracias(), failure: volver() },
        auto_return: "approved",
        notification_url: sitioUrl() + "/api/webhook-mercadopago",
        statement_descriptor: "SLUMEN"
      })
    });
    return pref.init_point;
  },
  async verificar(id) {
    const pago = await pedirJson(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, { headers: mpAuth() });
    return {
      estado: ESTADO_MP[pago.status] || "rechazado",
      ref: pago.external_reference, centavos: Math.round(Number(pago.transaction_amount) * 100), moneda: pago.currency_id,
      email: pago.payer && pago.payer.email, nombre: ""
    };
  }
};

/* ------------------------------ PAYPAL (USD) ------------------------------ */
// Orders v2: https://developer.paypal.com/docs/api/orders/v2/
const paypalApi = () => env("PAYPAL_ENTORNO") === "produccion" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const usd = centavos => (centavos / 100).toFixed(2);

async function paypalToken() {
  const basic = btoa(env("PAYPAL_CLIENT_ID") + ":" + env("PAYPAL_SECRET"));
  const r = await pedirJson(paypalApi() + "/v1/oauth2/token", {
    method: "POST",
    headers: { authorization: "Basic " + basic, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  return r.access_token;
}

function resultadoPaypal(orden) {
  const unidad = (orden.purchase_units || [])[0] || {};
  const captura = ((unidad.payments || {}).captures || [])[0] || {};
  const monto = captura.amount || unidad.amount || {};
  const ok = orden.status === "COMPLETED" && (!captura.status || captura.status === "COMPLETED");
  return {
    estado: ok ? "aprobado" : (captura.status === "PENDING" ? "pendiente" : "rechazado"),
    ref: captura.custom_id || unidad.custom_id || unidad.reference_id,
    centavos: Math.round(Number(monto.value) * 100), moneda: monto.currency_code,
    email: orden.payer && orden.payer.email_address,
    nombre: orden.payer && orden.payer.name ? [orden.payer.name.given_name, orden.payer.name.surname].filter(Boolean).join(" ") : ""
  };
}

export const paypal = {
  habilitada: () => !!(env("PAYPAL_CLIENT_ID") && env("PAYPAL_SECRET")),
  async crear(p) {
    const token = await paypalToken();
    const orden = await pedirJson(paypalApi() + "/v2/checkout/orders", {
      method: "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json", "paypal-request-id": p.ref },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: p.ref, custom_id: p.ref, description: "Slumen",
          amount: { currency_code: "USD", value: usd(p.total), breakdown: { item_total: { currency_code: "USD", value: usd(p.total) } } },
          items: p.lineas.map(l => ({ name: l.nombre.slice(0, 127), quantity: "1", category: "DIGITAL_GOODS", unit_amount: { currency_code: "USD", value: usd(l.valor) } }))
        }],
        payment_source: { paypal: { experience_context: {
          brand_name: "Slumen", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW",
          locale: p.idioma === "en" ? "en-US" : "es-CO", return_url: gracias(), cancel_url: volver()
        } } }
      })
    });
    const link = (orden.links || []).find(l => l.rel === "payer-action" || l.rel === "approve");
    if (!link) throw new Error("PayPal no devolvió el enlace de pago");
    return link.href;
  },
  // En PayPal el cobro se "captura" cuando la persona vuelve a gracias.html.
  async verificar(id) {
    const token = await paypalToken();
    const auth = { authorization: "Bearer " + token, "content-type": "application/json" };
    try {
      const orden = await pedirJson(`${paypalApi()}/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {
        method: "POST", headers: { ...auth, "paypal-request-id": "captura-" + id }
      });
      return resultadoPaypal(orden);
    } catch (e) {
      // Si ya estaba capturada (o aún no se aprobó), consultamos el estado actual.
      if (e.estado !== 422) throw e;
      const orden = await pedirJson(`${paypalApi()}/v2/checkout/orders/${encodeURIComponent(id)}`, { headers: auth });
      if (orden.status !== "COMPLETED") return { ...resultadoPaypal(orden), estado: "pendiente" };
      return resultadoPaypal(orden);
    }
  }
};

/* ------------------------------ STRIPE (USD) ------------------------------ */
// Checkout Sessions: https://docs.stripe.com/api/checkout/sessions
const stripeAuth = () => ({ authorization: "Bearer " + env("STRIPE_SECRET_KEY") });

export const stripe = {
  habilitada: () => !!env("STRIPE_SECRET_KEY"),
  async crear(p) {
    const f = new URLSearchParams({
      mode: "payment",
      success_url: gracias() + "?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: volver(),
      customer_email: p.email,
      client_reference_id: p.ref,
      "metadata[ref]": p.ref,
      "payment_intent_data[metadata][ref]": p.ref,
      locale: p.idioma === "en" ? "en" : "es"
    });
    p.lineas.forEach((l, i) => {
      f.append(`line_items[${i}][quantity]`, "1");
      f.append(`line_items[${i}][price_data][currency]`, "usd");
      f.append(`line_items[${i}][price_data][unit_amount]`, String(l.valor));
      f.append(`line_items[${i}][price_data][product_data][name]`, l.nombre);
    });
    const sesion = await pedirJson("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { ...stripeAuth(), "content-type": "application/x-www-form-urlencoded", "idempotency-key": p.ref },
      body: f.toString()
    });
    return sesion.url;
  },
  async verificar(id) {
    const s = await pedirJson(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, { headers: stripeAuth() });
    return {
      estado: s.payment_status === "paid" ? "aprobado" : (s.status === "expired" ? "rechazado" : "pendiente"),
      ref: s.client_reference_id || (s.metadata && s.metadata.ref), centavos: s.amount_total, moneda: String(s.currency || "").toUpperCase(),
      email: (s.customer_details && s.customer_details.email) || s.customer_email,
      nombre: s.customer_details && s.customer_details.name
    };
  }
};

// Solo se usan las pasarelas marcadas "activa": true en catalogo.json (hoy: Wompi).
const MOTORES = { wompi, mercadopago, paypal, stripe };
export const TODAS = Object.fromEntries(Object.entries(MOTORES).map(([k, m]) => [k, {
  ...m, habilitada: () => !!(PASARELAS[k] && PASARELAS[k].activa) && m.habilitada()
}]));
