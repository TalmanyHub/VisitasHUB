const C = {
  bg: "#F0F3F9",
  bg2: "#E4EAF4",
  white: "#FFFFFF",
  ink: "#0A1628",
  ink2: "#2A3A55",
  navy: "#0055A5",
  orange: "#EC5A24",
  border: "#C8D4E8",
};

export default function SupabaseSetup() {
  return (
    <div style={{
      minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans',system-ui,sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        maxWidth: 520, background: C.white, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: "28px 32px", boxShadow: "0 8px 32px rgba(10,22,40,.08)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: C.orange }}>
          HUB SENAI · Configuração
        </div>
        <h1 style={{ margin: "8px 0 12px", fontSize: 22, color: C.ink }}>Conectar ao Supabase</h1>
        <p style={{ fontSize: 14, color: C.ink2, lineHeight: 1.6, margin: "0 0 20px" }}>
          Crie um projeto em{" "}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color: C.navy }}>
            supabase.com
          </a>
          , execute o SQL em <code style={{ fontSize: 12 }}>supabase/schema.sql</code> no SQL Editor e configure o arquivo <code style={{ fontSize: 12 }}>.env</code> na raiz do projeto.
        </p>
        <ol style={{ fontSize: 13, color: C.ink2, lineHeight: 1.8, paddingLeft: 20, margin: "0 0 20px" }}>
          <li>Dashboard → <strong>SQL Editor</strong> → colar e executar <code>supabase/schema.sql</code></li>
          <li>Dashboard → <strong>Settings → API</strong> → copiar URL e <em>anon public</em> key</li>
          <li>Copiar <code>.env.example</code> para <code>.env</code> e colar as credenciais</li>
          <li>Reiniciar: <code>npm run dev</code></li>
        </ol>
        <pre style={{
          fontSize: 11, background: C.bg2, padding: 14, borderRadius: 8, overflow: "auto",
          border: `1px solid ${C.border}`, color: C.ink,
        }}>
{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
        </pre>
      </div>
    </div>
  );
}
