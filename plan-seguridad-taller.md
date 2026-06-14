# Plan de Seguridad Inteligente — Taller Automotriz
**Sistema:** Home Assistant + Frigate + TTS Disuasivo  
**Corre en:** Mini PC Intel N100 (el mismo del CRM Sólido y Anunciador)  
**Costo estimado de hardware:** US$350–600 según escala

---

## 1. Arquitectura general

```
                        INTERNET
                            │
                    ┌───────┴────────┐
                    │   Tu celular   │  ← App HA / Telegram
                    └───────┬────────┘
                            │
                     ════════════════
                        Router Taller
                     ════════════════
                            │
              ┌─────────────┼──────────────┐
              │             │              │
         Switch PoE      Mini PC       WiFi (IoT)
              │          [N100]             │
    ┌─────────┼──────┐  HA + Frigate    Bocina WiFi
    │         │      │  + CRM Sólido    Bombillos
  Cám 1    Cám 2   Cám 3  + Anunciador  Sirena WiFi
 (entrada) (bahías) (caja)
              │
         Dongle USB
          Zigbee
              │
    ┌─────────┼──────────────────┐
    │         │         │        │
 Sensor    Sensor   Sensor   Sensor
 Puerta   Ventana  Ventana   MOV
Principal  Der.     Izq.    Interior
```

---

## 2. Hardware necesario

### 2.1 Núcleo (ya tienes o compras una vez)

| Componente | Modelo sugerido | Precio aprox. | Notas |
|---|---|---|---|
| Mini PC | Intel N100 (ya planificado) | US$150 | Corre HA + Frigate + CRM + Anunciador |
| Acelerador IA | Google Coral USB Edge TPU | US$60 | Opcional pero recomendado para 3+ cámaras |
| Dongle Zigbee | Sonoff Zigbee 3.0 USB Plus | US$25 | Hub de todos los sensores |
| Switch PoE | TP-Link TL-SG1005P (5 puertos) | US$40 | Alimenta cámaras sin enchufes individuales |
| UPS | APC BE600M1 600VA | US$70 | Sistema sigue operando si cortan la luz |

### 2.2 Cámaras

| Posición | Modelo | Precio | Resolución |
|---|---|---|---|
| Entrada principal | Reolink RLC-810A | US$55 | 4K, visión nocturna, PoE |
| Área de bahías | Reolink RLC-810A | US$55 | 4K, campo amplio |
| Caja / recepción | Reolink E1 Outdoor | US$45 | 5MP, PoE |
| Exterior / perímetro | Reolink RLC-823A | US$65 | Con foco LED integrado |

> **Por qué Reolink:** RTSP nativo sin suscripción, compatibles con Frigate, buena calidad nocturna. Las Hikvision son mejores pero más caras.

### 2.3 Sensores y actuadores

| Dispositivo | Modelo | Precio | Función |
|---|---|---|---|
| Sensor puerta/ventana (×4) | Aqara Door & Window Sensor | US$15 c/u | Detecta apertura instantánea |
| Sensor movimiento interior (×2) | Aqara Motion Sensor P1 | US$20 c/u | Zona de bahías y pasillo |
| Sirena inteligente | Heiman HS2WD-E (Zigbee) | US$35 | 95dB, Zigbee, sin suscripción |
| Bombillo inteligente (×4) | Sengled Zigbee A19 | US$12 c/u | Sin hub adicional, directo al dongle |
| Bocina para TTS | Parlante con AUX o Bluetooth | US$20–40 | Conectado al mini PC por cable 3.5mm |

**Total estimado: US$420–580**

---

## 3. Mapa de sensores en el taller

```
                 ┌─────────────────────────────────────────┐
                 │              CALLE / EXTERIOR            │
                 └──────────┬──────────────────────────────┘
                            │
                    ┌───────┴──────────┐
                    │  PUERTA PRINCIPAL │ ← Sensor apertura #1
                    │   📷 Cámara 1    │ ← Entrada/salida personas
                    │  (visión calle)  │
                    └────────┬─────────┘
                             │
          ┌──────────────────┼──────────────────────────┐
          │                RECEPCIÓN / CAJA              │
          │   [Escritorio secretaria]  [Mostrador]       │
          │        📷 Cámara 3                           │
          │   🔔 Sirena        💡 Bombillo               │
          │   🔊 Bocina TTS                              │
          │                  │                           │
          │           Ventana izq.  Ventana der.         │
          │           [Sensor #2]   [Sensor #3]          │
          └──────────────────┬──────────────────────────┘
                             │
          ┌──────────────────┼──────────────────────────┐
          │              ÁREA DE BAHÍAS                  │
          │                                              │
          │   [Bahía 1]    [Bahía 2]    [Bahía 3]       │
          │                                              │
          │      📷 Cámara 2 (campo amplio)              │
          │      👁 Sensor movimiento #1                 │
          │      👁 Sensor movimiento #2                 │
          │      💡 Bombillos de área (×2)               │
          │                                              │
          │         Puerta trasera/patio                 │
          │         [Sensor apertura #4]                 │
          │         📷 Cámara 4 (exterior)               │
          └──────────────────────────────────────────────┘
```

---

## 4. Software: stack completo

```
Mini PC (Ubuntu Server 22.04)
├── Docker
│   ├── Home Assistant OS (contenedor principal)
│   │   ├── Zigbee2MQTT       ← traduce Zigbee a MQTT
│   │   ├── Mosquitto MQTT    ← broker de mensajes interno
│   │   ├── Frigate NVR       ← IA de detección de personas
│   │   └── Node-RED (opcional) ← automatizaciones visuales
│   └── workshop-announcer    ← tu módulo de anuncios del CRM
├── Piper TTS                 ← voz para mensajes disuasivos
└── CRM Sólido (Next.js)
```

Todo corre local. Frigate procesa el video en el mini PC. Con el Google Coral USB, la detección de personas corre a 30fps con 4 cámaras sin saturar el CPU.

---

## 5. Flujos de automatización

### Flujo A — Intrusión confirmada (máxima alerta)

```
TRIGGER (cualquiera de estos):
  ├── Sensor puerta/ventana ABIERTO
  └── Frigate detecta "person" con confianza > 80%

CONDICIÓN:
  └── Sistema en modo ARMADO (fuera de horario laboral)
      O modo AWAY activado manualmente

ACCIONES (en paralelo, en menos de 2 segundos):
  1. Encender TODAS las luces del taller al 100%
  2. Activar sirena Zigbee (95dB)
  3. Reproducir en bocina → mensaje TTS disuasivo (ver §7)
  4. Enviar notificación Telegram:
     - Foto del intruso (captura Frigate)
     - Clip de 10 segundos
     - Botones: [✅ Soy yo, desactivar] [🚨 Llamar seguridad] [🔇 Silenciar sirena]
  5. Guardar evento en Supabase (tabla: security_events)
  6. Repetir mensaje TTS cada 45 segundos mientras alarma activa
```

### Flujo B — Merodeo exterior (alerta silenciosa)

```
TRIGGER:
  └── Frigate detecta persona FUERA del perímetro (cámara exterior)
      entre 10pm y 6am

CONDICIÓN:
  └── Sin apertura de sensores

ACCIONES:
  1. Encender focos exteriores (luz disuasiva)
  2. Notificación silenciosa a celular con foto
  3. Grabar clip de 30 segundos
  (Sin sirena — podría ser alguien en la calle)
```

### Flujo C — Apertura sin confirmación visual

```
TRIGGER:
  └── Sensor de puerta/ventana ABIERTO

CONDICIÓN:
  └── Frigate NO detecta persona en los próximos 15 segundos
      (viento, falla de sensor, mascota)

ACCIONES:
  1. Notificación de bajo riesgo: "Sensor X activado, sin persona detectada"
  2. NO activar sirena
  (Esto elimina las falsas alarmas)
```

### Flujo D — Corte de energía

```
TRIGGER:
  └── UPS detecta que pasó a batería (sensor de energía)

ACCIONES:
  1. Notificación inmediata: "⚠️ Corte de energía en el taller"
  2. Si el corte coincide con modo ARMADO:
     → Subir nivel de alerta (probable intento de deshabilitar sistema)
     → Activar sirena inmediatamente
     → Notificación con foto de las cámaras (que siguen operando con el UPS)
```

### Flujo E — Apertura en horario laboral

```
TRIGGER:
  └── Sensor de puerta principal ABIERTO

CONDICIÓN:
  └── Sistema en modo DESARMADO (horario laboral 7am-7pm)

ACCIONES:
  1. Reproducir chime de bienvenida por la bocina del taller
     (integración con el módulo Anunciador)
  2. Registrar hora de apertura
  (Sin alerta — es operación normal)
```

---

## 6. Modos del sistema

Controlas el modo desde la app de Home Assistant o Telegram:

| Modo | Cuándo | Qué hace |
|---|---|---|
| **DESARMADO** | Horario laboral | Solo registra, chime de bienvenida |
| **ARMADO CASA** | Noche con personas adentro | Sensores exteriores activos, interior silencioso |
| **ARMADO AUSENTE** | Local cerrado | Todo activo, respuesta completa |
| **PÁNICO** | Botón manual de emergencia | Sirena + TTS + notificaciones inmediatas sin condiciones |

El modo se cambia automáticamente por horario, o manualmente desde el celular.

---

## 7. Mensajes TTS disuasivos

Pre-generados con ElevenLabs (alta calidad) o Piper (local/gratis). Se rotan aleatoriamente para que no suenen robóticos:

**Mensaje 1 (inmediato al detectar):**
> *"Atención. Este establecimiento cuenta con vigilancia activa las 24 horas. Su presencia ha sido detectada y grabada. Las autoridades han sido notificadas y una unidad está en camino."*

**Mensaje 2 (repetición a los 45 seg):**
> *"Aviso de seguridad. Usted está siendo grabado en este momento. Las imágenes han sido transmitidas a las autoridades. Abandone el local inmediatamente."*

**Mensaje 3 (variante):**
> *"Este negocio está protegido por un sistema de seguridad inteligente. Su rostro, ropa y movimientos están siendo registrados en tiempo real. Ha sido identificado."*

**Generación:** Con ElevenLabs o Piper, generas los 3 audios una vez, los guardas como `alert_1.mp3`, `alert_2.mp3`, `alert_3.mp3`. Home Assistant los rota. Costo de generación con ElevenLabs: menos de US$0.10 total.

---

## 8. Integración con CRM Sólido

La tabla `security_events` en Supabase conecta todo:

```sql
CREATE TABLE security_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  timestamptz DEFAULT now(),
  type        text,          -- 'intrusion', 'perimeter', 'sensor_open', 'power_cut'
  sensor_id   text,          -- qué sensor disparó
  camera_id   text,          -- qué cámara capturó
  snapshot_url text,         -- foto del evento (Frigate → Supabase Storage)
  clip_url    text,          -- clip de video
  resolved    boolean DEFAULT false,
  resolved_at timestamptz,
  notes       text
);
```

Esto te permite:
- Ver el historial de eventos desde el CRM
- El módulo Anunciador puede leer estos eventos y anunciarlos en el taller
- Panel de seguridad en el CRM con estado en tiempo real

---

## 9. Configuración Frigate (`frigate.yml`)

```yaml
mqtt:
  host: localhost          # Mosquitto local

cameras:
  entrada_principal:
    ffmpeg:
      inputs:
        - path: rtsp://admin:password@192.168.1.101:554/stream1
          roles: [detect, record]
    detect:
      width: 1280
      height: 720
      fps: 5              # 5fps para detección es suficiente
    record:
      enabled: true
      retain:
        days: 14           # 2 semanas de grabación continua
      events:
        retain:
          default: 30      # eventos importantes 30 días
    snapshots:
      enabled: true
      bounding_box: true   # dibuja cuadro alrededor de la persona
    motion:
      mask:
        - 0,0,1280,100     # excluir zona (ej: letrero con luz intermitente)

  area_bahias:
    ffmpeg:
      inputs:
        - path: rtsp://admin:password@192.168.1.102:554/stream1
          roles: [detect, record]
    # ... misma config

objects:
  track: [person]          # SOLO personas, ignora perros, gatos, carros
  filters:
    person:
      min_area: 5000       # ignora objetos pequeños (reduce falsas alarmas)
      threshold: 0.80      # confianza mínima 80%

detectors:
  coral:
    type: edgetpu
    device: usb            # Google Coral USB
```

---

## 10. Automatización Home Assistant (`security_alarm.yaml`)

```yaml
alias: "Seguridad - Intrusión Confirmada"
trigger:
  - platform: state
    entity_id:
      - binary_sensor.puerta_principal
      - binary_sensor.puerta_trasera
      - binary_sensor.ventana_izquierda
      - binary_sensor.ventana_derecha
    to: "on"
  - platform: mqtt
    topic: frigate/events
    payload: "person"    # simplificado; en realidad filtra por zona

condition:
  - condition: state
    entity_id: alarm_control_panel.taller
    state: armed_away    # solo si sistema armado

action:
  - parallel:
    - service: light.turn_on
      target:
        area_id: taller_completo
      data:
        brightness_pct: 100

    - service: siren.turn_on
      target:
        entity_id: siren.sirena_taller

    - service: media_player.play_media
      target:
        entity_id: media_player.bocina_taller
      data:
        media_content_id: /config/www/audio/alert_1.mp3
        media_content_type: music

    - service: notify.telegram_yoel
      data:
        message: "🚨 ALERTA: Intrusión detectada en el taller"
        data:
          photo:
            - file: /config/frigate/snapshots/latest.jpg
          inline_keyboard:
            - "✅ Soy yo, desactivar:/desactivar_alarma"
            - "🔇 Silenciar sirena:/silenciar_sirena"
```

---

## 11. Fases de implementación

| Fase | Entregable | Hardware necesario | Tiempo dev |
|---|---|---|---|
| **1 — Cámaras + Frigate** | Video en vivo + detección de personas + grabación | Mini PC, 2 cámaras, switch PoE | 4–6 horas |
| **2 — Sensores + Notificaciones** | Alerta Telegram con foto al abrir puerta/ventana | Dongle Zigbee, 4 sensores apertura | 3–4 horas |
| **3 — Sirena + Luces** | Respuesta física automática | Sirena Zigbee, bombillos Zigbee | 2–3 horas |
| **4 — Voz disuasiva** | TTS desde bocina al detectar intruso | Parlante (ya lo tienes del Anunciador) | 2 horas |
| **5 — Modos + Panel CRM** | Control desde celular + historial en Supabase | — (solo software) | 3–4 horas |
| **6 — UPS + Corte de luz** | Alarma si cortan la energía | UPS | 1 hora |

**Total desarrollo: ~15–20 horas**  
**Puedes arrancar con la Fase 1 sin comprar todos los sensores.**

---

## 12. Lo que Claude Code escribe por ti

Cuando tengas el hardware y vayas a Claude Code, le pides:

1. **`frigate.yml`** — configuración completa con tus IPs de cámara
2. **`security_alarm.yaml`** — las 5 automatizaciones de Home Assistant
3. **`telegram_bot.py`** — extensión del bot existente con botones de control
4. **Migración Supabase** — tabla `security_events` y políticas RLS
5. **Componente React** — panel de seguridad en el CRM (estado + historial)
6. **`generate_tts.js`** — script que genera los audios disuasivos con Piper
7. **`ecosystem.config.js`** — actualizado para incluir el proceso de seguridad

---

## 13. Costo total estimado

| Categoría | Costo |
|---|---|
| Mini PC N100 (si no lo tienes) | US$150 |
| Google Coral USB (opcional) | US$60 |
| 4 cámaras Reolink | US$220 |
| Switch PoE 5 puertos | US$40 |
| Dongle Zigbee | US$25 |
| 4 sensores apertura Aqara | US$60 |
| 2 sensores movimiento Aqara | US$40 |
| Sirena Zigbee | US$35 |
| 4 bombillos Zigbee | US$50 |
| UPS 600VA | US$70 |
| Bocina (ya tienes del Anunciador) | US$0 |
| **TOTAL** | **~US$750** |

Sin el mini PC (si ya lo compraste para el CRM): **~US$600**  
Versión mínima funcional (Fase 1+2): **~US$350**

---

## 14. Respuesta a "¿es posible con Claude Code?"

**Sí, completamente.** Claude Code escribe el 100% del software:
- Configuración de Frigate (YAML)
- Automatizaciones de Home Assistant (YAML)
- Scripts de integración con Supabase
- Componentes del panel en el CRM
- Script de generación de audios TTS
- Bot de Telegram con controles

Lo único que Claude Code no puede hacer es conectar el cable de red a la cámara. El hardware lo instalas tú en 1-2 horas; el software lo construye Claude Code en 15-20 horas de sesiones.

La ventaja de tu setup: **ya tienes Supabase, el bot de Telegram, el mini PC y el parlante**. La mitad de la infraestructura ya existe en el CRM Sólido.
