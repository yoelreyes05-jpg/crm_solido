import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Car, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VehiculosPage() {
  const vehicles = await prisma.vehicle.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      client: true,
      _count: {
        select: { workOrders: true }
      }
    }
  });

  return (
    <div className="animate-fade-in">
      <div className="header">
        <h1 className="header-title">Gestión de Vehículos</h1>
        <button className="btn btn-primary">
          <Plus size={20} /> Nuevo Vehículo
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Placa / Chasis</th>
                <th>Marca y Modelo</th>
                <th>Año</th>
                <th>Propietario / Cliente</th>
                <th>Historial de Órdenes</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>No hay vehículos registrados.</td>
                </tr>
              ) : (
                vehicles.map(vehicle => (
                  <tr key={vehicle.id}>
                    <td style={{ fontWeight: 600 }}>{vehicle.plate}</td>
                    <td>{vehicle.brand} {vehicle.model}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{vehicle.year}</td>
                    <td>{vehicle.client.name}</td>
                    <td>
                      <span className="badge badge-green">
                        {vehicle._count.workOrders} Servicios
                      </span>
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
