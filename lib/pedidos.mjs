// Pedidos en PostgreSQL. Cuando un pago se confirma: crea (o encuentra) la cuenta por correo,
// le da acceso a los productos y envía el correo de bienvenida. Todo una sola vez por pedido.
import { conDb } from "./db.mjs";
import { enCentavos, productosAEntregar } from "./catalogo.mjs";
import { usuarioPorCorreo, crearEnlace } from "./sesion.mjs";
import { enviarAcceso, avisarVenta } from "./correo.mjs";
import { sitioUrl } from "./util.mjs";

export async function guardarPedido(p) {
  const sql = await conDb();
  await sql`insert into pedidos (ref, usuario_id, email, nombre, celular, documento, pasarela, moneda, total, items, lineas, idioma, acepta_novedades, estado)
            values (${p.ref}, ${p.usuarioId || null}, ${p.email}, ${p.nombre}, ${p.celular || null}, ${p.documento || null}, ${p.pasarela}, ${p.moneda},
                    ${p.total}, ${JSON.stringify(p.items)}::jsonb, ${JSON.stringify(p.lineas)}::jsonb, ${p.idioma}, ${!!p.aceptaNovedades}, 'creado')`;
}

const comoPedido = f => f && ({ ...f, total: Number(f.total), items: f.items, lineas: f.lineas });

export async function confirmarPago(pasarela, resultado, idTransaccion) {
  const sql = await conDb();
  const pedido = comoPedido((await sql`select * from pedidos where ref = ${String(resultado.ref || "")}`)[0]);
  if (!pedido) return { estado: "desconocido" };
  if (pedido.estado === "entregado") return { estado: "aprobado", ref: pedido.ref, email: pedido.email };

  if (resultado.estado !== "aprobado") {
    if (["creado", "pendiente", "rechazado"].includes(pedido.estado) && pedido.estado !== resultado.estado) {
      await sql`update pedidos set estado = ${resultado.estado}, actualizado = now() where ref = ${pedido.ref}`;
    }
    return { estado: resultado.estado, ref: pedido.ref };
  }

  // El monto y la moneda cobrados deben coincidir con lo que calculó el servidor.
  if (pedido.pasarela !== pasarela || Number(resultado.centavos) !== enCentavos(pedido) || String(resultado.moneda).toUpperCase() !== pedido.moneda) {
    if (pedido.estado !== "revisar") {
      await sql`update pedidos set estado = 'revisar', nota = 'El monto o la moneda del pago no coinciden',
                pago = ${JSON.stringify(resultado)}::jsonb, actualizado = now() where ref = ${pedido.ref}`;
      await avisarVenta({ ...pedido, estado: "revisar" }, "El monto del pago no coincide. Revísalo antes de entregar.");
    }
    return { estado: "revisar", ref: pedido.ref };
  }

  // Candado: solo un proceso (webhook o página de gracias) hace la entrega.
  const tomado = await sql`update pedidos set estado = 'entregando', transaccion = ${String(idTransaccion)},
      pagado = coalesce(pagado, now()), pago = ${JSON.stringify(resultado)}::jsonb, actualizado = now()
    where ref = ${pedido.ref}
      and (estado not in ('entregando', 'entregado') or (estado = 'entregando' and actualizado < now() - interval '5 minutes'))
    returning ref`;
  if (!tomado.length) return { estado: "aprobado", ref: pedido.ref, email: pedido.email };

  try {
    const usuario = await usuarioPorCorreo(sql, pedido.email, {
      nombre: pedido.nombre, celular: pedido.celular, documento: pedido.documento, idioma: pedido.idioma,
      acepta_novedades: pedido.acepta_novedades, acepta: true
    });
    await sql`update pedidos set usuario_id = ${usuario.id} where ref = ${pedido.ref}`;
    for (const producto of productosAEntregar(pedido.items)) {
      await sql`insert into accesos (usuario_id, producto, pedido_ref) values (${usuario.id}, ${producto}, ${pedido.ref})
                on conflict (usuario_id, producto) do nothing`;
    }
    // Enlace para entrar a la cuenta sin contraseña, válido 3 días.
    const token = await crearEnlace(sql, pedido.email, { minutos: 72 * 60, acepta: true });
    const entrar = `${sitioUrl()}/entrar.html?t=${encodeURIComponent(token)}`;
    // Si el correo falla, la compra igual queda entregada: la persona entra desde la página de gracias o con su correo.
    try { await enviarAcceso(pedido, entrar); } catch (e) { console.error("[pedidos] correo de acceso", pedido.ref, e.message); }
    try { await avisarVenta(pedido); } catch (e) { console.error("[pedidos] aviso de venta", pedido.ref, e.message); }
    await sql`update pedidos set estado = 'entregado', entregado = now(), actualizado = now() where ref = ${pedido.ref}`;
    return { estado: "aprobado", ref: pedido.ref, email: pedido.email };
  } catch (e) {
    await sql`update pedidos set estado = 'error_entrega', nota = ${String(e.message).slice(0, 300)}, actualizado = now() where ref = ${pedido.ref}`;
    throw e;
  }
}
