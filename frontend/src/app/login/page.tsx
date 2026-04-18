"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL as API } from "@/config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }

      localStorage.setItem("usuario", JSON.stringify(data.usuario));
      document.cookie = `usuario=${encodeURIComponent(JSON.stringify(data.usuario))};path=/;max-age=86400`;

      const destinos: Record<string, string> = {
        gerente:    "/dashboard",
        secretaria: "/dashboard",
        tecnico:    "/ordenes",
        almacen:    "/inventario",
        cafeteria:  "/cafeteria",
      };
      router.push(destinos[data.usuario.rol] || "/dashboard");
    } catch {
      setError("Error de conexión con el servidor");
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-bg {
          min-height: 100vh;
          background: #080c14;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* Noise texture */
        .login-bg::before {
          content: '';
          position: fixed; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none; z-index: 0; opacity: .4;
        }

        /* Glow orbs */
        .login-bg::after {
          content: '';
          position: fixed;
          width: 500px; height: 500px; border-radius: 50%;
          background: radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%);
          top: -120px; left: 50%; transform: translateX(-50%);
          pointer-events: none; z-index: 0;
        }

        .login-orb-bottom {
          position: fixed;
          width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%);
          bottom: -100px; right: -100px;
          pointer-events: none; z-index: 0;
        }

        .login-card {
          background: rgba(15,23,42,0.9);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 24px;
          padding: 42px 36px;
          width: 100%;
          max-width: 420px;
          backdrop-filter: blur(16px);
          box-shadow: 0 30px 80px rgba(0,0,0,0.5);
          position: relative; z-index: 1;
          animation: fadeUp .45s ease both;
        }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }

        /* HEADER */
        .login-header { text-align: center; margin-bottom: 36px; }

        .login-icon-wrap {
          width: 88px; height: 88px; border-radius: 22px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 18px;
          box-shadow: 0 0 30px rgba(59,130,246,0.2);
          overflow: hidden;
        }

        .login-logo {
          width: 80px; height: 80px;
          object-fit: contain;
        }

        .login-title {
          font-family: 'Syne', sans-serif;
          font-size: 20px; font-weight: 800; letter-spacing: 1.5px;
          background: linear-gradient(135deg, #fff 30%, #93c5fd);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 8px;
        }

        .login-subtitle { font-size: 13px; color: #475569; line-height: 1.6; }

        /* DIVIDER */
        .login-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          margin-bottom: 28px;
        }

        /* FIELDS */
        .field-label {
          display: block;
          font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
          color: #64748b; margin-bottom: 8px;
        }

        .field-wrap { position: relative; margin-bottom: 18px; }

        .field-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          font-size: 16px; pointer-events: none;
        }

        .login-input {
          display: block; width: 100%;
          padding: 14px 14px 14px 44px;
          background: rgba(255,255,255,0.04);
          border: 1.5px solid rgba(255,255,255,0.09);
          border-radius: 12px;
          color: #e2e8f0;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 400;
          outline: none;
          transition: border-color .2s, box-shadow .2s;
        }
        .login-input::placeholder { color: #334155; }
        .login-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.12);
        }

        /* ERROR */
        .login-error {
          background: rgba(220,38,38,0.1);
          border: 1px solid rgba(220,38,38,0.25);
          color: #fca5a5;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px; font-weight: 500;
          margin-bottom: 18px;
        }

        /* SUBMIT */
        .btn-login {
          width: 100%; padding: 16px;
          background: linear-gradient(135deg, #1d4ed8, #3b82f6);
          color: #fff; border: none; border-radius: 14px;
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 800; letter-spacing: .5px;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(59,130,246,0.35);
          transition: opacity .2s, transform .15s;
        }
        .btn-login:disabled { opacity: .45; cursor: not-allowed; }
        .btn-login:not(:disabled):active { transform: scale(.98); }

        /* LOADER dots */
        .btn-login .dots::after {
          content: '';
          animation: dots 1.2s steps(3, end) infinite;
        }
        @keyframes dots {
          0%   { content: '.'; }
          33%  { content: '..'; }
          66%  { content: '...'; }
        }

        /* FOOTER */
        .login-footer { text-align: center; font-size: 12px; color: #1e293b; margin-top: 24px; }
      `}</style>

      <div className="login-bg">
        <div className="login-orb-bottom" />

        <div className="login-card">

          {/* HEADER */}
          <div className="login-header">
            <div className="login-icon-wrap">
              <img src="https://crm-solido.vercel.app/logo.png" />
            </div>
            <div className="login-title">SÓLIDO AUTO SERVICIO</div>
            <p className="login-subtitle">Sistema de Gestión — Inicia sesión para continuar</p>
          </div>

          <div className="login-divider" />

          {/* FORM */}
          <form onSubmit={handleLogin}>
            <label className="field-label">Correo electrónico</label>
            <div className="field-wrap">
              <span className="field-icon">✉️</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@solidoauto.com"
                required
                className="login-input"
              />
            </div>

            <label className="field-label">Contraseña</label>
            <div className="field-wrap">
              <span className="field-icon">🔒</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="login-input"
              />
            </div>

            {error && (
              <div className="login-error">⚠️ {error}</div>
            )}

            <button type="submit" disabled={loading} className="btn-login">
              {loading ? "Verificando" : "Ingresar al Sistema"}
              {loading && <span className="dots" />}
            </button>
          </form>

          <p className="login-footer">Tel: 809-712-2027 · Santo Domingo, RD</p>
        </div>
      </div>
    </>
  );
}
