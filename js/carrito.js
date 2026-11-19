/* Carrito de Slumen: compartido por index.html, checkout.html y gracias.html.
   Guarda solo los ids de producto en el navegador; los precios reales los calcula el servidor. */
(function () {
  var CLAVE = "slumen-carrito";
  var memoria = [];
  var catalogo = null, promesa = null;

  function leer() {
    try {
      var v = JSON.parse(localStorage.getItem(CLAVE) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return memoria.slice(); }
  }
  function guardar(lista) {
    memoria = lista.slice();
    try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch (e) {}
    window.dispatchEvent(new CustomEvent("slumencarrito", { detail: lista.slice() }));
  }
  function cargar() {
    if (!promesa) promesa = fetch("catalogo.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (c) { catalogo = c; return c; });
    return promesa;
  }
  function idioma() {
    if (window.SLUMEN_I18N && SLUMEN_I18N.lang) return SLUMEN_I18N.lang;
    try { var l = localStorage.getItem("slumen-lang"); if (l === "es" || l === "en") return l; } catch (e) {}
    return /^en/i.test(navigator.language || "") ? "en" : "es";
  }
  // Agrega un producto. Devuelve "ok", "ya" (ya estaba) o "incluido" (ya viene en el pack).
  function agregar(id) {
    var lista = leer();
    var incluye = (catalogo && catalogo.productos.pack.incluye) || [];
    if (lista.indexOf(id) >= 0) return "ya";
    if (id !== "pack" && lista.indexOf("pack") >= 0 && incluye.indexOf(id) >= 0) return "incluido";
    if (id === "pack") lista = lista.filter(function (x) { return incluye.indexOf(x) < 0; });
    lista.push(id);
    guardar(lista);
    return "ok";
  }
  function quitar(id) { guardar(leer().filter(function (x) { return x !== id; })); }
  function vaciar() { guardar([]); }

  // Valor y formato según moneda. COP en pesos enteros; USD con dos decimales.
  function valor(p, moneda) { return moneda === "USD" ? Math.round(p.usd * 100) : p.cop; }
  function precio(v, moneda) {
    if (moneda === "USD") return "US$" + (v / 100).toFixed(2);
    return "$" + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  function lineas(moneda, lang) {
    if (!catalogo) return [];
    return leer().filter(function (id) { return catalogo.productos[id]; }).map(function (id) {
      var p = catalogo.productos[id];
      return { id: id, nombre: lang === "en" ? p.en : p.es, eje: p.eje[lang === "en" ? 1 : 0], valor: valor(p, moneda), antes: moneda === "USD" ? Math.round(p.usdAntes * 100) : p.copAntes, incluye: p.incluye };
    });
  }

  window.addEventListener("storage", function (e) { if (e.key === CLAVE) window.dispatchEvent(new CustomEvent("slumencarrito", { detail: leer() })); });

  window.SlumenCarrito = {
    leer: leer, agregar: agregar, quitar: quitar, vaciar: vaciar, cargar: cargar,
    idioma: idioma, precio: precio, lineas: lineas,
    get catalogo() { return catalogo; }
  };
})();
