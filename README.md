# SLUMEN · Página web

Sitio de Slumen con carrito, pagos, cuentas de usuario y productos privados.

## Qué hace

- **Tienda:** los botones **Comprar** agregan al carrito, y el checkout cobra con **Wompi**, **Mercado Pago**, **PayPal** o **Stripe**.
- **Cuentas:** al pagar, la cuenta se crea sola. La persona entra con un enlace al correo, sin contraseña.
- **Mi cuenta** (`cuenta.html`) tiene tres secciones: productos comprados, historial de compras y perfil.
- **Productos privados:** viven en `privado/productos/` y solo se sirven por `/productos/<id>/` a quien los compró.
- **Base de datos PostgreSQL** con estas tablas: usuarios, pedidos, accesos, sesiones y enlaces de acceso. Ver `sql/esquema.sql`.

## Estructura

| Ruta | Qué es |
| --- | --- |
| `index.html` | Página principal |
| `checkout.html`, `gracias.html` | Pago y confirmación |
| `cuenta.html`, `entrar.html` | Mi cuenta e inicio de sesión |
| `politica-de-datos.html` | Borrador de la política de datos (Ley 1581) |
| `catalogo.json` | Precios en COP y USD, que son los que cobra el servidor |
| `netlify/functions/` | API: pagos, webhooks, inicio de sesión, perfil y productos privados |
| `netlify/lib/` | Base de datos, sesiones, pasarelas, pedidos y correo |
| `privado/productos/` | Productos pagados (bloqueados al público) |
| `sql/esquema.sql` | Tablas de PostgreSQL |

## Publicar

Se publica en **Netlify**, con una base **PostgreSQL** (Netlify DB, Neon o Supabase) y **Resend** para los correos. GitHub Pages no sirve, porque se necesitan las funciones de servidor.

El paso a paso y todas las variables de entorno están en **`LEEME.txt`**. Las mejoras sugeridas están en **`RECOMENDACIONES.md`**.
