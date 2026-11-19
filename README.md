# SLUMEN · Página web

Sitio de Slumen: inicio, test, Aleja y los tres ejes (Mente, Cuerpo, Espíritu), con carrito y checkout.

- `index.html`: la página principal. Los botones **Comprar** agregan al carrito.
- `checkout.html` y `gracias.html`: pago y confirmación.
- `catalogo.json`: precios en COP y USD (los que cobra el servidor).
- `netlify/`: funciones de servidor para **Wompi**, **Mercado Pago**, **PayPal** y **Stripe**, con correo automático de acceso (Resend).
- `img/`, `css/`, `js/`: imágenes, estilos y el carrito.
- `LEEME.txt`: guía completa para publicar en Netlify y configurar cada pasarela.

Se publica en **Netlify** (los pagos necesitan las funciones de servidor; GitHub Pages no sirve para eso).
