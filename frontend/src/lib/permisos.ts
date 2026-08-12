// ─────────────────────────────────────────────────────────────────────────────
// Sistema de Permisos RBAC — Sólido Auto Servicio
// Cada módulo tiene 5 acciones: ver | crear | editar | aprobar | eliminar
// El gerente puede editar estos permisos desde /permisos
// ─────────────────────────────────────────────────────────────────────────────

export type Accion = "ver" | "crear" | "editar" | "aprobar" | "eliminar";

export interface PermisoModulo {
  ver:      boolean;
  crear:    boolean;
  editar:   boolean;
  aprobar:  boolean;
  eliminar: boolean;
}

export interface ModuloInfo {
  key:         string;
  label:       string;
  descripcion: string;
  grupo:       string;
}

// ── Definición de todos los módulos del sistema ───────────────────────────────
export const MODULOS_SISTEMA: ModuloInfo[] = [
  // Inicio
  { key: "dashboard",       label: "Dashboard",              descripcion: "Panel general, KPIs y estado del taller",              grupo: "Taller"    },
  // Flujo de taller
  { key: "recepcion",       label: "Recepción",              descripcion: "Wizard de entrada de vehículos",                      grupo: "Taller"    },
  { key: "taller",          label: "Mi Taller",              descripcion: "Cola de trabajo del técnico",                          grupo: "Taller"    },
  { key: "diagnostico",     label: "Diagnóstico",            descripcion: "Hallazgos técnicos y cotización",                      grupo: "Taller"    },
  { key: "reparacion",      label: "Reparación",             descripcion: "Avances de reparación y piezas usadas",                grupo: "Taller"    },
  { key: "aprobacion",      label: "Aprobación cliente",     descripcion: "Aprueba o rechaza cotización",                         grupo: "Taller"    },
  { key: "control_calidad", label: "Control de Calidad",     descripcion: "Revisión final antes de entrega",                      grupo: "Taller"    },
  { key: "entrega",         label: "Entrega",                descripcion: "Entrega del vehículo al cliente",                      grupo: "Taller"    },
  // Clientes y vehículos
  { key: "clientes",        label: "Clientes",               descripcion: "Ficha y gestión de clientes",                          grupo: "Clientes"  },
  { key: "vehiculos",       label: "Vehículos",              descripcion: "Ficha y gestión de vehículos",                         grupo: "Clientes"  },
  { key: "fichas_tecnicas", label: "Fichas técnicas",        descripcion: "Catálogo de aceite, cantidad y filtros por modelo",    grupo: "Clientes"  },
  { key: "ordenes",         label: "Órdenes de Trabajo",     descripcion: "Listado completo de órdenes",                          grupo: "Clientes"  },
  { key: "historial",       label: "Historial Vehículos",    descripcion: "Historial permanente por vehículo",                    grupo: "Clientes"  },
  { key: "fidelizacion",    label: "Fidelización",           descripcion: "Programa de puntos Club Sólido (multicanal)",          grupo: "Clientes"  },
  { key: "citas",           label: "Citas",                  descripcion: "Agenda del taller — citas de clientes",                grupo: "Clientes"  },
  { key: "recordatorios",   label: "Recordatorios",          descripcion: "Centro de comunicación — WhatsApp de mantenimientos, citas y seguimiento", grupo: "Clientes" },
  { key: "planes",          label: "Planes / Membresías",    descripcion: "Planes Lavado, Básico, Premium y VIP — beneficios automáticos en todo el CRM", grupo: "Clientes" },
  // Almacén
  { key: "inventario",      label: "Inventario",             descripcion: "Piezas y materiales en stock",                         grupo: "Almacén"   },
  { key: "tarifario",       label: "Tarifario Mano de Obra", descripcion: "Catálogo de operaciones del taller con tiempo estándar y precio por segmento de vehículo", grupo: "Almacén" },
  { key: "suplidores",      label: "Suplidores",             descripcion: "Proveedores y compras",                                grupo: "Almacén"   },
  // Finanzas
  { key: "ventas",          label: "Ventas POS",             descripcion: "Punto de venta de repuestos",                          grupo: "Finanzas"  },
  { key: "facturacion",     label: "Facturación",            descripcion: "Facturas con NCF dominicano. \"Aprobar\" = puede cobrar (recibir el pago) las facturas pendientes de cobro", grupo: "Finanzas"  },
  { key: "contabilidad",    label: "Contabilidad / Caja",    descripcion: "Cuadre de caja y caja chica",                          grupo: "Finanzas"  },
  // Servicios
  { key: "cafeteria",       label: "Cafetería",              descripcion: "POS de cafetería",                                     grupo: "Servicios" },
  { key: "carwash",         label: "Car Wash / Lavado",      descripcion: "Registro y cobro de lavados de vehículos",             grupo: "Servicios" },
  { key: "mis_lavados",     label: "Mis Lavados",            descripcion: "Panel del técnico de lavado — vehículos asignados",     grupo: "Servicios" },
  { key: "aloha",           label: "Aloha Perfumes",         descripcion: "ALOHA Perfume Store — POS, clientes, inventario y contabilidad independientes", grupo: "Servicios" },
  // Administración
  { key: "mantenimiento",   label: "Mantenimiento",          descripcion: "Planes y alertas de mantenimiento preventivo",         grupo: "Admin"     },
  { key: "inteligencia",    label: "Inteligencia Predictiva",descripcion: "Análisis predictivo e inteligencia de negocios",       grupo: "Admin"     },
  { key: "usuarios",        label: "Usuarios",               descripcion: "Gestión de cuentas de usuario",                        grupo: "Admin"     },
  { key: "configuracion",   label: "Configuración",          descripcion: "Ajustes generales del sistema",                        grupo: "Admin"     },
  { key: "permisos",        label: "Permisos de Roles",      descripcion: "Gestión de acceso por rol",                            grupo: "Admin"     },
  { key: "auditoria",       label: "Auditoría",              descripcion: "Registro de acciones sensibles (quién hizo qué y cuándo)", grupo: "Admin" },
  { key: "capacitaciones",  label: "Capacitaciones",         descripcion: "Cursos, alumnos, ingresos y tasas de deserción",       grupo: "Admin"     },
  // Seguridad
  { key: "seguridad",       label: "Seguridad",              descripcion: "Cámaras, zonas de alarma, armado/desarmado y bitácora de seguridad", grupo: "Seguridad" },
  { key: "altavoz",         label: "Altavoz",                descripcion: "Llamar técnicos y anunciar por las bocinas del taller", grupo: "Seguridad" },
];

// ── Shortcuts de conjuntos de permisos ───────────────────────────────────────
const TODO:      PermisoModulo = { ver: true,  crear: true,  editar: true,  aprobar: true,  eliminar: true  };
const OPERACION: PermisoModulo = { ver: true,  crear: true,  editar: true,  aprobar: false, eliminar: false };
const APROBADOR: PermisoModulo = { ver: true,  crear: false, editar: false, aprobar: true,  eliminar: false };
const VER:       PermisoModulo = { ver: true,  crear: false, editar: false, aprobar: false, eliminar: false };
const NADA:      PermisoModulo = { ver: false, crear: false, editar: false, aprobar: false, eliminar: false };
// Igual que OPERACION, pero además puede "aprobar". En el módulo Facturación,
// "aprobar" se usa como el permiso de COBRAR (recibir el pago) una factura
// que quedó pendiente de cobro (ver rol `vendedor`).
const OPERACION_COBRO: PermisoModulo = { ver: true, crear: true, editar: true, aprobar: true, eliminar: false };

// ── Tipo del mapa de permisos por rol ────────────────────────────────────────
export type PermisosRol    = Record<string, PermisoModulo>;
export type PermisosConfig = Record<string, PermisosRol>;

// ── Permisos por defecto — el gerente puede sobreescribirlos desde /permisos ─
export const PERMISOS_DEFAULT: PermisosConfig = {

  // Gerente siempre tiene TODO — se calcula automático desde MODULOS_SISTEMA
  gerente: Object.fromEntries(MODULOS_SISTEMA.map(m => [m.key, { ...TODO }])) as PermisosRol,

  secretaria: {
    dashboard:       VER,
    recepcion:       OPERACION,
    taller:          VER,
    diagnostico:     VER,
    reparacion:      VER,
    aprobacion:      APROBADOR,
    control_calidad: NADA,
    entrega:         APROBADOR,
    clientes:        OPERACION,
    vehiculos:       OPERACION,
    fichas_tecnicas: VER,
    ordenes:         OPERACION,
    historial:       VER,
    fidelizacion:    OPERACION,
    planes:          OPERACION,
    citas:           OPERACION,
    recordatorios:   OPERACION,
    inventario:      VER,
    tarifario:       VER,
    suplidores:      NADA,
    ventas:          NADA,
    facturacion:     OPERACION_COBRO,
    contabilidad:    OPERACION,
    cafeteria:       NADA,
    carwash:         OPERACION,
    mantenimiento:   OPERACION,
    inteligencia:    VER,
    usuarios:        NADA,
    configuracion:   NADA,
    permisos:        NADA,
    capacitaciones:  OPERACION,
    // Atiende el mostrador: es quien llama a los técnicos por bocina.
    // Ve el estado de seguridad pero no arma ni desarma la alarma.
    seguridad:       VER,
    altavoz:         OPERACION,
  },

  tecnico: {
    dashboard:       NADA,
    recepcion:       NADA,
    taller:          OPERACION,
    diagnostico:     OPERACION,
    reparacion:      OPERACION,
    aprobacion:      NADA,
    control_calidad: NADA,
    entrega:         NADA,
    clientes:        VER,
    vehiculos:       VER,
    fichas_tecnicas: VER,
    ordenes:         VER,
    historial:       VER,
    citas:           VER,
    recordatorios:   NADA,
    inventario:      VER,
    tarifario:       VER,
    suplidores:      NADA,
    ventas:          NADA,
    facturacion:     NADA,
    contabilidad:    NADA,
    cafeteria:       NADA,
    carwash:         NADA,
    mantenimiento:   VER,
    inteligencia:    NADA,
    usuarios:        NADA,
    configuracion:   NADA,
    permisos:        NADA,
    capacitaciones:  VER,
    // El técnico recibe los llamados, no los emite. Ajustable desde /permisos
    // si en la práctica necesita avisar al almacén por bocina.
    seguridad:       NADA,
    altavoz:         NADA,
  },

  almacen: {
    dashboard:       VER,
    recepcion:       NADA,
    taller:          VER,
    diagnostico:     NADA,
    reparacion:      VER,
    aprobacion:      NADA,
    control_calidad: NADA,
    entrega:         NADA,
    clientes:        VER,
    vehiculos:       VER,
    fichas_tecnicas: VER,
    ordenes:         VER,
    historial:       NADA,
    inventario:      OPERACION,
    tarifario:       OPERACION,
    suplidores:      OPERACION,
    ventas:          OPERACION,
    facturacion:     VER,
    contabilidad:    NADA,
    cafeteria:       NADA,
    carwash:         NADA,
    mantenimiento:   NADA,
    inteligencia:    NADA,
    usuarios:        NADA,
    configuracion:   NADA,
    permisos:        NADA,
    capacitaciones:  NADA,
    // Anuncia por bocina cuando llega un repuesto que un técnico espera.
    seguridad:       NADA,
    altavoz:         OPERACION,
  },

  cafeteria: {
    dashboard:       NADA,
    recepcion:       NADA,
    taller:          NADA,
    diagnostico:     NADA,
    reparacion:      NADA,
    aprobacion:      NADA,
    control_calidad: NADA,
    entrega:         NADA,
    clientes:        NADA,
    vehiculos:       NADA,
    fichas_tecnicas: NADA,
    ordenes:         NADA,
    historial:       NADA,
    inventario:      NADA,
    tarifario:       NADA,
    suplidores:      NADA,
    ventas:          NADA,
    facturacion:     NADA,
    contabilidad:    NADA,
    cafeteria:       OPERACION,
    carwash:         NADA,
    mantenimiento:   NADA,
    inteligencia:    NADA,
    usuarios:        NADA,
    configuracion:   NADA,
    permisos:        NADA,
  },

  // Técnico de lavado — solo ve su panel de lavados asignados
  lavador: {
    dashboard:       NADA,
    recepcion:       NADA,
    taller:          NADA,
    diagnostico:     NADA,
    reparacion:      NADA,
    aprobacion:      NADA,
    control_calidad: NADA,
    entrega:         NADA,
    clientes:        NADA,
    vehiculos:       NADA,
    fichas_tecnicas: NADA,
    ordenes:         NADA,
    historial:       NADA,
    inventario:      NADA,
    tarifario:       NADA,
    suplidores:      NADA,
    ventas:          NADA,
    facturacion:     NADA,
    contabilidad:    NADA,
    cafeteria:       NADA,
    carwash:         NADA,
    mis_lavados:     OPERACION,
    mantenimiento:   NADA,
    inteligencia:    NADA,
    usuarios:        NADA,
    configuracion:   NADA,
    permisos:        NADA,
  },

  // Aloha — encargado de ALOHA Perfume Store. Solo ve su módulo,
  // con control total dentro de él (POS, clientes, inventario, contabilidad).
  aloha: {
    dashboard:       NADA,
    recepcion:       NADA,
    taller:          NADA,
    diagnostico:     NADA,
    reparacion:      NADA,
    aprobacion:      NADA,
    control_calidad: NADA,
    entrega:         NADA,
    clientes:        NADA,
    vehiculos:       NADA,
    fichas_tecnicas: NADA,
    ordenes:         NADA,
    historial:       NADA,
    fidelizacion:    NADA,
    inventario:      NADA,
    tarifario:       NADA,
    suplidores:      NADA,
    ventas:          NADA,
    facturacion:     NADA,
    contabilidad:    NADA,
    cafeteria:       NADA,
    carwash:         NADA,
    mis_lavados:     NADA,
    aloha:           { ...TODO },
    mantenimiento:   NADA,
    inteligencia:    NADA,
    usuarios:        NADA,
    configuracion:   NADA,
    permisos:        NADA,
    capacitaciones:  NADA,
    // Aloha es un negocio independiente: no toca la seguridad del taller.
    seguridad:       NADA,
    altavoz:         NADA,
  },

  // Vendedor — crea el cliente y emite/despacha la factura de una pieza,
  // pero NO cobra. La secretaria cobra después desde "Por Cobrar" en
  // Facturación. Ajustable desde /permisos.
  vendedor: {
    dashboard:       NADA,
    recepcion:       NADA,
    taller:          NADA,
    diagnostico:     NADA,
    reparacion:      NADA,
    aprobacion:      NADA,
    control_calidad: NADA,
    entrega:         NADA,
    clientes:        OPERACION,
    vehiculos:       OPERACION,
    fichas_tecnicas: VER,
    ordenes:         NADA,
    historial:       NADA,
    fidelizacion:    NADA,
    inventario:      VER,
    tarifario:       VER,
    suplidores:      NADA,
    ventas:          NADA,
    facturacion:     OPERACION,
    contabilidad:    NADA,
    cafeteria:       NADA,
    carwash:         NADA,
    mis_lavados:     NADA,
    mantenimiento:   NADA,
    inteligencia:    NADA,
    usuarios:        NADA,
    configuracion:   NADA,
    permisos:        NADA,
    capacitaciones:  NADA,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Combina la config guardada en el backend SOBRE los permisos por defecto.
 * Así, módulos y roles nuevos agregados en el código (ej. carwash, lavador)
 * siempre tienen un valor por defecto aunque exista una config previa guardada.
 * Lo guardado tiene prioridad módulo por módulo.
 */
export function mergePermisos(saved?: Partial<PermisosConfig> | null): PermisosConfig {
  const base: PermisosConfig = JSON.parse(JSON.stringify(PERMISOS_DEFAULT));
  if (!saved || typeof saved !== "object") return base;
  const out: PermisosConfig = { ...base };
  for (const rol of Object.keys(saved)) {
    out[rol] = { ...(base[rol] || {}), ...(saved[rol] || {}) } as PermisosRol;
  }
  return out;
}

/** Devuelve el mapa de permisos para un rol dado (con fallback a tecnico) */
export function getPermisosRol(rol: string, config?: PermisosConfig): PermisosRol {
  const cfg = config || PERMISOS_DEFAULT;
  return cfg[rol] ?? cfg["tecnico"] ?? {};
}

/** Comprueba si un rol puede hacer una acción en un módulo */
export function puede(
  rol: string,
  modulo: string,
  accion: Accion,
  config?: PermisosConfig
): boolean {
  const permisos = getPermisosRol(rol, config);
  return permisos[modulo]?.[accion] ?? false;
}

/** Lista de grupos únicos de módulos */
export const GRUPOS_MODULOS = Array.from(new Set(MODULOS_SISTEMA.map(m => m.grupo)));
