"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "https://crm-automotriz-3wde-production.up.railway.app";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }

     // Reemplaza la línea de localStorage en handleLogin:
localStorage.setItem("usuario", JSON.stringify(data.usuario));
document.cookie = `usuario=${encodeURIComponent(JSON.stringify(data.usuario))};path=/;max-age=86400`;
      // Redirigir según rol
      const destinos = {
        gerente: "/dashboard",
        secretaria: "/dashboard",
        tecnico: "/ordenes",
        almacen: "/inventario",
        cafeteria: "/cafeteria"
      };
      router.push(destinos[data.usuario.rol] || "/dashboard");
    } catch {
      setError("Error de conexión con el servidor");
    } finally { setLoading(false); }
  };

  return (
    <div style={bg}>
      <div style={box}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔧</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>SÓLIDO AUTO SERVICIO</h1>
          <p style={{ color: "#888", fontSize: 13, marginTop: 6 }}>Sistema de Gestión — Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleLogin}>
          <label style={label}>Correo electrónico</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="usuario@solidoauto.com" required style={input} />

          <label style={label}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required style={input} />

          {error && (
            <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
              ❌ {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={btnLogin}>
            {loading ? "Verificando..." : "Ingresar al Sistema"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 11, color: "#aaa", marginTop: 20 }}>
          Tel: 809-712-2027 · Santo Domingo, RD
        </p>
      </div>
    </div>
  );
}

const bg: React.CSSProperties = { minHeight: "100vh", background: "linear-gradient(135deg,#111827 0%,#1f2937 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 };
const box: React.CSSProperties = { background: "#fff", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 420, boxShadow: "0 25px 60px rgba(0,0,0,0.4)" };
const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#555" };
const input: React.CSSProperties = { display: "block", marginBottom: 16, padding: "13px 14px", width: "100%", borderRadius: 10, border: "1px solid #e2e8f0", boxSizing: "border-box", fontSize: 14 };
const btnLogin: React.CSSProperties = { padding: "14px", background: "#111827", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", width: "100%", fontSize: 15, fontWeight: 700 };