# SLUMEN · Página web

Sitio de Slumen con carrito, pagos, cuentas de usuario y productos privados.

## Qué hace

- **Tienda:** los botones **Comprar** agregan al carrito, y el checkout cobra con **Wompi**. Mercado Pago, PayPal y Stripe están programados, pero apagados en `catalogo.json`.
- **Cuentas:** con el botón **Entrar** de la cabecera, la persona escribe su correo y recibe un enlace para entrar, sin contraseña. Si es nueva, la cuenta se crea sola. Al comprar, la cuenta también se crea sola.
- **Mi cuenta** (`cuenta.html`) tiene tres secciones: productos comprados, historial de compras y perfil.
- **Productos privados:** no están en este repositorio público. Se suben a la base de datos con `scripts/subir-productos.mjs` y solo se sirven por `/productos/<id>/` a quien los compró.
- **Base de datos PostgreSQL** con estas tablas: usuarios, pedidos, accesos, sesiones y enlaces de acceso. Ver `sql/esquema.sql`.

## Estructura

| Ruta | Qué es |
| --- | --- |
| `index.html` | Página principal |
| `checkout.html`, `gracias.html` | Pago y confirmación |
| `cuenta.html`, `entrar.html` | Mi cuenta e inicio de sesión |
| `politica-de-datos.html` | Borrador de la política de datos (Ley 1581) |
| `catalogo.json` | Precios en COP y USD, que son los que cobra el servidor |
| `api/` | Funciones de Vercel: pagos, webhooks, inicio de sesión, perfil y productos privados |
| `lib/` | Base de datos, sesiones, pasarelas, pedidos y correo |
| `vercel.json` | Rutas y bloqueos |
| `scripts/subir-productos.mjs` | Sube los productos pagados a la base de datos |
| `sql/esquema.sql` | Tablas de PostgreSQL |

## Publicar

Se publica en **Vercel** (www.slumen.app) automáticamente con cada cambio en `main`. Usa una base **PostgreSQL** (Neon desde Vercel Storage) y **Resend** para los correos.

El paso a paso y todas las variables de entorno están en **`LEEME.txt`**. Las mejoras sugeridas están en **`RECOMENDACIONES.md`**.
