# Módulo ASA — Flota y transportación

Control de los vehículos de la empresa: quién maneja cuál, el parte diario que
llena el conductor, las fallas que reporta, las fotos y todo lo que se gasta.
Con eso el encargado de transportación sabe **cuánto cuesta cada unidad por
kilómetro** y cuál conviene reemplazar.

Independiente del resto del CRM: prefijo `asa_` en todas las tablas y su propio
enlace. No toca la tabla `vehiculos`, que son los de los clientes del taller.

---

## Puesta en marcha

1. **Base de datos** — correr `crm-backend/sql/migracion_v32_asa_flota.sql` en el
   SQL editor de Supabase. Es idempotente: se puede correr varias veces. Crea las
   12 tablas, las 3 vistas, el bucket de fotos `asa-flota-fotos` y siembra el checklist
   (25 puntos) y el catálogo de fallas (43).
   > El prefijo es `asa_flota_` y no `asa_`: ese ya lo ocupa el ERP de ASA
   > (plagas/IPM, fichas clinicas, POS, nomina). Este modulo no toca ninguna
   > de esas tablas.
2. **Backend** — ya está montado en `server.mjs` (`app.use("/asa", asa)`).
   Desplegar Railway. Verificar con `GET /asa/salud`: devuelve el conteo de cada
   tabla y avisa si falta el bucket.
3. **Frontend** — desplegar Vercel. Aparece en el sidebar como **Flota ASA**.
4. **Cargar datos** — en `/asa/configuracion` agregar los conductores, y en
   `/asa/vehiculos` las unidades.
   > El campo **Km al entrar a la flota** es la línea base del costo por
   > kilómetro. Si la unidad ya venía usada, poner ahí el odómetro del día que
   > entró — no cero. Puesto mal, el costo por km sale en centavos y el reporte
   > no sirve.
5. **Repartir el enlace** — copiar el enlace del chequeo desde el tablero y
   mandarlo por WhatsApp a los conductores. Que lo guarden en la pantalla de
   inicio del celular.

---

## Las dos caras del módulo

### El conductor — `/asa/chequeo` (público, sin login)

Pantalla de celular. Abre el enlace, toca su nombre y llena el parte en siete
pasos: quién eres → cuál vehículo → turno y kilometraje → combustible →
revisión → fallas → fotos.

**No se escribe nada.** El único teclado de toda la pantalla es el numérico del
odómetro, y sale con el número del día anterior ya puesto para que solo cambie
lo que hizo falta.

- **Combustible**: se mueve con flechas ◀ ▶ en octavos — E, ⅛, ¼, ⅜, ½, ⅝, ¾,
  ⅞, F. El conductor reporta lo que ve en la aguja, no un porcentaje.
- **Checklist**: los 25 puntos arrancan en verde. Se toca solo lo que está mal.
  Un segundo toque lo pone en N/A, un tercero lo devuelve a BIEN.
- **Fallas**: se escogen de un catálogo escrito en su idioma — "hala hacia un
  lado", "bota humo negro", "el aire no enfría" — no en el del mecánico.
- **Fotos**: cinco ángulos, cámara directa. Se comprimen en el navegador a
  ~150KB antes de subir.
- **Borrador**: lo que va llenando se guarda en el celular. Si entra una llamada
  o se cae la señal, al volver está todo ahí.

Es ruta pública a propósito: darle cuenta del CRM a cada conductor sería
abrirle facturación y clientes para que reporte una goma baja. Lo público solo
puede leer catálogos y escribir su propio parte del día.

### El encargado — `/asa`

| Pantalla | Para qué |
|---|---|
| `/asa` | Tablero: quién no reportó, qué unidad no debe salir, qué papel vence, fallas abiertas, gasto del mes |
| `/asa/vehiculos` | Alta, edición y asignación de conductor |
| `/asa/vehiculos/[id]` | Ficha completa: costos, rendimiento, partes, fallas, gastos, fotos, documentos, mantenimiento |
| `/asa/fallas` | Gestión de fallas y las que más se repiten en toda la flota |
| `/asa/gastos` | Registro de gastos por tipo |
| `/asa/reportes` | Costo por km por unidad y cumplimiento por conductor, con exportación a CSV |
| `/asa/configuracion` | Conductores, checklist, catálogo de fallas y ajustes |

---

## Decisiones que vale la pena conocer

**El kilometraje no retrocede.** Si el número llega menor que el último, casi
siempre es un dígito de menos al teclear. No se rechaza el parte —dejar a un
conductor trancado a las 7am es peor que un dato marcado— pero tampoco se le
baja el kilometraje al vehículo: queda marcado como sospechoso para que lo
revises.

**Una falla se abre una sola vez.** Si el conductor reporta "goma baja" cinco
días seguidos, es *una* falla con cinco reportes, no cinco fallas. Ese contador
es la señal: algo reportado cinco veces y todavía abierto es un problema de
gestión, no del vehículo.

**El checklist guarda solo lo que está mal.** 25 puntos por vehículo por día
serían 9,000 filas al año por unidad para decir casi siempre lo mismo. Lo que no
está en la tabla, estaba bien. El parte completo queda igual en un JSON por si
mañana cambias el catálogo.

**El rendimiento se calcula tanqueo a tanqueo**, no dividiendo el total: los
tanqueos parciales ensucian el promedio y dan cifras que nadie se cree. Por eso
el gasto de combustible tiene la casilla "tanque lleno".

**Un parte por vehículo, día y turno.** Guardar dos veces reemplaza, no
duplica. El conductor que toca "Guardar" otra vez porque no vio la señal no
termina con dos partes ni con un error rojo.

**Las fotos van a Supabase Storage**, no a la tabla como base64 (que es lo que
hace hoy la cafetería). Cinco fotos por unidad por día en base64 revientan la
base en meses.

---

## Permisos

Módulo `asa` en `/permisos`, con las cinco acciones de siempre.
Por defecto: **gerente** todo; **secretaria** y **almacén** operación (ven,
registran gastos, cierran fallas, pero no dan de baja unidades); el resto, nada.

`/asa/chequeo` no pasa por permisos: es pública.

---

## Qué más te conviene, ahora que llevas transportación

Lo de abajo **no está construido**. Es lo que la práctica de gestión de flota
señala como siguiente paso, ordenado por lo que rinde más con lo que ya tienes.

### Lo que ya te da el módulo y conviene mirar semanal

1. **Costo por kilómetro por unidad.** Es el único número que compara de verdad
   una camioneta vieja con una nueva; el total gastado siempre castiga a la que
   más rueda. En `/asa/reportes` sale en rojo la que pasa 30% del promedio.
2. **Rendimiento (km/galón) por unidad.** Una caída brusca casi nunca es el
   motor: es goma baja, filtro de aire sucio, o combustible que no llegó al
   tanque. Es la alarma de robo más barata que existe.
3. **Fallas que se repiten en varias unidades.** Si el mismo código sale en tres
   camionetas, mira el suplidor o la ruta antes que el vehículo.
4. **Cumplimiento de fotos por conductor.** Un conductor con cero fallas
   reportadas en todo un mes no siempre es buena noticia: puede que esté llenando
   el parte de corrido sin mirar el vehículo.

### Lo que falta y pega duro

- **Alerta automática del marbete.** En RD se renueva todos los años y vence el
  **31 de enero sin prórroga**. El módulo ya lo muestra en el tablero, pero
  todavía no te *avisa*. Un cron diario que mande WhatsApp o correo 45, 30 y 7
  días antes usa la infraestructura de notificaciones que ya tiene el CRM
  (`services/notificarCliente.mjs`, Brevo, `webPush.mjs`).
- **Aviso al encargado cuando una unidad sale "no apta".** Hoy hay que entrar al
  tablero para verlo. Debería llegarte un WhatsApp en el momento en que el
  conductor guarda un parte con algo crítico. Es la diferencia entre enterarte a
  las 7:05 y a las 11.
- **Vencimiento de licencia del conductor.** El campo ya existe en
  `asa_flota_conductores`; falta que entre a la vista de alertas junto con los documentos
  del vehículo.
- **Enlazar una falla con una orden del taller.** Sólido es el taller: cuando una
  falla pasa a `EN_TALLER` debería poder crear la orden de trabajo y traer de
  vuelta el costo real cuando se factura, en vez de teclearlo a mano al cerrarla.
- **Presupuesto mensual por unidad**, con aviso al pasarse. Sin techo, el gasto
  solo se descubre cuando ya se gastó.

### Lo que va bien después

- **Bitácora de viajes** (origen, destino, motivo) para saber costo por ruta o
  por departamento, no solo por vehículo. Se puede hacer sin escritura: catálogo
  de destinos frecuentes y toque.
- **GPS / telemetría.** Es el salto grande: quita el kilometraje manual, detecta
  exceso de velocidad, frenadas bruscas y ralentí. Antes de comprarlo, mide seis
  meses con lo que ya tienes — así sabrás qué te está costando de verdad y
  podrás justificar el equipo con números tuyos.
- **QR pegado en cada vehículo** que abra el chequeo con la unidad ya escogida.
  Quita un paso y elimina el error de reportar en el vehículo equivocado.
- **Depreciación y punto de reemplazo.** Con `costo_adquisicion` y el costo
  acumulado ya guardados, sale calcular cuándo una unidad deja de convenir.
- **Comparar el gasto de combustible contra el rendimiento esperado** para
  detectar cargas que no cuadran con los kilómetros recorridos.

---

## API

Todo bajo `/asa`. Público (pantalla del conductor):

```
GET  /asa/publico/arranque                  catálogos + conductores + vehículos, en una llamada
GET  /asa/publico/vehiculo/:id/estado       km y combustible con que quedó, y fallas abiertas
POST /asa/publico/chequeo                   el parte del día (upsert por vehículo/fecha/turno)
POST /asa/publico/foto                      foto suelta
```

Encargado:

```
GET    /asa/dashboard?fecha=
GET    /asa/vehiculos            POST /asa/vehiculos      PATCH|DELETE /asa/vehiculos/:id
GET    /asa/vehiculos/:id/ficha
POST   /asa/asignaciones
GET    /asa/chequeos             GET /asa/chequeos/:id
GET    /asa/fallas               PATCH /asa/fallas/:id
GET    /asa/gastos               POST|PATCH|DELETE
GET    /asa/documentos           POST|PATCH|DELETE
GET    /asa/mantenimientos       POST|PATCH|DELETE
GET    /asa/conductores            POST|PATCH|DELETE
GET    /asa/checklist            POST|PATCH|DELETE
GET    /asa/catalogo-fallas      POST|PATCH|DELETE
GET    /asa/fotos                DELETE /asa/fotos/:id
GET    /asa/reportes/costos?desde=&hasta=
GET    /asa/reportes/conductores?desde=&hasta=
GET|PUT /asa/config
GET    /asa/salud
```

## Tablas

`asa_flota_conductores` · `asa_flota_vehiculos` · `asa_flota_asignaciones` · `asa_flota_checklist_items` ·
`asa_flota_fallas_catalogo` · `asa_flota_chequeos` · `asa_flota_chequeo_items` ·
`asa_flota_fallas_reportadas` · `asa_flota_fotos` · `asa_flota_gastos` · `asa_flota_documentos` ·
`asa_flota_mantenimientos`

Vistas: `asa_flota_v_resumen_vehiculo` · `asa_flota_v_documentos_alerta` ·
`asa_flota_v_fallas_frecuentes`

Configuración: `config_sistema` clave `asa_config`.
Storage: bucket `asa-flota-fotos` (lectura pública, escritura solo desde el backend).
