export const STATUSES = [
  {
    value: 'RECIBIDO',
    label: 'Recibido, su vehículo pronto será atendido',
    badge: 'badge-blue',
  },
  {
    value: 'DIAGNOSTICO',
    label: 'Diagnóstico: nuestro personal técnico está evaluando el vehículo',
    badge: 'badge-yellow',
  },
  {
    value: 'CONTROL_CALIDAD',
    label: 'Control de calidad final en proceso',
    badge: 'badge-red',
  },
  {
    value: 'REPARACION',
    label: 'En reparación por nuestro equipo técnico',
    badge: 'badge-yellow',
  },
  {
    value: 'LISTO',
    label: 'Listo para retiro del cliente',
    badge: 'badge-green',
  },
  {
    value: 'ENTREGADO',
    label: 'Entregado al cliente',
    badge: 'badge-green',
  },
];

export function getStatus(status: string) {
  const cleanStatus = (status || '').toUpperCase().trim();

  return (
    STATUSES.find((s) => s.value === cleanStatus) || {
      value: 'RECIBIDO',
      label: 'Estado no definido - En revisión',
      badge: 'badge-blue',
    }
  );
}