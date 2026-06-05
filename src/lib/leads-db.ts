import { getSupabase, isSupabaseConfigured } from "./supabase";

const TABLE = "hub_leads";
const LEGACY_KEY = "leads-v2";

export type Lead = {
  id: string;
  stage: string;
  pillar: string;
  org: string;
  segment: string;
  decisorNome: string;
  decisorCargo: string;
  contato: string;
  dor: string;
  fit: string[];
  responsaveis: string[];
  canal: string;
  proxContato: string;
  dataVisita: string;
  objecoes: string;
  relatorioDores: string;
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
  dor: string;
  fit: string[] | null;
  responsaveis: string[] | null;
  canal: string;
  prox_contato: string;
  data_visita: string;
  objecoes: string;
  relatorio_dores: string;
  briefing_enviado: boolean;
  data_entrada_handoff: string;
  checks: Record<string, boolean> | null;
  created_at: string;
};

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
    dor: raw.dor ?? "",
    fit: Array.isArray(raw.fit) ? raw.fit : raw.fit ? [String(raw.fit)] : [],
    responsaveis: Array.isArray(raw.responsaveis) ? raw.responsaveis : [],
    canal: raw.canal ?? "E-mail",
    proxContato: raw.proxContato ?? "",
    dataVisita: raw.dataVisita ?? "",
    objecoes: raw.objecoes ?? "",
    relatorioDores: raw.relatorioDores ?? "",
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
    dor: lead.dor,
    fit: lead.fit,
    responsaveis: lead.responsaveis,
    canal: lead.canal,
    prox_contato: lead.proxContato,
    data_visita: lead.dataVisita,
    objecoes: lead.objecoes,
    relatorio_dores: lead.relatorioDores,
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
    dor: row.dor,
    fit: row.fit ?? [],
    responsaveis: row.responsaveis ?? [],
    canal: row.canal,
    proxContato: row.prox_contato,
    dataVisita: row.data_visita,
    objecoes: row.objecoes,
    relatorioDores: row.relatorio_dores,
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

export { isSupabaseConfigured };
