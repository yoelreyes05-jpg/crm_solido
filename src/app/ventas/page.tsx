import { prisma } from '@/lib/prisma';
import { ShoppingCart, Plus, Printer } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VentasPage() {
  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      workOrder: {
        include: { vehicle: { include: { client: true } } }
      },
      items: {
        include: { part: true }
      }
    }
  });

  return (
    <div className="animate-fade-in">
      <div className="header">
        <h1 className="header-title">Ventas de Repuestos</h1>
        <button className="btn btn-primary">
          <Plus size={20} /> Nueva Venta
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nº Venta</th>
                <th>Fecha</th>
                <th>Cliente / Orden</th>
                <th>Artículos</th>
                <th>Total Bruto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No hay ventas registradas.</td>
                </tr>
              ) : (
                sales.map((sale: any) => (
                  <tr key={sale.id}>
                    <td style={{ fontWeight: 600 }}>VEN-{sale.id.toString().padStart(5, '0')}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(sale.createdAt).toLocaleDateString()}</td>
                    <td>
                      {sale.workOrder 
                        ? `${sale.workOrder.vehicle.client.name} (Orden #${sale.workOrder.id})` 
                        : 'Venta Directa'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
                        {sale.items.map((item: any) => (
                          <div key={item.id}>
                            {item.quantity}x {item.part.name}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontWeight: 'bold' }}>${sale.total.toFixed(2)}</td>
                    <td>
                      <button className="btn" style={{ padding: '0.5rem', color: 'var(--text-muted)' }} title="Imprimir">
                        <Printer size={18} />
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
