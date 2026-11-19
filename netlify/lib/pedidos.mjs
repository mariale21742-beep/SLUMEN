// Guarda cada pedido (Netlify Blobs) y entrega los productos una sola vez cuando el pago se confirma.
import { getStore } from "@netlify/blobs";
import { enCentavos } from "./catalogo.mjs";
import { enviarAcceso, avisarVenta } from "./correo.mjs";

const tienda = () => getStore({ name: "pedidos", consistency: "strong" });

export async function guardarPedido(pedido) {
  await tienda().setJSON(pedido.ref, pedido);
}

export async function leerPedido(ref) {
  if (!ref) return null;
  return tienda().get(ref, { type: "json" });
}

// Recibe el resultado verificado con la pasarela y, si todo cuadra, envía el correo de acceso.
export async function confirmarPago(pasarela, resultado, idTransaccion) {
  const pedido = await leerPedido(resultado.ref);
  if (!pedido) return { estado: "desconocido" };
  if (pedido.estado === "entregado") return { estado: "aprobado", ref: pedido.ref, email: pedido.email };

  if (resultado.estado !== "aprobado") {
    if (pedido.estado !== resultado.estado) await guardarPedido({ ...pedido, estado: resultado.estado, actualizado: new Date().toISOString() });
    return { estado: resultado.estado, ref: pedido.ref };
  }

  // El monto y la moneda cobrados deben coincidir con el pedido guardado.
  if (pedido.pasarela !== pasarela || Number(resultado.centavos) !== enCentavos(pedido) || String(resultado.moneda).toUpperCase() !== pedido.moneda) {
    await guardarPedido({ ...pedido, estado: "revisar", nota: "El monto o la moneda del pago no coinciden", pago: resultado, actualizado: new Date().toISOString() });
    await avisarVenta({ ...pedido, estado: "revisar" }, "El monto del pago no coincide. Revísalo antes de entregar.");
    return { estado: "revisar", ref: pedido.ref };
  }

  const aprobado = { ...pedido, estado: "aprobado", transaccion: idTransaccion, pagado: new Date().toISOString() };
  await guardarPedido(aprobado);
  await enviarAcceso(aprobado);
  await avisarVenta(aprobado);
  await guardarPedido({ ...aprobado, estado: "entregado", entregado: new Date().toISOString() });
  return { estado: "aprobado", ref: pedido.ref, email: pedido.email };
}
