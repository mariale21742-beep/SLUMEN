# Recomendaciones: flujo de compra e información de usuarios

Ordenadas por impacto. ✅ = ya está hecho en esta versión.

## Ya incluido

- ✅ **Compra sin registro previo.** La cuenta se crea sola al pagar: menos pasos, menos abandono.
- ✅ **Entrar sin contraseña** con un enlace al correo (nada que olvidar ni que se filtre).
- ✅ **El Pack reemplaza los productos sueltos** del carrito y avisa si algo ya viene incluido.
- ✅ **El precio lo calcula el servidor** y se verifica contra lo cobrado antes de entregar.
- ✅ **Historial de compras y productos en un solo lugar** (Mi cuenta), con un botón «← Mi cuenta» dentro de cada producto.
- ✅ **Autorización de datos guardada** con fecha (Ley 1581) y novedades solo con permiso.

## Flujo de compra

1. **Revisar el precio del Pack (urgente).** Hoy los cinco productos sueltos suman **$227.500**, y el Pack cuesta **$249.900**. Comprar el Pack sale más caro. Sugerencia: dejar el Pack por debajo de $199.900 y mostrar «Ahorras $X» en el carrito.
2. **Sugerir el Pack en el carrito.** Cuando alguien lleve 3 o más productos, mostrar «Por $X más tienes los cinco».
3. **Cupones de descuento**, por ejemplo para quienes asistan a HABITARME o para el lanzamiento. Es una tabla `cupones` y un campo en el checkout.
4. **Factura electrónica (DIAN).** Si vendes como negocio en Colombia, cada venta necesita factura electrónica. Se puede conectar Alegra o Siigo para que salga sola al confirmarse el pago.
5. **Recordatorio de carrito abandonado.** Si un pedido queda «sin pagar» 24 horas y la persona aceptó novedades, enviarle un correo amable con el enlace para retomarlo.
6. **Mostrar primero la pasarela según el país** y no solo según el idioma: Wompi en Colombia, PayPal fuera.
7. **Confianza junto al botón de pago:** dos o tres testimonios cortos, el WhatsApp de ayuda y una política clara de devoluciones.
8. **Medir el embudo** (agregar al carrito, iniciar pago, compra) con Plausible o GA4, para saber dónde se pierden las personas.

## Información de usuarios

1. **Guardar el resultado del test en el perfil.** Al crear la cuenta, el eje que salió en el test queda guardado. Así Mi cuenta puede recomendar el siguiente producto, y los correos pueden hablarle a lo que esa persona vive.
2. **Guardar el progreso en la nube.** Hoy el Diario, el Método y Mi práctica guardan lo que la persona escribe solo en su celular o computador (localStorage). Si cambia de equipo, lo pierde. Se puede guardar en la base de datos, ligado a la cuenta. Ese contenido es muy íntimo: conviene cifrarlo y pedir una autorización explícita.
3. **Acompañamiento por correo.** Para el Diario de 31 días, un correo corto cada mañana con la palabra del día, solo si la persona lo activa.
4. **Descargar y eliminar mis datos** desde Mi cuenta, porque la Ley 1581 lo exige como derecho. Son dos botones y dos funciones.
5. **Panel para Aleja.** Ventas del día, clientas, quién compró qué, y dar o quitar accesos sin usar SQL. Puede ser una página `/admin` protegida por correo de administradora.
6. **Conectar las novedades con Brevo o Mailchimp**, sincronizando solo a quienes aceptaron, para hacer campañas bonitas y medir aperturas.
7. **Entrar con Google** como opción adicional al enlace por correo.

## Antes de publicar

- Completar y revisar con un abogado `politica-de-datos.html`.
- Probar una compra completa con las llaves de prueba de cada pasarela.
- Verificar el dominio en Resend para que los correos no lleguen a spam.
