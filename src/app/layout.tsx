import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Settings, Users, Car, Wrench, Package, FileText, Home, Truck, ShoppingCart } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Sólido Auto Servicio - CRM',
  description: 'CRM Automotriz MVP',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <div className="app-container">
          <aside className="sidebar">
            <div className="brand">Sólido Auto</div>
            <nav className="sidebar-nav">
              <Link href="/" className="nav-item">
                <Home size={20} />
                <span>Dashboard</span>
              </Link>
              <Link href="/clientes" className="nav-item">
                <Users size={20} />
                <span>Clientes</span>
              </Link>
              <Link href="/vehiculos" className="nav-item">
                <Car size={20} />
                <span>Vehículos</span>
              </Link>
              <Link href="/ordenes" className="nav-item">
                <Wrench size={20} />
                <span>Órdenes de Trabajo</span>
              </Link>
              <Link href="/inventario" className="nav-item">
                <Package size={20} />
                <span>Inventario</span>
              </Link>
              <Link href="/facturas" className="nav-item">
                <FileText size={20} />
                <span>Facturación</span>
              </Link>
              <Link href="/suplidores" className="nav-item">
                <Truck size={20} />
                <span>Suplidores</span>
              </Link>
              <Link href="/ventas" className="nav-item">
                <ShoppingCart size={20} />
                <span>Ventas</span>
              </Link>
            </nav>
            <div style={{ marginTop: 'auto' }}>
              <div className="nav-item" style={{ cursor: 'pointer' }}>
                <Settings size={20} />
                <span>Configuración</span>
              </div>
            </div>
          </aside>
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
