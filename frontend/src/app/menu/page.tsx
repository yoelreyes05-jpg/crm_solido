"use client";
import { useState, useEffect, useMemo } from "react";
import { API_URL as API } from "@/config";

export default function MenuPublicoPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [catActiva, setCatActiva] = useState<string>("TODOS");

  useEffect(() => {
    fetch(`${API}/cafeteria/productos`)
      .then(r => r.json())
      .then(d => {
        const activos = (Array.isArray(d) ? d : []).filter((p: any) => p.stock > 0);
        setProductos(activos);
      })
      .catch(() => setProductos([]))
      .finally(() => setLoading(false));
  }, []);

  const categorias = useMemo(() => {
    const cats = Array.from(new Set(productos.map((p: any) => p.categoria || "General"))) as string[];
    return cats.sort();
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    if (catActiva === "TODOS") return productos;
    return productos.filter((p: any) => (p.categoria || "General") === catActiva);
  }, [productos, catActiva]);

  return (
    <div style={styles.outer}>

      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <img
            src="/logo.png"
            alt="Logo"
            style={styles.logo}
            onError={(e: any) => { e.target.style.display = "none"; }}
          />
          <div>
            <h1 style={styles.titulo}>SÓLIDO CAFE GARAGE</h1>
            <p style={styles.subtitulo}>Menú del día</p>
          </div>
        </div>
        <a
          href="https://wa.me/18097122027"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.waBtn}
        >
          <span style={{ fontSize: 18 }}>💬</span> Ordenar por WhatsApp
        </a>
      </div>

      {/* CATEGORÍAS */}
      {!loading && categorias.length > 0 && (
        <div style={styles.catBar}>
          <div style={styles.catScroll}>
            <button
              onClick={() => setCatActiva("TODOS")}
              style={{ ...styles.catPill, ...(catActiva === "TODOS" ? styles.catPillActive : {}) }}
            >
              🍽️ Todo el Menú
            </button>
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => setCatActiva(cat)}
                style={{ ...styles.catPill, ...(catActiva === cat ? styles.catPillActive : {}) }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CONTENIDO */}
      <div style={styles.body}>

        {loading && (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p style={{ color: "#9ca3af", marginTop: 16, fontSize: 14 }}>Cargando menú...</p>
          </div>
        )}

        {!loading && productos.length === 0 && (
          <div style={styles.emptyWrap}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>☕</div>
            <p style={{ color: "#9ca3af", fontSize: 16, fontWeight: 600 }}>El menú no está disponible en este momento</p>
            <a href="https://wa.me/18097122027" style={styles.waLink}>
              💬 Consultar disponibilidad
            </a>
          </div>
        )}

        {!loading && productosFiltrados.length > 0 && (
          <>
            {/* Si hay sección activa, muestra sólo esa; si es TODOS, agrupa por categoría */}
            {catActiva !== "TODOS" ? (
              <div style={styles.grid}>
                {productosFiltrados.map((p: any) => (
                  <ProductoCard key={p.id} producto={p} />
                ))}
              </div>
            ) : (
              categorias.map(cat => {
                const items = productos.filter((p: any) => (p.categoria || "General") === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} style={styles.seccion}>
                    <div style={styles.seccionTitle}>
                      <span style={styles.seccionDot} />
                      {cat}
                    </div>
                    <div style={styles.grid}>
                      {items.map((p: any) => (
                        <ProductoCard key={p.id} producto={p} />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* FOOTER */}
      <div style={styles.footer}>
        <div style={styles.footerBrand}>SÓLIDO AUTO SERVICIO</div>
        <div style={styles.footerInfo}>
          <a href="tel:8097122027" style={styles.footerLink}>📞 809-712-2027</a>
          <span style={{ color: "#374151" }}>·</span>
          <span style={{ color: "#6b7280" }}>Santo Domingo, RD</span>
        </div>
        <a
          href="https://wa.me/18097122027"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.footerWa}
        >
          💬 Chatearnos en WhatsApp
        </a>
      </div>
    </div>
  );
}

// ─── Tarjeta de producto ──────────────────────────────────────────
function ProductoCard({ producto }: { producto: any }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div style={styles.card}>
      {producto.imagen && !imgError ? (
        <div style={styles.cardImgWrap}>
          <img
            src={producto.imagen}
            alt={producto.nombre}
            style={styles.cardImg}
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div style={styles.cardImgPlaceholder}>
          <span style={{ fontSize: 32 }}>☕</span>
        </div>
      )}
      <div style={styles.cardBody}>
        <div style={styles.cardNombre}>{producto.nombre}</div>
        {producto.descripcion && (
          <div style={styles.cardDesc}>{producto.descripcion}</div>
        )}
        <div style={styles.cardPrecio}>
          RD$ {Number(producto.precio).toLocaleString("es-DO", { minimumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────
const styles: Record<string, any> = {
  outer: {
    minHeight: "100vh",
    background: "#0f172a",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    paddingBottom: 32,
  },
  header: {
    background: "linear-gradient(135deg, #1e293b 0%, #111827 100%)",
    borderBottom: "1px solid rgba(249,115,22,0.3)",
    padding: "24px 20px 20px",
    position: "sticky" as const,
    top: 0,
    zIndex: 10,
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    objectFit: "contain" as const,
    background: "rgba(255,255,255,0.08)",
    padding: 4,
    border: "1.5px solid rgba(249,115,22,0.35)",
  },
  titulo: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    color: "#fff",
    letterSpacing: 0.5,
  },
  subtitulo: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "#f97316",
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  waBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "#16a34a",
    color: "#fff",
    textDecoration: "none",
    borderRadius: 12,
    padding: "10px 18px",
    fontWeight: 700,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box" as const,
    boxShadow: "0 4px 14px rgba(22,163,74,0.35)",
  },
  catBar: {
    background: "#1e293b",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    padding: "10px 0",
    overflowX: "auto" as const,
  },
  catScroll: {
    display: "flex",
    gap: 8,
    padding: "0 16px",
    width: "max-content",
  },
  catPill: {
    padding: "7px 16px",
    borderRadius: 20,
    border: "1.5px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    transition: "all 0.15s",
  },
  catPillActive: {
    background: "#f97316",
    color: "#fff",
    border: "1.5px solid #f97316",
  },
  body: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "20px 14px 0",
  },
  loadingWrap: {
    textAlign: "center" as const,
    paddingTop: 80,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "4px solid rgba(255,255,255,0.1)",
    borderTop: "4px solid #f97316",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  emptyWrap: {
    textAlign: "center" as const,
    paddingTop: 80,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 8,
  },
  waLink: {
    marginTop: 12,
    display: "inline-block",
    background: "#16a34a",
    color: "#fff",
    textDecoration: "none",
    padding: "12px 24px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 15,
  },
  seccion: {
    marginBottom: 28,
  },
  seccionTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 16,
    fontWeight: 800,
    color: "#f97316",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(249,115,22,0.2)",
  },
  seccionDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#f97316",
    display: "inline-block",
    flexShrink: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },
  card: {
    background: "#1e293b",
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.07)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    display: "flex",
    flexDirection: "column" as const,
  },
  cardImgWrap: {
    width: "100%",
    aspectRatio: "1 / 1",
    overflow: "hidden",
    background: "#111827",
  },
  cardImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  },
  cardImgPlaceholder: {
    width: "100%",
    aspectRatio: "1 / 1",
    background: "linear-gradient(135deg,#1f2937,#111827)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    padding: "10px 12px 12px",
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  cardNombre: {
    fontWeight: 700,
    fontSize: 14,
    color: "#f1f5f9",
    lineHeight: 1.3,
  },
  cardDesc: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.4,
  },
  cardPrecio: {
    marginTop: "auto",
    paddingTop: 6,
    fontWeight: 800,
    fontSize: 15,
    color: "#f97316",
  },
  footer: {
    marginTop: 40,
    padding: "24px 20px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    textAlign: "center" as const,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 8,
  },
  footerBrand: {
    fontWeight: 900,
    fontSize: 13,
    color: "#f1f5f9",
    letterSpacing: 1,
  },
  footerInfo: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    fontSize: 13,
  },
  footerLink: {
    color: "#60a5fa",
    textDecoration: "none",
    fontWeight: 600,
  },
  footerWa: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(22,163,74,0.15)",
    border: "1px solid rgba(22,163,74,0.3)",
    color: "#4ade80",
    textDecoration: "none",
    padding: "10px 20px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    marginTop: 4,
  },
};
