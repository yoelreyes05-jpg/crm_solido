import { prisma } from '@/lib/prisma';
import { Truck, Plus } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SuplidoresPage() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { parts: true }
      }
    }
  });

  return (
    <div className="animate-fade-in">
      <div className="header">
        <h1 className="header-title">Suplidores</h1>
        <button className="btn btn-primary">
          <Plus size={20} /> Nuevo Suplidor
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Repuestos Asociados</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No hay suplidores registrados.</td>
                </tr>
              ) : (
                suppliers.map((supplier: any) => (
                  <tr key={supplier.id}>
                    <td style={{ fontWeight: 600 }}>#{supplier.id.toString().padStart(4, '0')}</td>
                    <td style={{ fontWeight: 500 }}>{supplier.name}</td>
                    <td>{supplier.contact || 'N/A'}</td>
                    <td>{supplier.phone || 'N/A'}</td>
                    <td>
                      <span className="badge badge-blue">
                        {supplier._count.parts} repuestos
                      </span>
                    </td>
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
