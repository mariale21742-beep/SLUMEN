// El precio SIEMPRE se calcula aquí, en el servidor, a partir de catalogo.json.
// Nunca se confía en el total que envía el navegador.
import catalogo from "../../catalogo.json";

export const PRODUCTOS = catalogo.productos;
export const PASARELAS = catalogo.pasarelas;

// Limpia el carrito: solo ids válidos, sin repetidos, y si está el pack quita lo que ya incluye.
export function limpiarCarrito(ids) {
  const vistos = [...new Set((Array.isArray(ids) ? ids : []).filter(id => PRODUCTOS[id]))];
  if (vistos.includes("pack")) {
    const incluidos = PRODUCTOS.pack.incluye || [];
    return vistos.filter(id => id === "pack" || !incluidos.includes(id));
  }
  return vistos;
}

// Devuelve las líneas del pedido y el total en la moneda de la pasarela.
// COP: valores enteros en pesos. USD: valores en centavos para evitar errores de decimales.
export function armarPedido(ids, moneda, idioma = "es") {
  const items = limpiarCarrito(ids);
  const lineas = items.map(id => {
    const p = PRODUCTOS[id];
    const valor = moneda === "USD" ? Math.round(p.usd * 100) : p.cop;
    return { id, nombre: idioma === "en" ? p.en : p.es, valor };
  });
  const total = lineas.reduce((s, l) => s + l.valor, 0);
  return { items, lineas, total, moneda };
}

// Monto en la unidad mínima que usan las pasarelas para comparar pagos: centavos en ambas monedas.
export const enCentavos = pedido => pedido.moneda === "USD" ? pedido.total : pedido.total * 100;

// Lista de productos que se entregan (el pack se abre en sus cinco productos).
export function productosAEntregar(items) {
  const lista = [];
  for (const id of items) {
    const p = PRODUCTOS[id];
    if (p && p.incluye) lista.push(...p.incluye); else lista.push(id);
  }
  return [...new Set(lista)];
}
