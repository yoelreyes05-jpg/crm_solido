# -*- coding: utf-8 -*-
"""
Hojas imprimibles con los QR de Sólido Auto Servicio.

Tres páginas, cada una para un sitio distinto del taller:

  1. Letrero grande del QR principal — recepción y sala de espera.
     Un solo código de 12 cm, legible a varios metros y sin que el cliente
     tenga que decidir nada antes de escanear.

  2. Los tres QR por separado — para pegar donde cada uno tenga sentido
     (el de la app junto a la caja, el de Telegram en la puerta, etc.).

  3. Tarjetas recortables — para entregar con la factura. Seis por hoja,
     con líneas de corte.

La maquetación usa un cursor vertical que baja elemento por elemento en vez
de posiciones absolutas. La primera versión iba con coordenadas fijas y en
las tarjetas el QR terminó encima del texto: con 7,5 cm de alto no sobra ni
un milímetro para calcularlo a ojo.
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

QR = "/sessions/awesome-funny-meitner/mnt/crm-automotriz/qr-solido/codigos-qr"
LOGO = "/sessions/awesome-funny-meitner/mnt/crm-automotriz/frontend/public/logo.png"
DESTINO = "/sessions/awesome-funny-meitner/mnt/crm-automotriz/qr-solido/QR-Solido-imprimir.pdf"

W, H = letter
OSCURO = (0.059, 0.090, 0.165)   # #0f172a
GRIS   = (0.42, 0.47, 0.55)
ORO    = (0.851, 0.643, 0.255)   # #d9a441
LINEA  = (0.82, 0.85, 0.89)

c = canvas.Canvas(DESTINO, pagesize=letter)
c.setTitle("Códigos QR — Sólido Auto Servicio")
c.setAuthor("Sólido Auto Servicio")


def texto(t, x, y, fuente="Helvetica", tam=10, color=OSCURO, centro=False):
    c.setFont(fuente, tam)
    c.setFillColorRGB(*color)
    (c.drawCentredString if centro else c.drawString)(x, y, t)


def qr(nombre, x, y, lado, simple=False):
    """Coloca un QR. `simple` usa la versión sin logo, para tamaños pequeños."""
    c.drawImage(ImageReader(f"{QR}/{nombre}{'-simple' if simple else ''}.png"),
                x, y, lado, lado, preserveAspectRatio=True, mask="auto")


def logo(x, y, lado):
    c.drawImage(ImageReader(LOGO), x, y, lado, lado,
                preserveAspectRatio=True, mask="auto")


# ══════════════════════════════════════════════════════════════════════════
# Página 1 — Letrero del QR principal
# ══════════════════════════════════════════════════════════════════════════
y = H - 2.0 * cm

LADO_LOGO = 3.2 * cm
logo(W / 2 - LADO_LOGO / 2, y - LADO_LOGO, LADO_LOGO)
y -= LADO_LOGO + 0.9 * cm

texto("SÓLIDO AUTO SERVICIO", W / 2, y, "Helvetica-Bold", 20, OSCURO, centro=True)
y -= 0.8 * cm
texto("Más que un taller, una experiencia", W / 2, y,
      "Helvetica-Oblique", 11, GRIS, centro=True)
y -= 1.8 * cm

texto("Escanea y elige", W / 2, y, "Helvetica-Bold", 27, ORO, centro=True)
y -= 1.1 * cm

LADO = 12 * cm
qr("qr-principal-menu", W / 2 - LADO / 2, y - LADO, LADO)
y -= LADO + 1.1 * cm

texto("Estado de tu vehículo   ·   Agendar cita   ·   Telegram", W / 2, y,
      "Helvetica-Bold", 12.5, OSCURO, centro=True)
y -= 0.8 * cm
texto("Apunta la cámara de tu teléfono al código. No necesitas instalar nada.",
      W / 2, y, "Helvetica", 10, GRIS, centro=True)
y -= 1.1 * cm

c.setStrokeColorRGB(*ORO)
c.setLineWidth(1.4)
c.line(5 * cm, y, W - 5 * cm, y)
y -= 0.9 * cm

texto("849-569-2027   ·   solidoautoservicio.online", W / 2, y,
      "Helvetica-Bold", 11.5, OSCURO, centro=True)
y -= 0.7 * cm
texto("Lun a Vie 8:00 AM – 6:00 PM   ·   Sábados 8:00 AM – 4:00 PM", W / 2, y,
      "Helvetica", 9.5, GRIS, centro=True)
c.showPage()


# ══════════════════════════════════════════════════════════════════════════
# Página 2 — Los tres por separado
# ══════════════════════════════════════════════════════════════════════════
y = H - 2.2 * cm
texto("SÓLIDO AUTO SERVICIO", W / 2, y, "Helvetica-Bold", 17, OSCURO, centro=True)
y -= 0.75 * cm
texto("Códigos individuales — recorta y pega donde corresponda", W / 2, y,
      "Helvetica", 10, GRIS, centro=True)
y -= 1.3 * cm

BLOQUES = [
    ("qr-app-cliente", "Estado de tu vehículo",
     ["Mira cómo va tu reparación, agenda", "tu cita y activa los avisos"],
     "crm-solido.vercel.app/cliente"),
    ("qr-telegram", "Chatea con nosotros",
     ["Consulta por placa y agenda", "tu cita desde Telegram"],
     "t.me/solidoautoservicios_bot"),
    ("qr-sitio-web", "Nuestro sitio web",
     ["Servicios, información", "y agendar cita"],
     "solidoautoservicio.online"),
]

LADO2 = 6.0 * cm
for i, (nombre, titulo, detalle, url) in enumerate(BLOQUES):
    tope = y
    qr(nombre, 2.4 * cm, tope - LADO2, LADO2)

    # El texto se centra verticalmente respecto al QR, no se ancla arriba:
    # así no queda un hueco entre la descripción y la URL.
    tx = 2.4 * cm + LADO2 + 1.1 * cm
    alto_texto = 0.95 * cm + len(detalle) * 0.52 * cm + 0.85 * cm
    ty = tope - (LADO2 - alto_texto) / 2

    texto(titulo, tx, ty - 0.5 * cm, "Helvetica-Bold", 15)
    ty -= 1.25 * cm
    for linea in detalle:
        texto(linea, tx, ty, "Helvetica", 10.5, GRIS)
        ty -= 0.52 * cm
    ty -= 0.35 * cm
    texto(url, tx, ty, "Helvetica-Bold", 9.5, ORO)

    y = tope - LADO2 - 0.85 * cm
    if i < len(BLOQUES) - 1:
        c.setStrokeColorRGB(*LINEA)
        c.setLineWidth(0.6)
        c.setDash(3, 3)
        c.line(2 * cm, y, W - 2 * cm, y)
        c.setDash()
        y -= 0.85 * cm

texto("849-569-2027   ·   Lun a Vie 8:00 AM – 6:00 PM   ·   Sáb 8:00 AM – 4:00 PM",
      W / 2, 1.6 * cm, "Helvetica", 9.5, GRIS, centro=True)
c.showPage()


# ══════════════════════════════════════════════════════════════════════════
# Página 3 — Tarjetas recortables (6 por hoja)
# ══════════════════════════════════════════════════════════════════════════
texto("Tarjetas para entregar con la factura", W / 2, H - 1.6 * cm,
      "Helvetica-Bold", 12, GRIS, centro=True)

COLS, FILAS = 2, 3
MARGEN_X = 1.8 * cm
TOPE = H - 2.6 * cm
FONDO = 1.6 * cm
ANCHO_T = (W - 2 * MARGEN_X) / COLS
ALTO_T = (TOPE - FONDO) / FILAS

for f in range(FILAS):
    for col in range(COLS):
        x = MARGEN_X + col * ANCHO_T
        yb = FONDO + f * ALTO_T

        c.setStrokeColorRGB(*LINEA)
        c.setLineWidth(0.6)
        c.setDash(3, 3)
        c.rect(x, yb, ANCHO_T, ALTO_T)
        c.setDash()

        cx = x + ANCHO_T / 2
        cursor = yb + ALTO_T - 0.55 * cm   # baja desde el borde superior

        LADO_L = 1.15 * cm
        logo(cx - LADO_L / 2, cursor - LADO_L, LADO_L)
        cursor -= LADO_L + 0.45 * cm

        texto("SÓLIDO AUTO SERVICIO", cx, cursor, "Helvetica-Bold", 9.5, OSCURO, centro=True)
        cursor -= 0.45 * cm
        texto("Escanea para ver tu vehículo", cx, cursor, "Helvetica", 7.5, GRIS, centro=True)
        cursor -= 0.35 * cm

        # Sin logo encima: a 3 cm, el logo se come demasiados módulos.
        LADO3 = 3.0 * cm
        qr("qr-principal-menu", cx - LADO3 / 2, cursor - LADO3, LADO3, simple=True)
        cursor -= LADO3 + 0.5 * cm

        texto("849-569-2027", cx, cursor, "Helvetica-Bold", 8.5, ORO, centro=True)
        cursor -= 0.4 * cm
        texto("solidoautoservicio.online", cx, cursor, "Helvetica", 7.5, GRIS, centro=True)

c.save()
print("PDF creado:", DESTINO)
