'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Modal from '@/components/Modal';
import { showToast } from '@/components/Toast';
import jsPDF from 'jspdf';

interface Part {
  id: number;
  name: string;
  price: number;
  stock: number;
}

interface Cliente {
  id: number;
  nombre: string;
}

interface Sale {
  id: number;
  total: number;
  method: string;
  customer_name: string;
  ncf: string;
  ncf_tipo: string;
  created_at: string;
}

interface CartItem {
  partId: number;
  name: string;
  price: number;
  quantity: number;
  maxStock: number;
}

export default function VentasPage() {

  const [sales, setSales] = useState<Sale[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [customer, setCustomer] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [method, setMethod] = useState('EFECTIVO');
  const [ncfTipo, setNcfTipo] = useState('B02');

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // ================= FETCH =================
  const fetchData = async () => {
    try {
      const [sRes, pRes, cRes] = await Promise.all([
        fetch('http://localhost:4000/ventas'),
        fetch('http://localhost:4000/inventario'),
        fetch('http://localhost:4000/clientes')
      ]);

      setSales(await sRes.json());
      setParts(await pRes.json());
      setClientes(await cRes.json());

    } catch {
      showToast('Error al cargar datos', 'error');
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ================= CARRITO =================
  const addToCart = (part: Part) => {
    if (part.stock <= 0) return showToast('Sin stock disponible', 'warning');

    const exist = cart.find(c => c.partId === part.id);

    if (exist) {
      if (exist.quantity >= part.stock) {
        return showToast('Stock insuficiente', 'warning');
      }

      setCart(cart.map(c =>
        c.partId === part.id
          ? { ...c, quantity: c.quantity + 1 }
          : c
      ));
    } else {
      setCart([...cart, {
        partId: part.id,
        name: part.name,
        price: part.price,
        quantity: 1,
        maxStock: part.stock
      }]);
    }
  };

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter(c => c.partId !== id));
      return;
    }

    setCart(cart.map(c =>
      c.partId === id
        ? { ...c, quantity: Math.min(qty, c.maxStock) }
        : c
    ));
  };

  // ================= CALCULOS =================
  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const itbis = subtotal * 0.18;
  const total = subtotal + itbis;

  // ================= PDF =================
  const generarPDF = (ventaId: number) => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("FACTURA", 90, 20);

    doc.setFontSize(10);
    doc.text(`Factura #: FAC-${ventaId}`, 10, 40);
    doc.text(`Cliente: ${customer || 'Consumidor Final'}`, 10, 50);
    doc.text(`NCF: ${ncfTipo}`, 10, 60);

    let y = 80;

    cart.forEach(item => {
      doc.text(
        `${item.name} x${item.quantity} - RD$ ${(item.price * item.quantity).toFixed(2)}`,
        10,
        y
      );
      y += 10;
    });

    doc.text(`Subtotal: RD$ ${subtotal.toFixed(2)}`, 10, y + 10);
    doc.text(`ITBIS: RD$ ${itbis.toFixed(2)}`, 10, y + 20);
    doc.text(`TOTAL: RD$ ${total.toFixed(2)}`, 10, y + 30);

    doc.save(`factura-${ventaId}.pdf`);
  };

  // ================= VENTA =================
  const processSale = async () => {
    if (cart.length === 0) return showToast('Agrega productos', 'warning');

    setSaving(true);

    try {
      const res = await fetch('http://localhost:4000/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(c => ({
            partId: c.partId,
            quantity: c.quantity
          })),
          method,
          customer_name: customer || 'Consumidor Final',
          ncf_tipo: ncfTipo
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      showToast('Venta realizada correctamente', 'success');

      // 🔥 PDF AUTOMÁTICO
      generarPDF(data.id);

      setCart([]);
      setCustomer('');
      setClienteId('');
      setModalOpen(false);

      fetchData();

    } catch (err: any) {
      showToast(err.message, 'error');
    }

    setSaving(false);
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gray-100 p-4">

      <div className="w-full max-w-6xl bg-white shadow-xl rounded-2xl p-6">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">💰 POS PRO SYSTEM</h1>

          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={18} /> Nueva Venta
          </button>
        </div>

        {/* TABLA */}
        <div className="border rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2">Factura</th>
                <th>NCF</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Fecha</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-3">Cargando...</td></tr>
              ) : sales.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="p-2">FAC-{s.id.toString().padStart(5, '0')}</td>
                  <td>{s.ncf} ({s.ncf_tipo})</td>
                  <td>{s.customer_name}</td>
                  <td>RD$ {Number(s.total).toFixed(2)}</td>
                  <td>{new Date(s.created_at).toLocaleDateString('es-DO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MODAL */}
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="🧾 Nueva Venta">

          {/* CLIENTE */}
          <select
            className="w-full p-2 border rounded mb-2"
            value={clienteId}
            onChange={(e) => {
              setClienteId(e.target.value);
              const selected = clientes.find(c => c.id == Number(e.target.value));
              setCustomer(selected?.nombre || '');
            }}
          >
            <option value="">Consumidor Final</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          {/* NCF */}
          <select
            className="w-full p-2 border rounded mb-3"
            value={ncfTipo}
            onChange={(e) => setNcfTipo(e.target.value)}
          >
            <option value="B02">Consumidor Final</option>
            <option value="B01">Crédito Fiscal</option>
            <option value="B15">Gubernamental</option>
          </select>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* PRODUCTOS */}
            <div className="border rounded-lg p-3 max-h-[300px] overflow-y-auto">
              <h3 className="font-bold mb-2">📦 Productos</h3>

              {parts.filter(p => p.stock > 0).map(p => (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="p-2 border rounded mb-2 cursor-pointer hover:bg-gray-100"
                >
                  {p.name} - RD$ {p.price}
                </div>
              ))}
            </div>

            {/* CARRITO */}
            <div className="border rounded-lg p-3">
              <h3 className="font-bold mb-2">🛒 Carrito</h3>

              {cart.map(item => (
                <div key={item.partId} className="flex justify-between mb-2">
                  <span>{item.name}</span>

                  <div className="flex gap-2 items-center">
                    <button onClick={() => updateQty(item.partId, item.quantity - 1)}>➖</button>
                    {item.quantity}
                    <button onClick={() => updateQty(item.partId, item.quantity + 1)}>➕</button>
                  </div>
                </div>
              ))}

              {/* TOTAL */}
              <div className="mt-4 p-3 bg-gray-50 rounded">
                <div>Subtotal: RD$ {subtotal.toFixed(2)}</div>
                <div>ITBIS: RD$ {itbis.toFixed(2)}</div>
                <div className="text-lg font-bold">
                  Total: RD$ {total.toFixed(2)}
                </div>
              </div>

              {/* COBRAR */}
              <button
                onClick={processSale}
                disabled={saving}
                className="w-full mt-3 bg-green-600 text-white p-3 rounded-lg hover:bg-green-700"
              >
                {saving ? "Procesando..." : `💵 Cobrar RD$ ${total.toFixed(2)}`}
              </button>

            </div>

          </div>

        </Modal>

      </div>
    </div>
  );
}