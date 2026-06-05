import { useState } from "react";
import { ALLOWED_EMAIL, checkCredentials } from "../lib/auth";

const C = {
  bg: "#F0F3F9",
  white: "#FFFFFF",
  ink: "#0A1628",
  ink2: "#2A3A55",
  ink3: "#7A8EAA",
  navy: "#0055A5",
  orange: "#EC5A24",
  border: "#C8D4E8",
  red: "#C0392B",
  redBg: "#FDECEA",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 16, // 16px evita zoom automático no iOS
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.ink,
  background: C.white,
  outline: "none",
};

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkCredentials(email, password)) {
      setError("");
      onSuccess();
    } else {
      setError("E-mail ou senha inválidos.");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans',system-ui,sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <form onSubmit={submit} style={{
        width: "100%", maxWidth: 400, background: C.white, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: "32px 28px", boxShadow: "0 8px 32px rgba(10,22,40,.08)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.orange }}>
          HUB SENAI · Acesso
        </div>
        <h1 style={{ margin: "8px 0 4px", fontSize: 24, color: C.ink }}>Entrar</h1>
        <p style={{ fontSize: 13, color: C.ink3, margin: "0 0 22px" }}>
          Geração de Visitas Técnicas — acesso restrito.
        </p>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.ink2, marginBottom: 6 }}>
          E-mail
        </label>
        <input
          type="email" autoComplete="username" inputMode="email" autoCapitalize="none"
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={ALLOWED_EMAIL} style={{ ...inputStyle, marginBottom: 16 }}
        />

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.ink2, marginBottom: 6 }}>
          Senha
        </label>
        <input
          type="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••" style={{ ...inputStyle, marginBottom: error ? 12 : 22 }}
        />

        {error && (
          <div style={{
            background: C.redBg, border: `1px solid ${C.red}`, color: C.red,
            borderRadius: 8, padding: "8px 12px", fontSize: 13, margin: "0 0 18px",
          }}>
            {error}
          </div>
        )}

        <button type="submit" style={{
          width: "100%", background: C.orange, color: "#fff", border: "none",
          borderRadius: 8, padding: "13px 16px", fontSize: 15, fontWeight: 700,
          cursor: "pointer",
        }}>
          Entrar
        </button>
      </form>
    </div>
  );
}
