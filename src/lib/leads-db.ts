import { getSupabase, getSupabaseHost, isSupabaseConfigured } from "./supabase";

const TABLE = "hub_leads";
const LEGACY_KEY = "leads-v2";
const CACHE_KEY = "hub_leads_cache";

export type Lead = {
  id: string;
  stage: string;
  pillar: string;
  org: string;
  segment: string;
  decisorNome: string;
  decisorCargo: string;
  contato: string;
  whatsapp: string;
  dor: string;
  fit: string[];
  responsaveis: string[];
  canal: string;
  proxContato: string;
  dataVisita: string;
  objecoes: string;
  relatorioDores: string;
  decisorFinalNome: string;
  decisorFinalCargo: string;
  decisorFinalContato: string;
  proximoPasso: string;
  visitaRealizada: boolean;
  briefingEnviado: boolean;
  dataEntradaHandoff: string;
  checks: Record<string, boolean>;
  createdAt: string;
};

type LeadRow = {
  id: string;
  stage: string;
  pillar: string;
  org: string;
  segment: string;
  decisor_nome: string;
  decisor_cargo: string;
  contato: string;
  whatsapp: string;
  dor: string;
  fit: string[] | null;
  responsaveis: string[] | null;
  canal: string;
  prox_contato: string;
  data_visita: string;
  objecoes: string;
  relatorio_dores: string;
  decisor_final_nome: string;
  decisor_final_cargo: string;
  decisor_final_contato: string;
  proximo_passo: string;
  visita_realizada: boolean;
  briefing_enviado: boolean;
  data_entrada_handoff: string;
  checks: Record<string, boolean> | null;
  created_at: string;
};

/** Mapa de migração: serviços antigos → as 9 linhas oficiais atuais. */
const SERVICE_ALIASES: Record<string, string> = {
  "Sensoriamento e Conectividade por Temperatura": "SENSORIAMENTO E CONECTIVIDADE",
  "Sensoriamento e Conectividade por Contagem": "SENSORIAMENTO E CONECTIVIDADE",
  "Sensoriamento e Conectividade (Cresce Indústria)": "SENSORIAMENTO E CONECTIVIDADE",
  "Prototipagem Digital": "PROTOTIPAGEM",
  "Modelagem Digital 3D (Cresce Indústria)": "PROTOTIPAGEM",
  "Prototipagem Física": "PROTOTIPAGEM",
  "Inovação em Produto": "PESQUISA E DESENVOLVIMENTO",
  "Mapeamento Tecnológico": "PESQUISA E DESENVOLVIMENTO",
  "Bootcamp de Inteligência Artificial": "BOOTCAMP",
  "Capacitação Empreendedora": "EDUCAÇÃO EMPREENDEDORA E NOVOS NEGÓCIOS",
  "Desenvolvimento / Aceleração de Negócios": "EDUCAÇÃO EMPREENDEDORA E NOVOS NEGÓCIOS",
  "Estratégia e Governança da Inovação": "INOVAÇÃO CORPORATIVA",
  "Cultura de Inovação": "INOVAÇÃO CORPORATIVA",
  "Conexão com Ecossistema de Inovação": "INOVAÇÃO ABERTA",
  "Inovação para a Indústria — Smart Factory": "PLATAFORMA DE INOVAÇÃO PARA A INDÚSTRIA",
  "Inovação para a Indústria — Aliança Industrial": "PLATAFORMA DE INOVAÇÃO PARA A INDÚSTRIA",
  "Inovação para a Indústria — Aliança Educacional": "PLATAFORMA DE INOVAÇÃO PARA A INDÚSTRIA",
  "Inovação para a Indústria — Saúde Conectada": "PLATAFORMA DE INOVAÇÃO PARA A INDÚSTRIA",
  "Linha de Fomento — Recursos não reembolsáveis": "OUTRAS LINHAS DE FOMENTO",
};

/** Normaliza a lista de serviços de fit, migrando valores antigos e removendo duplicatas. */
function migrateFit(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  const mapped = arr.map((s) => SERVICE_ALIASES[s as string] ?? s);
  return Array.from(new Set(mapped));
}

export function normalizeLead(raw: Partial<Lead> & { id: string }): Lead {
  return {
    id: raw.id,
    stage: raw.stage ?? "mapeamento",
    pillar: raw.pillar ?? "emp",
    org: raw.org ?? "",
    segment: raw.segment ?? "",
    decisorNome: raw.decisorNome ?? "",
    decisorCargo: raw.decisorCargo ?? "",
    contato: raw.contato ?? "",
    whatsapp: raw.whatsapp ?? "",
    dor: raw.dor ?? "",
    fit: migrateFit(raw.fit),
    responsaveis: Array.isArray(raw.responsaveis) ? raw.responsaveis : [],
    canal: raw.canal ?? "E-mail",
    proxContato: raw.proxContato ?? "",
    dataVisita: raw.dataVisita ?? "",
    objecoes: raw.objecoes ?? "",
    relatorioDores: raw.relatorioDores ?? "",
    decisorFinalNome: raw.decisorFinalNome ?? "",
    decisorFinalCargo: raw.decisorFinalCargo ?? "",
    decisorFinalContato: raw.decisorFinalContato ?? "",
    proximoPasso: raw.proximoPasso ?? "",
    visitaRealizada: Boolean(raw.visitaRealizada),
    briefingEnviado: Boolean(raw.briefingEnviado),
    dataEntradaHandoff: raw.dataEntradaHandoff ?? "",
    checks: raw.checks && typeof raw.checks === "object" ? raw.checks : {},
    createdAt: raw.createdAt ?? new Date().toISOString().slice(0, 10),
  };
}

function toRow(lead: Lead): LeadRow {
  return {
    id: lead.id,
    stage: lead.stage,
    pillar: lead.pillar,
    org: lead.org,
    segment: lead.segment,
    decisor_nome: lead.decisorNome,
    decisor_cargo: lead.decisorCargo,
    contato: lead.contato,
    whatsapp: lead.whatsapp,
    dor: lead.dor,
    fit: lead.fit,
    responsaveis: lead.responsaveis,
    canal: lead.canal,
    prox_contato: lead.proxContato,
    data_visita: lead.dataVisita,
    objecoes: lead.objecoes,
    relatorio_dores: lead.relatorioDores,
    decisor_final_nome: lead.decisorFinalNome,
    decisor_final_cargo: lead.decisorFinalCargo,
    decisor_final_contato: lead.decisorFinalContato,
    proximo_passo: lead.proximoPasso,
    visita_realizada: lead.visitaRealizada,
    briefing_enviado: lead.briefingEnviado,
    data_entrada_handoff: lead.dataEntradaHandoff,
    checks: lead.checks,
    created_at: lead.createdAt,
  };
}

function fromRow(row: LeadRow): Lead {
  return normalizeLead({
    id: row.id,
    stage: row.stage,
    pillar: row.pillar,
    org: row.org,
    segment: row.segment,
    decisorNome: row.decisor_nome,
    decisorCargo: row.decisor_cargo,
    contato: row.contato,
    whatsapp: row.whatsapp,
    dor: row.dor,
    fit: row.fit ?? [],
    responsaveis: row.responsaveis ?? [],
    canal: row.canal,
    proxContato: row.prox_contato,
    dataVisita: row.data_visita,
    objecoes: row.objecoes,
    relatorioDores: row.relatorio_dores,
    decisorFinalNome: row.decisor_final_nome,
    decisorFinalCargo: row.decisor_final_cargo,
    decisorFinalContato: row.decisor_final_contato,
    proximoPasso: row.proximo_passo,
    visitaRealizada: row.visita_realizada,
    briefingEnviado: row.briefing_enviado,
    dataEntradaHandoff: row.data_entrada_handoff,
    checks: row.checks ?? {},
    createdAt: row.created_at,
  });
}

export async function fetchLeads(): Promise<Lead[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as LeadRow[]).map(fromRow);
}

export async function saveLeads(leads: Lead[]): Promise<void> {
  if (leads.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.from(TABLE).upsert(leads.map(toRow), { onConflict: "id" });
  if (error) throw error;
}

export async function deleteLeadById(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

/** Migra dados do localStorage (versão anterior) para o Supabase, uma única vez. */
export function readLegacyLeads(): Lead[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Lead>[];
    if (!Array.isArray(parsed)) return null;
    return parsed.map((l) => normalizeLead({ ...l, id: l.id || crypto.randomUUID() }));
  } catch {
    return null;
  }
}

export function clearLegacyLeads(): void {
  localStorage.removeItem(LEGACY_KEY);
}

/** Cache local dos leads — permite render instantâneo enquanto o Supabase responde. */
export function readCachedLeads(): Lead[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Lead>[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map((l) => normalizeLead({ ...l, id: l.id || crypto.randomUUID() }));
  } catch {
    return null;
  }
}

export function writeCachedLeads(leads: Lead[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(leads));
  } catch {
    /* localStorage indisponível (modo privado / cota) — ignora */
  }
}

/** Monta uma string diagnóstica a partir de um PostgrestError: code · message · details · hint. */
export function formatSupabaseError(e: unknown): string {
  if (!e || typeof e !== "object") return String(e ?? "Erro desconhecido");
  const err = e as { code?: string; message?: string; details?: string; hint?: string };
  const parts = [
    err.code && `[${err.code}]`,
    err.message,
    err.details && `details: ${err.details}`,
    err.hint && `hint: ${err.hint}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Erro desconhecido ao falar com o Supabase";
}

export type DiagStep = { step: "select" | "insert" | "delete"; ok: boolean; error?: string };
export type DiagResult = { host: string; steps: DiagStep[] };

/**
 * Probe sequencial para isolar a causa: leitura → escrita → exclusão.
 * Distingue tabela ausente / RLS de leitura / RLS de escrita.
 */
export async function diagnoseConnection(): Promise<DiagResult> {
  const host = getSupabaseHost();
  const steps: DiagStep[] = [];
  if (!isSupabaseConfigured()) {
    return { host, steps: [{ step: "select", ok: false, error: "Supabase não configurado (env vars ausentes)" }] };
  }
  const supabase = getSupabase();
  const probeId = "__diag__";

  // 1. leitura (existência da tabela / RLS de select)
  const sel = await supabase.from(TABLE).select("id").limit(1);
  steps.push({ step: "select", ok: !sel.error, error: sel.error ? formatSupabaseError(sel.error) : undefined });

  // 2. escrita (RLS de insert / schema)
  const ins = await supabase.from(TABLE).insert({ id: probeId }).select("id");
  steps.push({ step: "insert", ok: !ins.error, error: ins.error ? formatSupabaseError(ins.error) : undefined });

  // 3. exclusão da sonda (RLS de delete + limpeza)
  const del = await supabase.from(TABLE).delete().eq("id", probeId);
  steps.push({ step: "delete", ok: !del.error, error: del.error ? formatSupabaseError(del.error) : undefined });

  return { host, steps };
}

export { isSupabaseConfigured, getSupabaseHost };
