import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { PackageSearch, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function InventarioPage() {
  const parts = await prisma.part.findMany({
    orderBy: { stock: 'asc' },
    include: {
      supplier: true
    }
  });

  return (
    <div className="animate-fade-in">
      <div className="header">
        <h1 className="header-title">Inventario de Repuestos</h1>
        <button className="btn btn-primary">
          <Plus size={20} /> Nuevo Repuesto
        </button>
      </div>

      <div className="grid grid-cols-3" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <h3 style={{ color: 'var(--text-muted)' }}>Total Referencias</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{parts.length}</p>
        </div>
        <div className="card" style={{ borderColor: 'var(--status-red)' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>Bajo Stock</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--status-red)' }}>
            {parts.filter(p => p.stock < 5).length}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Código / Nombre</th>
                <th>Stock Actual</th>
                <th>Precio Unitario</th>
                <th>Suplidor Principal</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {parts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>No hay repuestos registrados en el inventario.</td>
                </tr>
              ) : (
                parts.map(part => (
                  <tr key={part.id}>
                    <td style={{ fontWeight: 600 }}>{part.name}</td>
                    <td>
                      <span className={`badge ${part.stock > 10 ? 'badge-green' : (part.stock > 0 ? 'badge-yellow' : 'badge-red')}`}>
                        {part.stock} ud.
                      </span>
                    </td>
                    <td>${part.price.toFixed(2)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{part.supplier?.name || 'N/A'}</td>
                    <td>
                      <button className="btn" style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--surface-hover)', fontSize: '0.75rem' }}>
                        Ajustar Stock
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
