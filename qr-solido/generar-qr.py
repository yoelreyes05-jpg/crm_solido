# -*- coding: utf-8 -*-
"""
Genera los códigos QR de Sólido Auto Servicio.

Decisiones que importan para que funcionen en la vida real:

· Corrección de error ALTA (H, ~30%). Un QR impreso en el taller se raya, se
  ensucia de grasa y se despega por una esquina. Con corrección alta sigue
  leyéndose con casi un tercio del código dañado — y es lo que permite poner
  el logo en el centro sin romperlo.

· MÁSCARA ELEGIDA A PROPÓSITO, no la automática. Esto no es un detalle
  cosmético: el QR de Telegram generado con la máscara por defecto NO se leía
  a tamaño grande (sí a 300 px o menos). La máscara cambia el dibujo sin
  cambiar el dato, y algunos patrones confunden a ciertos lectores. Aquí se
  prueban las 8 del estándar contra un decodificador real y se elige la que
  se lee a todos los tamaños. Sin este paso, el letrero grande de Telegram
  habría salido de la imprenta sin que nadie lo notara.

· Color oscuro sobre blanco, nunca al revés. Muchos lectores baratos y algunas
  cámaras de Android fallan con QR invertidos.

· Margen (quiet zone) de 4 módulos. Sin ese borde blanco alrededor, el lector
  no encuentra dónde empieza el código. Es el error más común al recortar.

· SVG además de PNG: para rotular un vinilo grande o mandar a imprenta, el
  vector no pixela a ningún tamaño.
"""
import segno, io, os
import cv2, numpy as np
from PIL import Image, ImageDraw

LOGO = "/sessions/awesome-funny-meitner/mnt/crm-automotriz/frontend/public/logo.png"
SALIDA = "/sessions/awesome-funny-meitner/mnt/crm-automotriz/qr-solido/codigos-qr"
os.makedirs(SALIDA, exist_ok=True)

OSCURO = "#0f172a"   # azul noche de la marca; más suave que el negro puro

CODIGOS = [
    ("qr-principal-menu", "https://solidoautoservicio.online/enlaces"),
    ("qr-app-cliente",    "https://crm-solido.vercel.app/cliente"),
    ("qr-telegram",       "https://t.me/solidoautoservicios_bot"),
    ("qr-sitio-web",      "https://solidoautoservicio.online"),
]

# Tamaños de prueba, de un letrero grande a un sticker pequeño.
TAMANOS_PRUEBA = [1800, 1200, 900, 600, 400, 300, 200]
_det = cv2.QRCodeDetector()


def png_bytes(qr, scale=40):
    buf = io.BytesIO()
    qr.save(buf, kind="png", scale=scale, border=4, dark=OSCURO, light="white")
    return buf.getvalue()


def _decodifica(im, url):
    texto, _, _ = _det.detectAndDecode(cv2.cvtColor(np.array(im), cv2.COLOR_RGB2BGR))
    return texto == url


def lee_bien(datos_png, url):
    """¿Este PNG se decodifica a la URL correcta a todos los tamaños?

    Se incluye el tamaño ORIGINAL sin redimensionar, no solo la lista de
    pruebas: la primera versión de esto solo probaba tamaños redimensionados
    y dejó pasar un código que fallaba justo a su resolución nativa.
    """
    im0 = Image.open(io.BytesIO(datos_png)).convert("RGB")
    if not _decodifica(im0, url):
        return False
    for t in TAMANOS_PRUEBA:
        if not _decodifica(im0.resize((t, t), Image.LANCZOS), url):
            return False
    return True


def mejor_mascara(url):
    """Devuelve el QR con la primera máscara que se lee a todos los tamaños."""
    for mask in range(8):
        qr = segno.make(url, error="h", mask=mask)
        if lee_bien(png_bytes(qr, scale=40), url):
            return qr, mask
    # Ninguna perfecta: se usa la automática y el verificador lo dirá.
    return segno.make(url, error="h"), None


def con_logo(datos_png, lado_logo_pct=0.20):
    """Pega el logo en el centro sobre un recuadro blanco redondeado.

    El recuadro blanco no es decoración: separa el logo de los módulos del QR
    para que el lector no intente interpretarlos como parte del código.
    """
    qr = Image.open(io.BytesIO(datos_png)).convert("RGBA")
    W, H = qr.size

    lado = int(W * lado_logo_pct)
    pad = int(lado * 0.16)
    caja = lado + pad * 2

    fondo = Image.new("RGBA", (caja, caja), (0, 0, 0, 0))
    ImageDraw.Draw(fondo).rounded_rectangle(
        [0, 0, caja - 1, caja - 1], radius=int(caja * 0.22), fill=(255, 255, 255, 255))

    logo = Image.open(LOGO).convert("RGBA").resize((lado, lado), Image.LANCZOS)
    mascara = Image.new("L", (lado, lado), 0)
    ImageDraw.Draw(mascara).rounded_rectangle(
        [0, 0, lado - 1, lado - 1], radius=int(lado * 0.18), fill=255)
    fondo.paste(logo, (pad, pad), mascara)

    qr.paste(fondo, ((W - caja) // 2, (H - caja) // 2), fondo)
    return qr


print(f"{'archivo':<22} {'ver':<4} {'máscara':<9} destino")
print("-" * 76)

for nombre, url in CODIGOS:
    qr, mask = mejor_mascara(url)
    datos = png_bytes(qr, scale=40)

    # PNG con logo (el que se usa normalmente)
    img_logo = con_logo(datos).convert("RGB")
    img_logo.save(f"{SALIDA}/{nombre}.png", "PNG", dpi=(300, 300))

    # El logo tapa módulos reales: la corrección de error los reconstruye, pero
    # hay que comprobarlo, no darlo por hecho.
    buf_logo = io.BytesIO(); img_logo.save(buf_logo, "PNG")
    if not lee_bien(buf_logo.getvalue(), url):
        print(f"  ⚠️  {nombre}: el logo estorba la lectura, se reduce su tamaño")
        img_logo = con_logo(datos, lado_logo_pct=0.15).convert("RGB")
        img_logo.save(f"{SALIDA}/{nombre}.png", "PNG", dpi=(300, 300))

    # PNG limpio: respaldo para lectores viejos y para tamaños muy pequeños,
    # como una tarjeta de presentación.
    Image.open(io.BytesIO(datos)).convert("RGB").save(
        f"{SALIDA}/{nombre}-simple.png", "PNG", dpi=(300, 300))

    # SVG vectorial para imprenta y rotulación
    qr.save(f"{SALIDA}/{nombre}.svg", scale=10, border=4, dark=OSCURO, light="white")

    etiqueta = str(mask) if mask is not None else "auto ⚠️"
    print(f"{nombre:<22} v{qr.version:<3} {etiqueta:<9} {url}")

print("\nArchivos en:", SALIDA)
