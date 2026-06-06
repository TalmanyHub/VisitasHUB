// Controle de acesso simples (barreira client-side).
// ATENÇÃO: não é segurança real — qualquer pessoa com conhecimento técnico
// consegue inspecionar o bundle. Serve como restrição de acesso para uso interno.

const AUTH_KEY = "hub_auth";

/** Único e-mail autorizado a acessar a ferramenta. */
export const ALLOWED_EMAIL = "hub@al.senai.br";

/** Senha definida em VITE_APP_PASSWORD (Vercel → Environment Variables). */
const PASSWORD = (import.meta.env.VITE_APP_PASSWORD as string | undefined)?.trim() || "senai@hub2026";

/** Valida e-mail (fixo) + senha (env). Comparação de e-mail é case-insensitive. */
export function checkCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === ALLOWED_EMAIL && password === PASSWORD;
}

/** Sessão lembrada no dispositivo (localStorage). */
export function isAuthenticated(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAuthenticated(value: boolean): void {
  try {
    if (value) localStorage.setItem(AUTH_KEY, "1");
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* localStorage indisponível — ignora */
  }
}
