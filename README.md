# Virginia · Panel de gestión

Aplicación web para gestionar las operaciones comerciales de **Tecnología y Plásticos Virginia E.I.R.L.**, empresa peruana de intermediación de productos plásticos industriales. Funciona en computadora y celular, y se puede instalar en la pantalla de inicio como una app.

🔗 **App:** https://danielariscob.github.io/virginia-app/ *(acceso solo para usuarios autorizados)*

## Funcionalidades

- **Inicio:** resumen del día con cobranzas vencidas, cotizaciones sin respuesta, flujo del mes, mejores clientes y productos más vendidos.
- **Cotizaciones:** creación con cálculo automático de IGV y margen, alerta de margen bajo y envío directo por WhatsApp.
- **Pedidos y envíos:** seguimiento de la compra al proveedor y del despacho al cliente, con agencia y número de guía.
- **Facturación y cobranzas:** registro de comprobantes emitidos en SUNAT, pagos parciales, saldos y vencimientos.
- **Finanzas:** gastos por categoría y comparación mensual de cobrado vs. gastado.
- **Catálogo:** productos con costo, precio, margen y proveedor.
- **Contactos:** clientes y proveedores con personas de contacto, validación de RUC y **autocompletado de datos desde SUNAT/RENIEC**.

## Tecnologías

| Capa | Herramienta |
|---|---|
| Frontend | HTML, CSS y JavaScript (sin frameworks) |
| Base de datos y login | [Supabase](https://supabase.com) (PostgreSQL + Auth) |
| Seguridad | Row Level Security: solo usuarios autorizados ven los datos |
| Consulta RUC/DNI | Supabase Edge Function + API de [Factiliza](https://factiliza.com) |
| Hosting | GitHub Pages |

## Estructura

```
index.html                         Estructura de la app
css/styles.css                     Estilos
js/config.js                       URL y llave pública de Supabase
js/app.js                          Lógica y conexión con Supabase
img/                               Íconos
supabase/01_esquema.sql            Tablas, vistas y reglas de seguridad
supabase/functions/consulta-ruc/   Edge Function para consultar RUC/DNI
```

## Instalación

1. Crear un proyecto en Supabase y ejecutar `supabase/01_esquema.sql` en el SQL Editor.
2. Crear los usuarios en **Authentication → Users** y registrarlos en la tabla `perfiles`.
3. Colocar la URL del proyecto y la *anon/publishable key* en `js/config.js`.
4. Para la consulta RUC/DNI: crear el secreto `FACTILIZA_TOKEN` en **Edge Functions → Secrets** y desplegar la función `consulta-ruc`.
5. Para probar localmente, abrir `index.html` con Live Server en VS Code.

## Seguridad

- La llave de `config.js` es pública por diseño. El acceso a los datos lo controlan las políticas RLS de la base de datos.
- El token de Factiliza se guarda solo en los secretos de Supabase, nunca en el código.
- El registro público de usuarios está desactivado.

## Comprobantes electrónicos

Las facturas y boletas se emiten en el portal **SEE-SOL de SUNAT**. La app registra la serie y el número asignados por SUNAT para hacer el seguimiento de cobranzas.

---

Desarrollado por [Daniela Risco](https://www.linkedin.com/in/daniela-risco) 
