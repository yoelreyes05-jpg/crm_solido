import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OrdenesPage() {
  const orders = await prisma.workOrder.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      vehicle: {
        include: { client: true }
      }
    }
  });

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'RECIBIDO': return 'badge-blue';
      case 'DIAGNOSTICO': return 'badge-yellow';
      case 'ESPERANDO_REPUESTO': return 'badge-red';
      case 'REPARACION': return 'badge-yellow';
      case 'LISTO': return 'badge-green';
      case 'ENTREGADO': return 'badge-green';
      default: return 'badge-blue';
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="header">
        <h1 className="header-title">Órdenes de Trabajo</h1>
        <button className="btn btn-primary">
          <Plus size={20} /> Nueva Orden
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nº Orden</th>
                <th>Vehículo</th>
                <th>Cliente</th>
                <th>Falla Reportada</th>
                <th>Estado Actual</th>
                <th>Técnico Asignado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No hay órdenes de trabajo activas.</td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 600 }}>#{order.id.toString().padStart(4, '0')}</td>
                    <td>{order.vehicle.brand} {order.vehicle.model} ({order.vehicle.plate})</td>
                    <td>{order.vehicle.client.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{order.description}</td>
                    <td>
                      <select 
                        defaultValue={order.status}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold', width: 'auto' }}
                      >
                        <option value="RECIBIDO">Recibido</option>
                        <option value="DIAGNOSTICO">En Diagnóstico</option>
                        <option value="ESPERANDO_REPUESTO">Esperando Repuestos</option>
                        <option value="REPARACION">En Reparación</option>
                        <option value="LISTO">Listo</option>
                        <option value="ENTREGADO">Entregado</option>
                      </select>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{order.technician || 'Sin Asignar'}</td>
                    <td>
                      <button className="btn" style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--surface-hover)', fontSize: '0.75rem' }}>
                        Ver Detalles
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
