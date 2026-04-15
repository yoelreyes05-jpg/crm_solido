"use client";
import { useEffect, useState } from "react";

export default function POS() {
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]);

  const API = "http://127.0.0.1:4000";

  // 🔄 Obtener productos
  const obtenerProductos = async () => {
    try {
      const res = await fetch(`${API}/cafeteria/productos`);
      const data = await res.json();
      setProductos(data);
    } catch (error) {
      console.error("Error cargando productos:", error);
      setProductos([]);
    }
  };

  useEffect(() => {
    obtenerProductos();
  }, []);

  // ➕ Agregar al carrito
  const agregarProducto = (producto) => {
    if (producto.stock <= 0) {
      alert("❌ Sin stock");
      return;
    }

    const existe = carrito.find((p) => p.id === producto.id);

    if (existe) {
      setCarrito(
        carrito.map((p) =>
          p.id === producto.id
            ? { ...p, cantidad: p.cantidad + 1 }
            : p
        )
      );
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    }
  };

  // ❌ Eliminar producto
  const eliminarProducto = (id) => {
    setCarrito(carrito.filter((p) => p.id !== id));
  };

  // 💰 Total
  const total = carrito.reduce(
    (acc, p) => acc + p.precio * p.cantidad,
    0
  );

  // 🖨️ IMPRIMIR FACTURA
  const imprimirFactura = () => {
    const contenido = document.getElementById("factura").innerHTML;

    const ventana = window.open("", "", "width=400,height=600");

    ventana.document.write(`
      <html>
        <head>
          <title>Factura</title>
          <style>
            body { font-family: Arial; padding: 10px; }
            h2 { text-align: center; }
            .item { display: flex; justify-content: space-between; }
            hr { margin: 10px 0; }
          </style>
        </head>
        <body>
          ${contenido}
          <script>
            window.print();
          </script>
        </body>
      </html>
    `);

    ventana.document.close();
  };

  // 💳 COBRAR
  const cobrar = async () => {
    if (carrito.length === 0) {
      alert("No hay productos");
      return;
    }

    try {
     const res = await fetch(`${API}/cafeteria/ventas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productos: carrito,
          metodo_pago: "efectivo",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("✅ Venta realizada");
        imprimirFactura(); // 🔥 imprime automáticamente
        setCarrito([]);
        obtenerProductos(); // 🔄 refresca stock
      } else {
        alert("❌ Error en la venta");
        console.error(data);
      }

    } catch (error) {
      console.error("Error:", error);
      alert("Error de conexión con el servidor");
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>

      {/* 🥤 PRODUCTOS */}
      <div style={{ flex: 2, padding: "20px" }}>
        <h2>Menú ☕</h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "10px"
        }}>
          {productos.map((p) => (
            <button
              key={p.id}
              onClick={() => agregarProducto(p)}
              style={{
                padding: "20px",
                borderRadius: "10px",
                cursor: "pointer"
              }}
            >
              {p.nombre}
              <br />
              RD${p.precio}
              <br />
              Stock: {p.stock}
            </button>
          ))}
        </div>
      </div>

      {/* 🧾 CARRITO */}
      <div style={{ flex: 1, padding: "20px", background: "#f5f5f5" }}>
        <h2>Carrito 🛒</h2>

        {carrito.length === 0 ? (
          <p>No hay productos</p>
        ) : (
          carrito.map((p) => (
            <div key={p.id}>
              {p.nombre} x{p.cantidad} - RD${p.precio * p.cantidad}
              <button onClick={() => eliminarProducto(p.id)}>❌</button>
            </div>
          ))
        )}

        {/* 🧾 FACTURA */}
        <div id="factura" style={{ marginTop: "20px" }}>
          <h2 style={{ textAlign: "center" }}>Sólido Auto Café ☕</h2>

          {carrito.map((p) => (
            <div
              key={p.id}
              className="item"
              style={{
                display: "flex",
                justifyContent: "space-between"
              }}
            >
              <span>{p.nombre} x{p.cantidad}</span>
              <span>RD${p.precio * p.cantidad}</span>
            </div>
          ))}

          <hr />

          <h3 style={{ textAlign: "right" }}>
            Total: RD${total}
          </h3>
        </div>

        <hr />

        <h3>Total: RD${total}</h3>

        <button
          onClick={cobrar}
          style={{
            width: "100%",
            padding: "15px",
            fontSize: "18px",
            background: "green",
            color: "white",
            border: "none",
            borderRadius: "10px",
            marginBottom: "10px"
          }}
        >
          💳 COBRAR
        </button>

        <button
          onClick={imprimirFactura}
          style={{
            width: "100%",
            padding: "10px",
            background: "gray",
            color: "white",
            border: "none",
            borderRadius: "10px"
          }}
        >
          🖨️ Imprimir Factura
        </button>

      </div>
    </div>
  );
}