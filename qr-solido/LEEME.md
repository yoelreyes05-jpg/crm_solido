# Códigos QR — Sólido Auto Servicio

Un QR principal que abre un menú con las tres opciones, más los tres códigos sueltos por si quieres usarlos por separado.

---

## Lo primero: sube la página del menú

El QR principal apunta a **`https://solidoautoservicio.online/enlaces`**, y esa página todavía no existe. Hasta que la subas, ese código lleva a un error 404.

Sube la carpeta **`enlaces/`** (con su `index.html` dentro) a la raíz de tu sitio, al lado del `index.html` que ya tienes. Debe quedar así:

```
tu-sitio/
├── index.html          ← el que ya tienes
├── logo.png            ← el que ya tienes
└── enlaces/
    └── index.html      ← el nuevo
```

Comprueba abriendo `https://solidoautoservicio.online/enlaces` en el navegador.

> Si tu hosting no abre carpetas automáticamente y ves un error, sube en su lugar el archivo suelto **`enlaces.html`** a la raíz. La dirección entonces es `solidoautoservicio.online/enlaces.html` y **hay que regenerar el QR principal** — está explicado más abajo.

La página usa `/logo.png`. Si tu logo está en otra ruta, cámbiala en el HTML (aparece dos veces).

---

## Qué hay en cada archivo

### `QR-Solido-imprimir.pdf` — para imprimir directo

| Página | Qué es | Dónde ponerla |
|---|---|---|
| 1 | Letrero con el QR principal de 12 cm | Recepción, sala de espera, vitrina |
| 2 | Los tres QR por separado, con línea de corte | Recorta y pega cada uno donde toque |
| 3 | Seis tarjetas recortables | Entregar con la factura, dejar en el mostrador |

Imprime en tamaño real (**100%**, no "ajustar a la página"): reducirlo achica el margen blanco del código y algunos lectores dejan de encontrarlo.

### `codigos-qr/` — las imágenes sueltas

| Archivo | A dónde lleva |
|---|---|
| `qr-principal-menu` | La página del menú con las tres opciones |
| `qr-app-cliente` | La app: estado del vehículo, citas, avisos |
| `qr-telegram` | El bot `@solidoautoservicios_bot` |
| `qr-sitio-web` | `solidoautoservicio.online` |

De cada uno hay tres versiones:

- **`.png`** — con el logo en el centro. Es el que se usa normalmente. 1800 px, listo para imprimir a 300 dpi.
- **`-simple.png`** — sin logo. Úsalo cuando el código vaya **más pequeño de 3 cm** (una tarjeta, un sticker chiquito): a ese tamaño el logo se come demasiado del código.
- **`.svg`** — vectorial. Este es el que le mandas a la imprenta o al rotulista: no se pixela por grande que lo hagan.

---

## Reglas para que se lean de verdad

Los cuatro códigos fueron verificados con un lector real, a siete tamaños distintos, y también rasterizando el PDF a 200 dpi como si ya estuviera impreso. Se leen. Lo que puede romperlos es el manejo posterior:

- **No recortes el borde blanco.** Ese marco alrededor del código no es margen de diseño: el lector lo necesita para encontrar dónde empieza el código. Es el error más común.
- **No inviertas los colores.** Oscuro sobre blanco, nunca claro sobre oscuro. Muchas cámaras de Android fallan con QR invertidos.
- **No lo estires.** Tiene que quedar cuadrado.
- **Tamaño mínimo 2.5 cm**, y de 3 cm hacia abajo usa la versión `-simple`.
- **Regla de distancia:** el código debe medir al menos **1 cm por cada 10 cm** de distancia desde donde lo van a escanear. Para un letrero que se lee desde 2 metros, mínimo 20 cm.
- Si lo pones sobre vidrio o vinilo brillante, cuida que no le dé un reflejo directo encima.

**Pruébalo tú antes de mandar a imprenta:** imprime una hoja, escanéala con tu propio teléfono y comprueba que abre lo que debe.

---

## Si cambia una dirección

Los scripts que generaron todo esto quedaron aquí, así que no hace falta empezar de cero.

1. Abre `generar-qr.py` y edita la lista `CODIGOS` con la URL nueva.
2. Corre:

```bash
pip install segno pillow opencv-python-headless reportlab
python3 generar-qr.py
python3 generar-hojas-pdf.py
```

El script **elige la máscara del código probándolo con un lector real** y avisa si algo no se lee. Eso no es un adorno: la primera versión del QR de Telegram no se leía a tamaño grande —sí a tamaño pequeño— y se habría ido a la imprenta sin que nadie lo notara. Si ves un `⚠️` en la salida, no imprimas.

---

## Un detalle que conviene saber

El QR principal apunta a **tu propia página**, no directo a la app. Eso significa que si mañana cambias la dirección de la app, **no tienes que reimprimir nada**: editas el enlace en `enlaces/index.html` y todos los códigos ya repartidos siguen funcionando.

Los tres QR individuales sí apuntan directo a su destino. Son más rápidos para el cliente, pero si esa dirección cambia, el papel impreso queda muerto. Por eso el letrero grande de recepción usa el principal.
