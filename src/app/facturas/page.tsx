import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { FileText, Printer } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function FacturasPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      workOrder: {
        include: { vehicle: { include: { client: true } } }
      }
    }
  });

  return (
    <div className="animate-fade-in">
      <div className="header">
        <h1 className="header-title">Facturación e Historial</h1>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nº Factura</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Nº Orden</th>
                <th>Método Pago</th>
                <th>Total Bruto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>No hay facturas emitidas.</td>
                </tr>
              ) : (
                invoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td style={{ fontWeight: 600 }}>FAC-{invoice.id.toString().padStart(5, '0')}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(invoice.createdAt).toLocaleDateString()}</td>
                    <td>{invoice.workOrder?.vehicle.client.name || 'Venta Directa'}</td>
                    <td>{invoice.workOrder ? `#${invoice.workOrder.id.toString().padStart(4, '0')}` : 'N/A'}</td>
                    <td>
                      <span className="badge badge-blue">
                        {invoice.method}
                      </span>
                    </td>
                    <td style={{ fontWeight: 'bold' }}>${invoice.total.toFixed(2)}</td>
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
