# Módulo: Anunciador de Taller (`workshop-announcer`)

**Repositorio sugerido:** `crm-solido/workshop-announcer`  
**Corre en:** Mini PC (Intel N100) del taller — proceso Node.js permanente  
**Dependencias externas:** Supabase (ya existente), Piper TTS (local), `aplay`/`mpg123` (audio Linux)

---

## 1. Posición en el ecosistema CRM Sólido

```
CRM Sólido (Next.js)
    │
    └──► Supabase (PostgreSQL + Realtime)
              │
              │  WebSocket (saliente del taller → Supabase cloud)
              ▼
        workshop-announcer  ← Node.js en el Mini PC
              │
              ├── Cola de audio (en memoria)
              ├── Piper TTS (proceso local)
              └── Parlante USB/3.5mm
```

El servicio **nunca expone ningún puerto**. Solo hace una conexión saliente a Supabase, igual que el CRM. No hay firewall que configurar.

---

## 2. Stack técnico

| Componente | Tecnología | Justificación |
|---|---|---|
| Runtime | Node.js 20 LTS | Ya instalado si se usa el mismo mini PC que el CRM |
| Supabase client | `@supabase/supabase-js` v2 | Realtime nativo, misma lib del CRM |
| TTS | Piper (`piper-tts` npm wrapper o binario directo) | Local, gratis, voz es_MX o es_ES disponible |
| Audio playback | `node-speaker` + `mpg123` | `mpg123` para MP3 cacheados, `node-speaker` para PCM directo |
| Cola | Bull + Redis o simple array en memoria | Empezar con array en memoria; migrar a Bull si crece |
| Config | `.env` + `config.json` | Variables de entorno para credenciales, JSON para reglas |
| Process manager | PM2 | Mantiene el servicio activo con auto-restart |
| Logs | Pino (JSON) | Liviano, compatible con cualquier agregador |

---

## 3. Estructura de archivos

```
workshop-announcer/
├── src/
│   ├── index.js              # Entry point, inicializa todo
│   ├── supabase/
│   │   └── listener.js       # Suscripción Realtime a tabla ordenes
│   ├── audio/
│   │   ├── queue.js          # Cola con prioridad + deduplicación
│   │   ├── player.js         # Reproduce archivos de audio
│   │   └── tts.js            # Genera audio con Piper (con caché)
│   ├── announcements/
│   │   ├── templates.js      # Plantillas de texto por transición de estado
│   │   └── rules.js          # Lógica: qué anunciar, cuándo, a quién
│   └── utils/
│       ├── schedule.js       # Horario laboral (no anunciar de noche)
│       └── logger.js         # Pino logger
├── cache/                    # Audios pre-generados (gitignored)
│   ├── chime.mp3
│   ├── atencion.mp3
│   └── estados/
├── config/
│   └── config.json           # Horario, estados a anunciar, repetición
├── .env                      # SUPABASE_URL, SUPABASE_ANON_KEY
├── package.json
└── ecosystem.config.js       # Config de PM2
```

---

## 4. Flujo completo de un anuncio

```
1. Supabase Realtime emite UPDATE en tabla `ordenes`
       estado_anterior: "recibido"
       estado_nuevo:    "diagnostico"
       datos: { id, placa, marca, modelo, tecnico_asignado }

2. listener.js recibe el evento

3. rules.js evalúa:
   - ¿Es una transición que merece anuncio? → SÍ
   - ¿Estamos en horario laboral? → SÍ (7am-7pm)
   - ¿Ya hay un anuncio idéntico en cola? → NO (deduplicar)

4. templates.js construye el texto:
   "Atención. Honda Civic, placa Alpha 1 2 3,
    pasó a diagnóstico. Bahía pendiente de asignación."

5. tts.js:
   - Busca en cache/ si ese texto ya fue generado → cache HIT
   - Si no: llama Piper → genera MP3 → guarda en cache/

6. queue.js encola el anuncio con prioridad NORMAL

7. player.js:
   - Reproduce chime.mp3 (1 seg)
   - Reproduce el anuncio
   - Libera la cola para el siguiente

8. logger.js registra: timestamp, orden_id, transición, duración
```

---

## 5. Código de referencia

### `src/supabase/listener.js`

```javascript
import { createClient } from '@supabase/supabase-js'
import { evaluateAndEnqueue } from '../announcements/rules.js'
import logger from '../utils/logger.js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export function startListener() {
  const channel = supabase
    .channel('workshop-announcer')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'ordenes' },
      (payload) => {
        logger.info({ orderId: payload.new.id, event: 'realtime_update' })
        evaluateAndEnqueue(payload.old, payload.new)
      }
    )
    .subscribe((status) => {
      logger.info({ status }, 'Supabase Realtime subscription')
    })

  // Reconexión automática si cae
  channel.on('system', {}, ({ event }) => {
    if (event === 'disconnected') {
      logger.warn('Realtime disconnected, reconnecting...')
      setTimeout(() => startListener(), 5000)
    }
  })
}
```

### `src/announcements/templates.js`

```javascript
// Texto que se convierte a voz
// Las placas se leen letra por letra para mejor comprensión
const readPlate = (plate) => plate.split('').join(' ')

export const TEMPLATES = {
  recibido_diagnostico: (o) =>
    `Atención. ${o.marca} ${o.modelo}, placa ${readPlate(o.placa)}, 
     pasó a diagnóstico. Bahía pendiente de asignación.`,

  diagnostico_aprobado: (o) =>
    `Orden aprobada. ${o.marca} ${o.modelo}, placa ${readPlate(o.placa)}, 
     puede iniciar reparación.`,

  reparacion_control_calidad: (o) =>
    `${o.marca} ${o.modelo}, placa ${readPlate(o.placa)}, 
     listo para control de calidad.`,

  control_calidad_listo: (o) =>
    `Vehículo listo. ${o.marca} ${o.modelo}, placa ${readPlate(o.placa)}. 
     Notificar al cliente.`,

  // Urgencia: orden lleva más de 15 min sin técnico
  sin_asignar_recordatorio: (o) =>
    `Recordatorio. ${o.marca} ${o.modelo}, placa ${readPlate(o.placa)}, 
     lleva quince minutos esperando técnico.`,
}

export const PRIORITY = {
  recibido_diagnostico:      2, // normal
  diagnostico_aprobado:      2,
  reparacion_control_calidad: 2,
  control_calidad_listo:     1, // alta (avisa a secretaria)
  sin_asignar_recordatorio:  3, // baja
}
```

### `src/audio/queue.js`

```javascript
// Cola simple con prioridad. Prioridad 1 = más urgente.
const queue = []
let isPlaying = false

export function enqueue(audioPath, priority = 2, dedupeKey = null) {
  // Deduplicar: no encolar el mismo anuncio dos veces
  if (dedupeKey && queue.some(item => item.dedupeKey === dedupeKey)) {
    return
  }

  queue.push({ audioPath, priority, dedupeKey })
  queue.sort((a, b) => a.priority - b.priority)

  if (!isPlaying) processNext()
}

async function processNext() {
  if (queue.length === 0) {
    isPlaying = false
    return
  }
  isPlaying = true
  const item = queue.shift()
  await playAudio(item.audioPath)   // de player.js
  processNext()
}
```

### `src/audio/tts.js`

```javascript
import { execFile } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import path from 'path'

const CACHE_DIR = './cache/tts'
mkdirSync(CACHE_DIR, { recursive: true })

// Piper: descargado como binario en /usr/local/bin/piper
// Modelo: es_MX-claude-high.onnx (o es_ES disponible en piper-voices)
const PIPER_BIN  = process.env.PIPER_BIN  || '/usr/local/bin/piper'
const PIPER_MODEL = process.env.PIPER_MODEL || '/opt/piper/models/es_MX-claude-high.onnx'

export async function textToAudio(text) {
  const hash = createHash('md5').update(text).digest('hex')
  const outPath = path.join(CACHE_DIR, `${hash}.wav`)

  if (existsSync(outPath)) return outPath   // cache hit

  await new Promise((resolve, reject) => {
    const args = ['--model', PIPER_MODEL, '--output_file', outPath]
    const proc = execFile(PIPER_BIN, args)
    proc.stdin.write(text)
    proc.stdin.end()
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Piper exit ${code}`)))
  })

  return outPath
}
```

---

## 6. Configuración (`config/config.json`)

```json
{
  "schedule": {
    "start": "07:00",
    "end":   "19:30",
    "timezone": "America/Santo_Domingo"
  },
  "transitions": {
    "recibido→diagnostico":           { "announce": true,  "priority": 2 },
    "diagnostico→aprobado":           { "announce": true,  "priority": 2 },
    "aprobado→en_reparacion":         { "announce": false },
    "en_reparacion→control_calidad":  { "announce": true,  "priority": 2 },
    "control_calidad→listo":          { "announce": true,  "priority": 1 },
    "listo→entregado":                { "announce": false }
  },
  "reminders": {
    "sin_asignar_minutos": 15,
    "intervalo_repeticion_minutos": 10
  },
  "audio": {
    "chime": "./cache/chime.mp3",
    "volume": 85
  }
}
```

---

## 7. `ecosystem.config.js` (PM2)

```javascript
module.exports = {
  apps: [{
    name:         'workshop-announcer',
    script:       'src/index.js',
    watch:        false,
    restart_delay: 5000,
    max_restarts:  10,
    env: {
      NODE_ENV:           'production',
      SUPABASE_URL:       'https://xxxx.supabase.co',
      SUPABASE_ANON_KEY:  'eyJ...',
      PIPER_BIN:          '/usr/local/bin/piper',
      PIPER_MODEL:        '/opt/piper/models/es_MX-claude-high.onnx',
    }
  }]
}
```

---

## 8. Migración de estados en Supabase

Para que Realtime funcione correctamente, la tabla `ordenes` necesita:

```sql
-- Habilitar replicación en la tabla
ALTER TABLE ordenes REPLICA IDENTITY FULL;

-- Agregar la tabla al publication de Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ordenes;
```

Si la tabla ya está en el publication del CRM existente, no hay nada que hacer.

---

## 9. Instalación en el Mini PC

```bash
# 1. Instalar Piper
wget https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz
tar -xzf piper_linux_x86_64.tar.gz -C /usr/local/bin/

# 2. Descargar modelo de voz en español
mkdir -p /opt/piper/models
wget -O /opt/piper/models/es_MX.onnx \
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx"
wget -O /opt/piper/models/es_MX.onnx.json \
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx.json"

# 3. Clonar e instalar el módulo
git clone https://github.com/crm-solido/workshop-announcer
cd workshop-announcer && npm install

# 4. Configurar variables de entorno
cp .env.example .env && nano .env

# 5. Pre-generar audios base (chime + frases comunes)
node scripts/pregenerate-cache.js

# 6. Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save && pm2 startup  # auto-start en reboot
```

---

## 10. Fases de implementación

| Fase | Entregable | Tiempo estimado |
|---|---|---|
| **1 — Fundación** | Listener Supabase → log por consola (sin audio) | 2-3 horas |
| **2 — Audio básico** | Piper TTS + reproductor + chime, sin cola | 3-4 horas |
| **3 — Cola inteligente** | Prioridad + deduplicación + horario laboral | 2-3 horas |
| **4 — Recordatorios** | Cron cada 5 min para órdenes sin asignar | 1-2 horas |
| **5 — Integración TV** | Emitir evento al módulo Pantalla TV en paralelo | 1 hora |

**Total estimado: 10-13 horas de desarrollo**

---

## 11. Cómo se relaciona con los demás módulos

```
workshop-announcer
    │
    ├── lee de → Supabase (tabla ordenes, tabla vehiculos)
    │
    ├── emite eventos a → Módulo Pantalla TV
    │   (mismo cambio de estado = actualización visual sincronizada)
    │
    └── futuro: recibe trigger de → Módulo WhatsApp
        (cliente responde "SÍ" → anuncio "Nueva cita confirmada para mañana")
```

---

## 12. Consideraciones de robustez

- **Sin internet:** Si Supabase no responde al arrancar, el servicio reintenta cada 30 seg. No crashea.
- **Sin audio:** Si el parlante se desconecta, el error se loguea pero el servicio sigue corriendo. No impacta el CRM.
- **Overflow de cola:** Máximo 20 anuncios en cola. Si se supera, se descartan los de prioridad baja primero.
- **Cache de TTS:** Los mensajes son plantillas + datos del vehículo. La parte fija (frases) se pre-genera al instalar. Solo se llama a Piper en tiempo real para las partes variables (placa, modelo). El cache persiste en disco.
