import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ArrowRight, Wrench, Clock, CheckCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const activeOrders = await prisma.workOrder.count({
    where: {
      status: { notIn: ['ENTREGADO'] }
    }
  });

  const readyOrders = await prisma.workOrder.count({
    where: { status: 'LISTO' }
  });

  const waitingPartsOrders = await prisma.workOrder.count({
    where: { status: 'ESPERANDO_REPUESTO' }
  });

  const recentOrders = await prisma.workOrder.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { vehicle: { include: { client: true } } }
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
        <h1 className="header-title">Dashboard Operativo</h1>
      </div>

      <div className="grid grid-cols-3">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--status-blue-bg)', color: 'var(--status-blue)', borderRadius: '0.5rem' }}>
              <Wrench size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>{activeOrders}</div>
              <div style={{ color: 'var(--text-muted)' }}>Vehículos en Taller</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--status-yellow-bg)', color: 'var(--status-yellow)', borderRadius: '0.5rem' }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>{waitingPartsOrders}</div>
              <div style={{ color: 'var(--text-muted)' }}>Esperando Repuestos</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--status-green-bg)', color: 'var(--status-green)', borderRadius: '0.5rem' }}>
              <CheckCircle size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>{readyOrders}</div>
              <div style={{ color: 'var(--text-muted)' }}>Listos para Entrega</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Últimas Órdenes de Trabajo</h2>
          <Link href="/ordenes" className="btn" style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)' }}>
            Ver todas <ArrowRight size={16} />
          </Link>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Vehículo</th>
                <th>Problema</th>
                <th>Estado</th>
                <th>Fecha Ingreso</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No hay órdenes activas.</td>
                </tr>
              ) : (
                recentOrders.map(order => (
                  <tr key={order.id}>
                    <td>#{order.id.toString().padStart(4, '0')}</td>
                    <td style={{ fontWeight: 500 }}>{order.vehicle.client.name}</td>
                    <td>{order.vehicle.brand} {order.vehicle.model} ({order.vehicle.plate})</td>
                    <td style={{ color: 'var(--text-muted)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.description}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {new Date(order.createdAt).toLocaleDateString()}
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
