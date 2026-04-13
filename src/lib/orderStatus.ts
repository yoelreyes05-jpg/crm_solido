export const ORDER_STATUSES = [
  {
    value: 'RECIBIDO',
    label: 'Recibido, su vehículo pronto será atendido',
    badge: 'badge-blue',
  },
  {
    value: 'DIAGNOSTICO',
    label: 'Diagnóstico en proceso',
    badge: 'badge-yellow',
  },
  {
    value: 'CONTROL_CALIDAD',
    label: 'Control de calidad final',
    badge: 'badge-red',
  },
  {
    value: 'REPARACION',
    label: 'En reparación',
    badge: 'badge-orange',
  },
  {
    value: 'LISTO',
    label: 'Listo para retiro',
    badge: 'badge-green',
  },
  {
    value: 'ENTREGADO',
    label: 'Entregado al cliente',
    badge: 'badge-gray',
  },
];

export function getOrderStatus(status: string) {
  const clean = (status || '').toUpperCase();

  return (
    ORDER_STATUSES.find((s) => s.value === clean) || {
      value: clean,
      label: status || 'SIN ESTADO',
      badge: 'badge-gray',
    }
  );
}