"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL as API } from "@/config";

// ─────────────────────────────────────────────────────────────────────────────
// 🌺 ALOHA PERFUME STORE — Puerta de entrada propia
//
// Misma app, misma base de usuarios, mismo endpoint /auth/login. Lo único que
// cambia es que el personal de la tienda no pasa nunca por la pantalla azul de
// Sólido Auto Servicio: abre /aloha/login y ve su marca.
//
// La separación real no la hace esta página, la hace el middleware: aunque
// alguien con rol "aloha" escriba a mano /facturacion, lo devuelve a /aloha.
// Esta pantalla es la cara visible de esa regla.
// ─────────────────────────────────────────────────────────────────────────────

// Paleta idéntica a la del módulo (app/aloha/page.tsx). Está duplicada a
// propósito y no importada: esta página se renderiza antes de que exista
// sesión, y no debe arrastrar nada del módulo ni del CRM.
const C = {
  bg:          "#fdf2f8",
  card:        "#ffffff",
  border:      "#fbcfe8",
  primary:     "#ec4899",
  primaryD:    "#db2777",
  primarySoft: "#fce7f3",
  text:        "#831843",
  sub:         "#9d5c7d",
};

// Quién puede entrar por esta puerta. El gerente sigue incluido porque a veces
// necesita revisar la tienda desde el mostrador, sin ir al CRM completo.
const ROLES_PERMITIDOS = ["aloha", "gerente"];

export default function AlohaLoginPage() {
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

      const rol = String(data.usuario?.rol || "").toLowerCase();

      // Credenciales buenas pero de otro puesto (secretaria, técnico, etc.).
      // No se abre sesión aquí: se le indica su entrada. Si se dejara pasar,
      // el middleware lo sacaría de todos modos y parecería un error del
      // sistema en lugar de una puerta equivocada.
      if (!ROLES_PERMITIDOS.includes(rol)) {
        setError(
          "Esta entrada es solo para el personal de Aloha. " +
          "Tu usuario pertenece al sistema de Sólido Auto Servicio."
        );
        return;
      }

      localStorage.setItem("usuario", JSON.stringify(data.usuario));
      document.cookie = `usuario=${encodeURIComponent(JSON.stringify(data.usuario))};path=/;max-age=86400;SameSite=Lax`;
      router.push("/aloha");
    } catch {
      setError("Error de conexión con el servidor");
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        .al-bg {
          min-height: 100vh;
          background:
            radial-gradient(circle at 15% 10%, #fce7f3 0%, transparent 45%),
            radial-gradient(circle at 85% 85%, #fbcfe8 0%, transparent 40%),
            ${C.bg};
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          font-family: 'DM Sans', sans-serif;
        }

        .al-card {
          background: ${C.card};
          border: 1px solid ${C.border};
          border-radius: 26px;
          padding: 42px 36px;
          width: 100%; max-width: 410px;
          box-shadow: 0 24px 60px rgba(236,72,153,0.13);
          animation: alUp .45s ease both;
        }
        @keyframes alUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .al-header { text-align: center; margin-bottom: 32px; }

        .al-logo-wrap {
          width: 96px; height: 96px; border-radius: 50%;
          background: ${C.primarySoft};
          border: 1px solid ${C.border};
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 18px; overflow: hidden;
          box-shadow: 0 8px 24px rgba(236,72,153,0.18);
        }
        .al-logo { width: 86px; height: 86px; object-fit: contain; }
        .al-logo-alt { font-size: 40px; }

        .al-title {
          font-family: 'Playfair Display', serif;
          font-size: 23px; font-weight: 700; letter-spacing: .5px;
          color: ${C.text}; margin-bottom: 7px;
        }
        .al-sub { font-size: 13px; color: ${C.sub}; line-height: 1.6; }

        .al-divider {
          height: 1px; margin-bottom: 26px;
          background: linear-gradient(90deg, transparent, ${C.border}, transparent);
        }

        .al-label {
          display: block; font-size: 11px; font-weight: 700;
          letter-spacing: 1px; text-transform: uppercase;
          color: ${C.sub}; margin-bottom: 8px;
        }
        .al-field { position: relative; margin-bottom: 18px; }
        .al-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          font-size: 15px; pointer-events: none;
        }
        .al-input {
          display: block; width: 100%;
          padding: 14px 14px 14px 42px;
          background: #fffafc;
          border: 1.5px solid ${C.border};
          border-radius: 13px;
          color: ${C.text};
          font-family: 'DM Sans', sans-serif; font-size: 14px;
          outline: none; transition: border-color .2s, box-shadow .2s;
        }
        .al-input::placeholder { color: #d8a9c2; }
        .al-input:focus {
          border-color: ${C.primary};
          box-shadow: 0 0 0 4px rgba(236,72,153,0.11);
        }

        .al-error {
          background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
          padding: 12px 15px; border-radius: 12px;
          font-size: 13px; font-weight: 500; line-height: 1.5;
          margin-bottom: 18px;
        }

        .al-btn {
          width: 100%; padding: 16px;
          background: linear-gradient(135deg, ${C.primaryD}, ${C.primary});
          color: #fff; border: none; border-radius: 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 700; letter-spacing: .3px;
          cursor: pointer;
          box-shadow: 0 8px 22px rgba(236,72,153,0.32);
          transition: opacity .2s, transform .15s;
        }
        .al-btn:disabled { opacity: .5; cursor: not-allowed; }
        .al-btn:not(:disabled):active { transform: scale(.985); }
        .al-btn .dots::after { content: ''; animation: alDots 1.2s steps(3, end) infinite; }
        @keyframes alDots { 0% { content:'.'; } 33% { content:'..'; } 66% { content:'...'; } }

        .al-footer {
          text-align: center; font-size: 12px; color: ${C.sub};
          margin-top: 24px; line-height: 1.7;
        }
        .al-footer a { color: ${C.primary}; text-decoration: none; font-weight: 600; }
      `}</style>

      <div className="al-bg">
        <div className="al-card">

          <div className="al-header">
            <div className="al-logo-wrap">
              {/* Si el logo no está en /public, cae al emoji y la pantalla
                  sigue viéndose entera en vez de mostrar la imagen rota. */}
              <img
                src="/logo-aloha.png"
                alt="Aloha Perfume Store"
                className="al-logo"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = "none";
                  const alt = document.createElement("span");
                  alt.className = "al-logo-alt";
                  alt.textContent = "🌺";
                  img.parentElement?.appendChild(alt);
                }}
              />
            </div>
            <div className="al-title">ALOHA PERFUME STORE</div>
            <p className="al-sub">Acceso al sistema de la tienda</p>
          </div>

          <div className="al-divider" />

          <form onSubmit={handleLogin}>
            <label className="al-label">Correo electrónico</label>
            <div className="al-field">
              <span className="al-icon">✉️</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@aloha.com"
                required
                autoComplete="email"
                className="al-input"
              />
            </div>

            <label className="al-label">Contraseña</label>
            <div className="al-field">
              <span className="al-icon">🔒</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="al-input"
              />
            </div>

            {error && <div className="al-error">⚠️ {error}</div>}

            <button type="submit" disabled={loading} className="al-btn">
              {loading ? "Verificando" : "Entrar a la tienda"}
              {loading && <span className="dots" />}
            </button>
          </form>

          <p className="al-footer">
            829-393-3673 · @alohaperfumes_store<br />
            ¿Eres del taller? <a href="/login">Entra por aquí</a>
          </p>
        </div>
      </div>
    </>
  );
}
