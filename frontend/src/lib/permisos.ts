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
  // Flujo de taller
  { key: "recepcion",       label: "Recepción",            descripcion: "Wizard de entrada de vehículos",         grupo: "Taller" },
  { key: "taller",          label: "Mi Taller",            descripcion: "Cola de trabajo del técnico",            grupo: "Taller" },
  { key: "diagnostico",     label: "Diagnóstico",          descripcion: "Hallazgos técnicos y cotización",        grupo: "Taller" },
  { key: "reparacion",      label: "Reparación",           descripcion: "Avances de reparación y piezas usadas",  grupo: "Taller" },
  { key: "aprobacion",      label: "Aprobación cliente",   descripcion: "Aprueba o rechaza cotización",           grupo: "Taller" },
  { key: "control_calidad", label: "Control de Calidad",   descripcion: "Revisión final antes de entrega",        grupo: "Taller" },
  { key: "entrega",         label: "Entrega",              descripcion: "Entrega del vehículo al cliente",        grupo: "Taller" },
  // Clientes y vehículos
  { key: "clientes",        label: "Clientes",             descripcion: "Ficha y gestión de clientes",           grupo: "Clientes" },
  { key: "vehiculos",       label: "Vehículos",            descripcion: "Ficha y gestión de vehículos",          grupo: "Clientes" },
  { key: "ordenes",         label: "Órdenes de Trabajo",   descripcion: "Listado completo de órdenes",           grupo: "Clientes" },
  { key: "historial",       label: "Historial Vehículos",  descripcion: "Historial permanente por vehículo",     grupo: "Clientes" },
  // Almacén
  { key: "inventario",      label: "Inventario",           descripcion: "Piezas y materiales en stock",          grupo: "Almacén" },
  { key: "suplidores",      label: "Suplidores",           descripcion: "Proveedores y compras",                 grupo: "Almacén" },
  // Finanzas
  { key: "ventas",          label: "Ventas POS",           descripcion: "Punto de venta de repuestos",           grupo: "Finanzas" },
  { key: "facturacion",     label: "Facturación",          descripcion: "Facturas con NCF dominicano",           grupo: "Finanzas" },
  { key: "contabilidad",    label: "Contabilidad / Caja",  descripcion: "Cuadre de caja y caja chica",           grupo: "Finanzas" },
  // Servicios
  { key: "cafeteria",       label: "Cafetería",            descripcion: "POS de cafetería",                      grupo: "Servicios" },
  // Administración
  { key: "reportes",        label: "Reportes / BI",        descripcion: "Inteligencia de negocios",              grupo: "Admin" },
  { key: "usuarios",        label: "Usuarios",             descripcion: "Gestión de cuentas de usuario",         grupo: "Admin" },
  { key: "configuracion",   label: "Configuración",        descripcion: "Ajustes generales del sistema",         grupo: "Admin" },
  { key: "permisos",        label: "Permisos de Roles",    descripcion: "Gestión de acceso por rol",             grupo: "Admin" },
];

// ── Shortcuts de conjuntos de permisos ───────────────────────────────────────
const TODO:     PermisoModulo = { ver: true,  crear: true,  editar: true,  aprobar: true,  eliminar: true  };
const OPERACION:PermisoModulo = { ver: true,  crear: true,  editar: true,  aprobar: false, eliminar: false };
const APROBADOR:PermisoModulo = { ver: true,  crear: false, editar: false, aprobar: true,  eliminar: false };
const VER:      PermisoModulo = { ver: true,  crear: false, editar: false, aprobar: false, eliminar: false };
const NADA:     PermisoModulo = { ver: false, crear: false, editar: false, aprobar: false, eliminar: false };

// ── Tipo del mapa de permisos por rol ────────────────────────────────────────
export type PermisosRol    = Record<string, PermisoModulo>;
export type PermisosConfig = Record<string, PermisosRol>;

// ── Permisos por defecto — el gerente puede sobreescribirlos desde /permisos ─
export const PERMISOS_DEFAULT: PermisosConfig = {

  gerente: Object.fromEntries(MODULOS_SISTEMA.map(m => [m.key, { ...TODO }])) as PermisosRol,

  secretaria: {
    recepcion:       OPERACION,
    taller:          VER,
    diagnostico:     VER,
    reparacion:      VER,
    aprobacion:      APROBADOR,
    control_calidad: NADA,
    entrega:         APROBADOR,
    clientes:        OPERACION,
    vehiculos:       OPERACION,
    ordenes:         OPERACION,
    historial:       VER,
    inventario:      VER,
    suplidores:      NADA,
    ventas:          NADA,
    facturacion:     OPERACION,
    contabilidad:    OPERACION,
    cafeteria:       NADA,
    reportes:        VER,
    usuarios:        NADA,
    configuracion:   NADA,
    permisos:        NADA,
  },

  tecnico: {
    recepcion:       NADA,
    taller:          OPERACION,
    diagnostico:     OPERACION,
    reparacion:      OPERACION,
    aprobacion:      NADA,
    control_calidad: NADA,
    entrega:         NADA,
    clientes:        VER,
    vehiculos:       VER,
    ordenes:         VER,
    historial:       VER,
    inventario:      VER,
    suplidores:      NADA,
    ventas:          NADA,
    facturacion:     NADA,
    contabilidad:    NADA,
    cafeteria:       NADA,
    reportes:        NADA,
    usuarios:        NADA,
    configuracion:   NADA,
    permisos:        NADA,
  },

  almacen: {
    recepcion:       NADA,
    taller:          VER,
    diagnostico:     NADA,
    reparacion:      VER,
    aprobacion:      NADA,
    control_calidad: NADA,
    entrega:         NADA,
    clientes:        VER,
    vehiculos:       VER,
    ordenes:         VER,
    historial:       NADA,
    inventario:      OPERACION,
    suplidores:      OPERACION,
    ventas:          OPERACION,
    facturacion:     VER,
    contabilidad:    NADA,
    cafeteria:       NADA,
    reportes:        NADA,
    usuarios:        NADA,
    configuracion:   NADA,
    permisos:        NADA,
  },

  cafeteria: {
    recepcion:       NADA,
    taller:          NADA,
    diagnostico:     NADA,
    reparacion:      NADA,
    aprobacion:      NADA,
    control_calidad: NADA,
    entrega:         NADA,
    clientes:        NADA,
    vehiculos:       NADA,
    ordenes:         NADA,
    historial:       NADA,
    inventario:      NADA,
    suplidores:      NADA,
    ventas:          NADA,
    facturacion:     NADA,
    contabilidad:    NADA,
    cafeteria:       OPERACION,
    reportes:        NADA,
    usuarios:        NADA,
    configuracion:   NADA,
    permisos:        NADA,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
export const GRUPOS_MODULOS = [...new Set(MODULOS_SISTEMA.map(m => m.grupo))];
