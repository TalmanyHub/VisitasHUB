import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import SupabaseSetup from "./components/SupabaseSetup";
import Login from "./components/Login";
import { isAuthenticated, setAuthenticated } from "./lib/auth";
import {
  clearLegacyLeads,
  deleteLeadById,
  diagnoseConnection,
  fetchLeads,
  formatSupabaseError,
  isSupabaseConfigured,
  normalizeLead,
  readCachedLeads,
  readLegacyLeads,
  saveLeads,
  writeCachedLeads,
} from "./lib/leads-db";

/* ════════════════ DESIGN TOKENS ════════════════ */
const C = {
  bg: "#F0F3F9", bg2: "#E4EAF4", white: "#FFFFFF",
  ink: "#0A1628", ink2: "#2A3A55", ink3: "#7A8EAA",
  navy: "#0055A5", orange: "#EC5A24", border: "#C8D4E8",
  emp: "#6C47D9", empBg: "#F0ECFF",
  proto: "#1A7A4A", protoBg: "#E6F4EC",
  red: "#C0392B", redBg: "#FDECEA",
};

/* ════════════════ ETAPAS ════════════════ */
const STAGES = [
  { id: "mapeamento", num: "01", icon: "🗺", name: "Mapeamento", color: C.navy,
    desc: "Lead pesquisado e ficha sendo preenchida",
    eyebrow: "Etapa 01 de 04", title: "Mapeamento de leads",
    intro: "Antes de qualquer contato, você precisa saber com quem vai falar. Esta etapa garante que você chegue no cliente certo, com o contexto certo." },
  { id: "exploracao", num: "02", icon: "📡", name: "Exploração", color: C.orange,
    desc: "Cadência D1→D10 para agendar a visita",
    eyebrow: "Etapa 02 de 04", title: "Exploração e abordagem",
    intro: "Com a ficha em mãos, você vai entrar em contato. O único objetivo aqui é agendar a visita técnica gratuita — não é vender. É ouvir e criar conexão." },
  { id: "visita", num: "03", icon: "🔍", name: "Visita Técnica", color: "#1565C0",
    desc: "Diagnóstico SPIN de 60 min",
    eyebrow: "Etapa 03 de 04", title: "Visita técnica & diagnóstico",
    intro: "A visita dura 60 minutos. Você não vai vender nada — vai ouvir. Use o método SPIN para conduzir a conversa e sair com o relatório de dores preenchido." },
  { id: "handoff", num: "04", icon: "↗", name: "Handoff", color: C.emp,
    desc: "Briefing para o time comercial (24h)",
    eyebrow: "Etapa 04 de 04", title: "Handoff comercial",
    intro: "A visita aconteceu. Agora você precisa passar um briefing completo para o time comercial em até 24h. Sem isso, o diagnóstico se perde e o cliente esfria." },
];
const STAGE_IDX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

/* ════════════════ PILARES ════════════════ */
const PILLARS = {
  emp: { label: "Empreendedorismo", short: "Empreend.", icon: "🚀", color: C.emp, bg: C.empBg },
  proto: { label: "Prototipagem", short: "Proto.", icon: "🔩", color: C.proto, bg: C.protoBg },
};

/* ════════════════ CATÁLOGO DE SERVIÇOS ════════════════ */
/* Lista agrupada — todos os serviços ficam disponíveis para ambos os pilares,
   já que vários atendem tanto setor público quanto indústria. */
const SERVICES = [
  "SENSORIAMENTO E CONECTIVIDADE",
  "PROTOTIPAGEM",
  "PESQUISA E DESENVOLVIMENTO",
  "BOOTCAMP",
  "EDUCAÇÃO EMPREENDEDORA E NOVOS NEGÓCIOS",
  "INOVAÇÃO CORPORATIVA",
  "INOVAÇÃO ABERTA",
  "PLATAFORMA DE INOVAÇÃO PARA A INDÚSTRIA",
  "OUTRAS LINHAS DE FOMENTO",
];
const ALL_SERVICES = SERVICES;

/* ════════════════ EQUIPE / RESPONSÁVEIS ════════════════ */
const RESPONSAVEIS = [
  "Marcel Muller",
  "Wesley Andrade",
  "Talmany Leite",
  "Alycia Luna",
  "Isabel Ribeiro",
  "Helder Junior",
  "Adrian Costa",
  "Mateus Albuquerque",
  "Dayse Buyers",
];
/* paleta para avatares — cor estável por nome */
const AVATAR_COLORS = ["#0055A5", "#EC5A24", "#6C47D9", "#1A7A4A", "#C0392B",
  "#1565C0", "#9A6A00", "#0F766E", "#7A1E66"];
const colorFor = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};
const initialsOf = (name) => {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
};

/* ════════════════ CHECKLISTS (Kanban) ════════════════ */
const CHECKLISTS = {
  mapeamento: ["Instituição/empresa identificada", "Segmento definido", "Decisor: nome + cargo",
    "Contato validado (e-mail ou telefone)", "Dor provável mapeada", "Serviço de maior fit definido",
    "Canal de abordagem escolhido", "Data do próximo contato planejada"],
  exploracao: ["D1 — E-mail de abertura personalizado enviado", "D1 — Conexão no LinkedIn enviada",
    "D3 — 1ª ligação realizada", "D5 — Follow-up com dado/caso relevante", "D7 — WhatsApp + 2ª ligação",
    "Cada touchpoint registrado na planilha", "Visita técnica agendada", "Visita confirmada por WhatsApp"],
  visita: ["Roteiro SPIN de 60 min seguido", "Relatório de dores preenchido (palavras do cliente)",
    "Necessidade verbalizada registrada", "Decisor final confirmado", "Objeções levantadas anotadas",
    "Próximo passo combinado com o cliente", "WA de agradecimento enviado (D0)", "Planilha atualizada — 'Visita realizada'"],
  handoff: ["Relatório de dores preenchido (até 2h)", "Briefing completo montado", "Pilar de maior fit definido",
    "Contexto orçamentário registrado", "Decisor final (quem assina) confirmado",
    "Objeções e urgência documentadas", "Briefing enviado ao comercial (até 24h)", "WA de confirmação de devolutiva enviado"],
};

/* ════════════════ CONTEÚDO DO GUIA ════════════════ */
const GUIA = {
  mapeamento: {
    objetivo: {
      emp: "Construir lista de ≥20 leads/mês com ficha preenchida — segmento, dor provável, decisor e canal de acesso mapeados.",
      proto: "Construir lista de ≥20 leads/mês com ficha preenchida — setor industrial, produto, decisor técnico e tipo de prototipagem mapeados.",
    },
    atividades: {
      emp: [
        { t: "Defina o segmento prioritário da semana", d: "Escolha um tipo de instituição para focar: prefeituras do interior, secretarias estaduais, autarquias ou órgãos de fomento. Misturar muitos segmentos prejudica a personalização. Máximo 2 segmentos por semana.", tools: ["Planilha de leads", "Mapa de municípios AL"] },
        { t: "Pesquise o contexto da instituição", d: "Pesquise: a instituição já teve programa de empreendedorismo? Há desemprego alto no município? Editais abertos? Anote 2–3 dados relevantes — viram gatilho na abordagem.", tools: ["Site da prefeitura", "Google News", "IBGE Cidades", "Portal da Transparência"] },
        { t: "Identifique o tomador de decisão", d: "Na prefeitura: Secretário de Desenvolvimento Econômico ou Prefeito. Em fundos/autarquias: Superintendente ou Diretor. Em secretarias estaduais: Secretário ou Subsecretário. Registre nome, cargo e contato.", tools: ["LinkedIn", "Telefone da secretaria"] },
        { t: "Identifique a dor provável e o serviço de fit", d: "Alta informalidade → Capacitação Empreendedora. Falta de renda para jovens → Desenvolvimento & Aceleração. Comunidades sem negócios sustentáveis → Empreend. Inovador e Social.", tools: ["Fit de Serviços", "Ficha do Cliente"] },
        { t: "Preencha a ficha e registre na planilha", d: "Preencha: instituição, segmento, decisor (nome+cargo+contato), dor provável, serviço de fit, canal e data de próximo contato.", tools: ["Planilha de Leads", "Template Ficha"] },
      ],
      proto: [
        { t: "Identifique empresas que fabricam produtos físicos", d: "Foque em manufatura (metal, plástico, borracha), empresas com linha própria, fornecedores industriais, startups de hardware, laboratórios de P&D. Evite empresas de serviço puro.", tools: ["FIEA — Cadastro Industrial", "Planilha de leads", "LinkedIn"] },
        { t: "Pesquise os produtos e processos da empresa", d: "Visite site e LinkedIn. Eles lançam produtos novos com frequência? Mencionaram retrabalho ou custo de fabricação? Há P&D? Isso define o tipo: digital ou física.", tools: ["Site da empresa", "LinkedIn da empresa"] },
        { t: "Identifique o tomador de decisão técnico", d: "O decisor costuma ser Gerente de Engenharia/P&D, Gerente de Produção, Diretor Industrial ou dono. Compras geralmente não decide — procure 'engenharia', 'desenvolvimento' ou 'produto' no cargo.", tools: ["LinkedIn", "Ligar pedindo 'setor técnico'"] },
        { t: "Mapeie a dor e o tipo de serviço", d: "Erros de projeto, retrabalho caro, falta de documentação → Prototipagem Digital. Precisam testar encaixe e ergonomia antes da escala → Prototipagem Física.", tools: ["Playbook Comercial", "Ficha do Cliente"] },
        { t: "Preencha a ficha e registre na planilha", d: "Preencha: empresa, setor, produto, decisor técnico, dor provável, tipo de prototipagem de fit, canal e data de próximo contato.", tools: ["Planilha de Leads", "Template Ficha"] },
      ],
    },
    mensagens: {
      emp: [
        { titulo: "LinkedIn — Localizar o decisor", ctx: "Durante o mapeamento", msg: `Busca sugerida no LinkedIn:\n"[Secretário de Desenvolvimento] [Município]" ou "[Prefeito] [Município AL]"\n\nOu pelo nome da secretaria:\n"Secretaria de [Desenvolvimento Econômico] [Município]"\n\nAnote: nome completo · cargo exato · e-mail ou telefone no perfil · últimas publicações.`, tip: "Se não encontrar no LinkedIn, acesse o site oficial e procure na aba 'Equipe' ou 'Sobre'." },
        { titulo: "E-mail de confirmação de contato", ctx: "Quando não tem certeza do e-mail", assunto: "Contato responsável — [área/secretaria]", msg: `Prezados,\n\nPoderia me informar o e-mail e o nome completo do(a) responsável pela área de [desenvolvimento econômico / empreendedorismo / capacitação] da secretaria?\n\nObrigado,\n[Seu nome] — HUB SENAI Alagoas\n(82) 99308-3740`, tip: "Envie para o e-mail geral da secretaria. É mais rápido do que adivinhar o contato direto." },
      ],
      proto: [
        { titulo: "LinkedIn — Localizar o gerente técnico", ctx: "Durante o mapeamento", msg: `Busca sugerida no LinkedIn:\n"[Gerente de Engenharia] [Empresa]" ou "[P&D] [Empresa AL]"\n\nFiltros: empresa + cargo com "engenharia", "desenvolvimento", "produção" ou "P&D".\n\nAnote: nome · cargo · publicações sobre desenvolvimento de produto · conexões em comum.`, tip: "Gerentes de engenharia têm perfis mais ativos que diretores. Interagir com um post antes de conectar aumenta o aceite." },
        { titulo: "Ligação para confirmar o gerente técnico", ctx: "Quando não acha o nome no LinkedIn", msg: `— Bom dia, [seu nome] do HUB SENAI Alagoas.\nPreciso confirmar o nome do responsável pela área de engenharia ou desenvolvimento de produto — poderia me informar?\n\n[Anote nome e cargo exatos]\nObrigado — vou entrar em contato diretamente com ele(a).`, tip: "Nunca explique o motivo do contato à recepção — só peça o nome. Preserva o elemento de surpresa." },
      ],
    },
    objeccoes: { emp: [], proto: [] },
    metas: [
      { label: "Fichas/mês", val: "20", sub: "leads qualificados com ficha completa" },
      { label: "Decisores identificados", val: "≥10", sub: "por mês (nome + cargo + contato)" },
      { label: "Dor mapeada", val: "100%", sub: "das fichas com dor e serviço de fit" },
    ],
    metaNota: "Ficha completa = Instituição · segmento · decisor (nome+cargo) · contato validado · dor provável · serviço de fit · canal · data de próximo contato. Fichas incompletas travam a etapa seguinte e não contam para a meta.",
  },

  exploracao: {
    objetivo: {
      emp: "Regra de ouro: nunca mencione produto, preço ou portfólio. Você está em missão de diagnóstico. O único objetivo é agendar a visita técnica gratuita.",
      proto: "Para indústrias, a abordagem é técnica e direta. O gancho é retrabalho, custo de desenvolvimento ou falta de documentação — não 'inovação' genérica.",
    },
    atividades: {
      emp: [
        { tag: "D1", t: "E-mail de abertura personalizado", d: "Use o dado pesquisado no mapeamento. O assunto deve ser específico ao contexto do cliente — nunca 'Apresentação HUB SENAI'.", tools: ["Templates em Mensagens"] },
        { tag: "D1", t: "Conexão no LinkedIn", d: "Solicitação com mensagem personalizada (máx. 300 caracteres). Não envie DM no mesmo dia — espere o aceite e ao menos 24h.", tools: ["LinkedIn"] },
        { tag: "D3", t: "1ª ligação — recepção/secretaria", d: "Na recepção, seja breve: você mapeia como municípios de AL estruturam programas de empreendedorismo, quer 1 minuto com o secretário. Não explique o HUB.", tools: ["Script Ligação"] },
        { tag: "D5", t: "Follow-up por e-mail com dado relevante", d: "Sem resposta? Envie segundo e-mail curto com edital aberto, notícia ou programa relevante. Não repita o pitch.", tools: ["Template Follow-up"] },
        { tag: "D7", t: "WhatsApp + 2ª ligação", d: "WA breve referenciando a tentativa anterior, depois ligue. No decisor: 'Estou mapeando como prefeituras de AL estruturam empreendedorismo — não tenho nada para vender. Teria 40 segundos?'", tools: ["Template WA", "Script Decisor"] },
        { tag: "D10", t: "Última tentativa — e-mail de encerramento", d: "Sem retorno? Envie o e-mail de encerramento — deixa a porta aberta sem pressionar. Retome em D30+ com novo gatilho.", tools: ["Template Encerramento"] },
      ],
      proto: [
        { tag: "D1", t: "E-mail de abertura técnico", d: "Foco no problema técnico. Digital: retrabalho e custo de correção. Física: risco de fabricar sem teste prévio.", tools: ["Template E-mail Proto."] },
        { tag: "D1", t: "Conexão no LinkedIn com nota técnica", d: "Mensagem específica ao setor. Nunca use 'inovação' — use 'processo', 'solução' ou 'desenvolvimento de produto'.", tools: ["Template LI Proto."] },
        { tag: "D3", t: "1ª ligação — gerente técnico", d: "Peça pelo Gerente de Engenharia/Produção/P&D. Nunca mencione 'cursos' ou 'capacitação'.", tools: ["Script Ligação"] },
        { tag: "D5", t: "Follow-up com caso de aplicação", d: "E-mail curto com exemplo de prototipagem aplicada em empresa similar. 2–3 linhas + CTA para a visita.", tools: ["Template Follow-up Proto."] },
        { tag: "D7", t: "WhatsApp + 2ª ligação", d: "WA breve, depois ligue. No decisor: 'Mapeio como empresas do setor [X] validam produtos antes de fabricar — visita gratuita de diagnóstico. 40 segundos?'", tools: ["Template WA Proto."] },
      ],
    },
    mensagens: {
      emp: [
        { titulo: "E-mail de abertura — Gestor Público", ctx: "D1 · 1º contato", assunto: "[Município]: estruturação de empreendedorismo em 2026", msg: `Prezado(a) [Nome],\n\nAcompanho a pauta de [município/secretaria] e [ação/iniciativa recente] indica uma agenda ativa de desenvolvimento — contexto no qual o HUB SENAI pode contribuir.\n\nApoiamos prefeituras de Alagoas a converter iniciativas de empreendedorismo em resultado mensurável: negócios formalizados, renda gerada e indicadores consistentes para prestação de contas.\n\nAntes de qualquer proposta, conduzo um diagnóstico gratuito de 30 minutos para compreender o contexto do município. Haveria disponibilidade na terça pela manhã ou na quinta à tarde?\n\nAtenciosamente,\n[Seu nome]\nHUB SENAI Alagoas · (82) 99308-3740`, tip: "A CTA oferece DUAS opções concretas de horário — decidir entre 'A ou B' tem menos atrito que responder a uma pergunta aberta. Mantenha a primeira frase sobre o cliente." },
        { titulo: "E-mail follow-up D5 — gatilho de edital", ctx: "D5 · sem resposta", assunto: "Edital com prazo aberto — relevante para [município]", msg: `Prezado(a) [Nome],\n\nRetomo o contato porque surgiu uma oportunidade concreta e datada: [edital/programa aberto, com prazo].\n\nO HUB SENAI dispõe de formatos que se articulam como contrapartida ou complemento a editais dessa natureza — e a estruturação a partir do zero costuma exigir prazo.\n\nEm 30 minutos consigo demonstrar se há aderência ao contexto de [município]. Poderia retornar a ligação na quinta às 10h, ou prefere indicar outro horário?\n\nAtenciosamente,\n[Seu nome]`, tip: "Reativação sempre com um motivo NOVO e datado. 'Prazo aberto' cria urgência legítima — nunca fabricada." },
        { titulo: "E-mail encerramento D10 — porta aberta", ctx: "D10 · última tentativa", assunto: "Encerramento do contato — canal permanece à disposição", msg: `Prezado(a) [Nome],\n\nApós algumas tentativas sem retorno, encerro este contato para não comprometer sua agenda.\n\nRegistro, contudo, que o HUB SENAI permanece à disposição: quando [município] for estruturar ou ampliar ações de empreendedorismo e geração de renda, o diagnóstico inicial é conduzido sem custo.\n\nBasta responder a este e-mail. Desejo sucesso na gestão.\n\nAtenciosamente,\n[Seu nome]\nhub@al.senai.br · (82) 99308-3740`, tip: "O e-mail de encerramento honesto costuma ter alta taxa de resposta — o 'não agora' frequentemente se converte em 'sim' em 30 dias." },
        { titulo: "WhatsApp D7 — após ligação sem sucesso", ctx: "D7 · WhatsApp", msg: `Bom dia, [Nome]. Aqui é [seu nome], do HUB SENAI Alagoas.\n\nTentei contato telefônico hoje sem sucesso e registro o motivo de forma objetiva: o HUB SENAI conduz diagnósticos gratuitos de empreendedorismo para municípios de Alagoas — encontro presencial de aproximadamente 1 hora, sem compromisso.\n\nSe houver aderência ao contexto de [município], poderia me indicar dois horários convenientes para que eu me organize?`, tip: "No WhatsApp, vá direto ao motivo objetivo. Pedir que o cliente indique horários inverte o esforço e aumenta o compromisso." },
        { titulo: "WhatsApp — confirmação de visita agendada", ctx: "Após agendar · obrigatório", msg: `Prezado(a) [Nome], a visita está confirmada.\n\nVisita de diagnóstico — HUB SENAI Alagoas\nData: [dia], [data], às [hora]\nLocal: [local]\nDuração: aproximadamente 1 hora — não há necessidade de preparação prévia\n\nO objetivo do encontro é compreender o contexto atual de [município/secretaria]. Havendo qualquer imprevisto, peço a gentileza de me comunicar por este canal.\n\nAtenciosamente,\n[Seu nome] · HUB SENAI Alagoas`, tip: "A confirmação por escrito reduz significativamente o não comparecimento. Informar 'sem necessidade de preparação' remove o peso e a ansiedade do cliente." },
        { titulo: "WhatsApp — lembrete da véspera", ctx: "1 dia antes da visita", msg: `Prezado(a) [Nome], registro um breve lembrete da nossa visita.\n\nNos encontraremos amanhã, [data], às [hora], em [local]. Trata-se de uma conversa de diagnóstico; basta dispor do contexto de vocês — a condução é de minha responsabilidade.\n\nCaso haja necessidade de reagendamento, permaneço à disposição para acomodar uma nova data.\n\nAtenciosamente,\n[Seu nome]`, tip: "O lembrete da véspera é a principal alavanca contra o não comparecimento. Oferecer reagendamento sem atrito previne o cancelamento de última hora — ou o silêncio." },
        { titulo: "Script — Recepção / Porteiro", ctx: "Ligação D3", msg: `— Bom dia. Aqui é [seu nome], do HUB SENAI Alagoas. Eu gostaria de falar com [Secretário de Desenvolvimento], por favor.\n\nSe perguntarem o assunto:\n— Trata-se de um levantamento que conduzimos com municípios de Alagoas na área de empreendedorismo. É um contato breve, de menos de um minuto com [ele/ela].\n\nSe informarem que está em reunião:\n— Compreendo. Qual seria o melhor horário, ainda hoje, para que eu retorne?\n\nSe sugerirem o envio de e-mail:\n— Posso enviar. Para direcioná-lo corretamente, poderia me confirmar o nome do(a) responsável pela área de capacitação e empreendedorismo?`, tip: "Tom firme e cortês. Você conduz o contato — não pede favor. Nunca explique o HUB para a recepção." },
        { titulo: "Script — Decisor", ctx: "Ligação D3/D7", msg: `— [Nome]? Bom dia. Aqui é [seu nome], do HUB SENAI Alagoas. Teria 40 segundos?\n\n[Se sim]\n— Agradeço. Não se trata de uma oferta comercial — estou mapeando como municípios de Alagoas estruturam empreendedorismo e geração de renda. Permite-me uma pergunta?\n\n— Atualmente, [município] possui algum programa de empreendedorismo em funcionamento, ou ainda é uma iniciativa em planejamento?\n\n[Ouça com atenção, sem interromper. Registre a resposta.]\n\n— Compreendo. É precisamente esse tipo de contexto que o diagnóstico esclarece. São 30 minutos presenciais, sem custo. A terça pela manhã ou a quinta à tarde seria mais conveniente?\n\n[Se houver hesitação]\n— Sem compromisso algum. Caso a conversa não indique aderência, eu mesmo o informarei com transparência.`, tip: "A pergunta de abertura ('em funcionamento ou em planejamento?') funciona como mini-diagnóstico — e a resposta fornece insumo para a visita." },
        { titulo: "LinkedIn — Solicitação de conexão", ctx: "D1 · LinkedIn", msg: `[Nome], acompanho a pauta de [município] e [ação recente] chamou minha atenção.\n\nAtuo com empreendedorismo aplicado à gestão pública no HUB SENAI Alagoas. Seria oportuno conectar para uma futura troca de ideias.`, tip: "Máx. 300 caracteres. Referencie algo real e recente. A conexão é apenas a porta — não tente vender nela." },
        { titulo: "LinkedIn — Mensagem após conexão aceita", ctx: "24h+ após o aceite", msg: `Prezado(a) [Nome], agradeço pela conexão.\n\nDe forma objetiva: o HUB SENAI Alagoas conduz diagnósticos gratuitos com prefeituras do estado para identificar oportunidades em empreendedorismo e geração de renda.\n\nCaso seja de interesse para [município], permaneço à disposição para combinar um horário conveniente à sua agenda.`, tip: "Aguarde ao menos 24h após o aceite. Mensagem imediata após a conexão sugere automação e compromete o contato." },
      ],
      proto: [
        { titulo: "E-mail de abertura — Gerente de Engenharia", ctx: "D1 · 1º contato", assunto: "Ciclo de desenvolvimento de produto em [empresa]", msg: `Prezado(a) [Nome],\n\nUma questão objetiva: atualmente, quantas iterações [empresa] percorre entre o conceito de um produto e o protótipo funcional definitivo?\n\nO HUB SENAI Alagoas atua justamente na redução desse ciclo. Realizamos modelagem 3D, simulação e prototipagem física (impressão 3D, corte a laser, CNC) para validar encaixe e funcionalidade antes do comprometimento de ferramental e produção.\n\nConduzo uma visita técnica gratuita de 1 hora para identificar a aplicação ao processo de vocês. Terça ou quinta seria mais conveniente?\n\nAtenciosamente,\n[Seu nome]\nHUB SENAI Alagoas · (82) 99308-3740`, tip: "Abrir com uma pergunta técnica específica leva o gerente a respondê-la mentalmente — e isso já o engaja na leitura." },
        { titulo: "E-mail follow-up D5 — caso de aplicação", ctx: "D5 · sem resposta", assunto: "Caso de aplicação: redução de retrabalho em indústria de AL", msg: `Prezado(a) [Nome],\n\nRetomo o contato com um caso de aplicação concreto, possivelmente mais ilustrativo que o e-mail anterior.\n\nUma indústria de Alagoas registrava custo recorrente de retrabalho — erros dimensionais identificados apenas após a produção. Com a adoção de modelagem 3D e prototipagem física, esses erros passaram a ser detectados ainda na fase de bancada, antes da linha.\n\nCaso o cenário tenha aderência ao processo de vocês, justifica-se uma conversa de 1 hora. Posso retornar a ligação na quinta às 10h, ou prefere indicar outro horário?\n\nAtenciosamente,\n[Seu nome]`, tip: "Para perfil técnico, o caso concreto supera o argumento. Descreva o problema e o antes/depois — sem citar a empresa se não houver autorização." },
        { titulo: "E-mail encerramento D10 — porta aberta", ctx: "D10 · última tentativa", assunto: "Encerramento do contato — disponibilidade mantida", msg: `Prezado(a) [Nome],\n\nApós algumas tentativas, encerro este contato para não comprometer sua agenda.\n\nRegistro que o HUB SENAI permanece disponível: ao surgir um novo produto a desenvolver, uma peça a validar ou um desenho técnico a recuperar, conduzimos o diagnóstico inicial sem custo.\n\nBasta responder a este e-mail. Cordialmente,\n[Seu nome]\nhub@al.senai.br · (82) 99308-3740`, tip: "Listar os três gatilhos concretos de necessidade ('produto novo', 'peça a validar', 'desenho a recuperar') torna o e-mail um lembrete útil no momento certo." },
        { titulo: "WhatsApp D7 — após ligação sem sucesso", ctx: "D7 · WhatsApp", msg: `Bom dia, [Nome]. Aqui é [seu nome], do HUB SENAI Alagoas.\n\nTentei contato telefônico hoje, sobre desenvolvimento de produto, sem sucesso.\n\nDe forma objetiva: o HUB SENAI oferece prototipagem digital e física para a indústria de Alagoas — visita técnica gratuita de aproximadamente 1 hora, voltada a diagnóstico.\n\nHavendo aderência ao processo de [empresa], poderia me indicar dois horários convenientes?`, tip: "Para indústria, empregue o termo técnico 'prototipagem' sem rodeios — o público o reconhece e o respeita." },
        { titulo: "WhatsApp — confirmação de visita agendada", ctx: "Após agendar · obrigatório", msg: `Prezado(a) [Nome], a visita técnica está confirmada.\n\nVisita técnica — HUB SENAI Alagoas\nData: [dia], [data], às [hora]\nLocal: [local]\nDuração: aproximadamente 1 hora\n\nCaso seja possível disponibilizar um produto ou peça que represente um desafio de desenvolvimento, isso enriquece o diagnóstico — embora não seja obrigatório. Havendo qualquer imprevisto, peço a gentileza de me comunicar.\n\nAtenciosamente,\n[Seu nome] · HUB SENAI Alagoas`, tip: "Solicitar uma peça 'que represente um desafio' faz a visita iniciar de forma concreta — e sinaliza um encontro técnico, não comercial." },
        { titulo: "WhatsApp — lembrete da véspera", ctx: "1 dia antes da visita", msg: `Prezado(a) [Nome], registro um breve lembrete da nossa visita técnica.\n\nNos encontraremos amanhã, [data], às [hora], em [local]. Trata-se de uma conversa técnica de diagnóstico, com duração aproximada de 1 hora.\n\nCaso haja necessidade de reagendamento, permaneço à disposição.\n\nAtenciosamente,\n[Seu nome]`, tip: "O lembrete da véspera é a defesa principal contra o não comparecimento. Conciso e com a opção de reagendamento explicitada." },
        { titulo: "Script — Recepção / Porteiro", ctx: "Ligação D3", msg: `— Bom dia. Aqui é [seu nome], do HUB SENAI Alagoas. Eu preciso falar com o setor técnico — Gerência de Engenharia, de Produção ou de P&D.\n\nSe perguntarem o assunto:\n— Trata-se de um levantamento técnico sobre como a indústria de Alagoas desenvolve e testa novos produtos. É um contato breve.\n\nSe informarem que está ocupado:\n— Compreendo. Qual seria o melhor horário para que eu retorne e fale com a área técnica?`, tip: "Solicite o 'setor técnico' pelo nome do cargo — evita o redirecionamento para compras ou RH." },
        { titulo: "Script — Decisor Técnico", ctx: "Ligação D3/D7", msg: `— [Nome]? Aqui é [seu nome], do HUB SENAI Alagoas. Teria 40 segundos?\n\n[Se sim]\n— Agradeço. Não se trata de uma oferta comercial — é uma conversa técnica. Permite-me uma pergunta objetiva?\n\n— Quando há necessidade de testar uma peça nova ou validar um encaixe, como esse processo é conduzido hoje?\n\n[Ouça com atenção. Registre o processo atual — esse é o insumo central.]\n\n— Compreendo. O HUB SENAI dispõe de modelagem 3D, simulação e prototipagem física. Conduzo uma visita técnica gratuita de 1 hora para identificar a aplicação ao processo de vocês. Terça ou quinta?\n\n[Se houver hesitação]\n— Sem compromisso. Caso não haja aplicação concreta, eu mesmo o informarei — não comprometerei 1 hora da sua agenda sem propósito.`, tip: "A resposta sobre 'como o processo é conduzido hoje' revela o gargalo. Registre-a literalmente — torna-se a espinha dorsal da visita SPIN." },
        { titulo: "LinkedIn — Solicitação de conexão", ctx: "D1 · LinkedIn", msg: `[Nome], identifiquei sua atuação no desenvolvimento de [produto/setor] na [empresa].\n\nAtuo com prototipagem e validação de produto no HUB SENAI Alagoas. Seria oportuno conectar para uma troca de ideias sobre processo.`, tip: "Máx. 300 caracteres. Direto e técnico. Evite 'inovação' — prefira 'processo', 'desenvolvimento', 'validação'." },
        { titulo: "LinkedIn — Mensagem após conexão aceita", ctx: "24h+ após o aceite", msg: `Prezado(a) [Nome], agradeço pela conexão.\n\nDe forma objetiva: o HUB SENAI Alagoas conduz visitas técnicas gratuitas em indústrias do estado para identificar onde a modelagem 3D e a prototipagem física reduzem retrabalho e custo de desenvolvimento.\n\nCaso seja relevante para [empresa], permaneço à disposição para combinar 1 hora na agenda de vocês.`, tip: "Aguarde ao menos 24h após o aceite. Concentre-se no benefício técnico mensurável — 'reduzir retrabalho e custo'." },
      ],
    },
    objeccoes: {
      emp: [
        { q: "Já temos parceria com o SEBRAE.", r: "Faz sentido — SEBRAE e HUB atuam de forma complementar. O SEBRAE foca em gestão; nós em inovação aplicada e capacitação ágil. Posso mostrar onde se diferenciam em 30 minutos?" },
        { q: "Não temos verba para isso agora.", r: "Entendo — por isso quero primeiro entender a demanda. A visita é gratuita e sem compromisso. Se houver fit, mostro como soluções se encaixam em editais já abertos." },
        { q: "Precisamos aprovar em comitê.", r: "Normal. A visita de diagnóstico gera os insumos que você precisa apresentar internamente — sairá com argumentos concretos para a gestão." },
        { q: "Não temos público para esse programa.", r: "Isso é o que a visita ajuda a mapear. Temos formatos para diferentes perfis — quem define é o diagnóstico do território." },
        { q: "Manda material por e-mail.", r: "Vou mandar — mas material genérico não substitui a conversa. Prefiro que o que você receba já esteja calibrado para a realidade de vocês. Teria 30 minutos essa semana?" },
      ],
      proto: [
        { q: "Já fazemos protótipos internamente.", r: "Ótimo — vocês entendem o valor do processo. A visita é para ver como é feito hoje e se há gargalo que a prototipagem do SENAI resolve mais rápido ou barato." },
        { q: "Não temos orçamento para isso.", r: "Entendo. A visita técnica é gratuita, sem compromisso. O custo de um protótipo aqui costuma ser bem menor que fabricar errado na primeira tentativa." },
        { q: "Não sei se precisamos de prototipagem.", r: "Essa dúvida é o ponto de partida da visita. Em 1h mapeio se há processo custando mais do que deveria por falta de validação. Sem fit, te digo com honestidade." },
        { q: "Nossos fornecedores já fazem isso.", r: "Faz sentido. Eles fazem modelagem 3D + simulação + protótipo físico num único lugar, com a credibilidade técnica do SENAI? A visita mostra — e aí você compara." },
        { q: "Manda portfólio que a gente vê.", r: "Vou mandar — mas portfólio genérico não mostra o relevante para o seu processo. Prefiro que a visita mostre o que se aplica ao que vocês fazem. Quando tem 1h essa semana?" },
      ],
    },
    metas: [
      { label: "Taxa de agendamento", val: "≥15%", sub: "das fichas → visitas agendadas" },
      { label: "Visitas/sprint (15 dias)", val: "≥3", sub: "por sprint de exploração" },
      { label: "Tentativas máx./lead", val: "3", sub: "ativas no mesmo ciclo D1→D10" },
    ],
    cadencia: [
      { dia: "D1", email: "Abertura personalizada", li: "Conexão", lig: "—", wa: "—" },
      { dia: "D3", email: "—", li: "—", lig: "1ª ligação", wa: "—" },
      { dia: "D5", email: "Follow-up + dado/caso", li: "DM se aceito (24h+)", lig: "—", wa: "—" },
      { dia: "D7", email: "—", li: "—", lig: "2ª ligação", wa: "WA referência" },
      { dia: "D10", email: "Encerramento", li: "—", lig: "—", wa: "—" },
      { dia: "D30+", email: "Reativação c/ gatilho", li: "Comentar post", lig: "—", wa: "—" },
    ],
  },

  visita: {
    objetivo: {
      emp: "Você é consultor, não vendedor. Quanto mais perguntas fizer e menos falar, mais o cliente confia. Saia da visita com o relatório de dores preenchido.",
      proto: "Você é consultor, não vendedor. Quanto mais perguntas fizer e menos falar, mais o cliente confia. Saia da visita com o relatório de dores preenchido.",
    },
    roteiro: [
      { badge: "00", t: "Abertura — 5 min", d: "Apresente-se brevemente. Explique: 'Vim entender como funciona [empresa/secretaria] — não vou apresentar nada hoje.' Confirme o tempo disponível." },
      { badge: "S", color: "#0055A5", t: "Perguntas de Situação — 15 min", d: "Entenda o contexto atual sem julgamento. Ouça mais do que fale. Anote tudo." },
      { badge: "P", color: "#EC5A24", t: "Perguntas de Problema — 15 min", d: "Aprofunde as dores. Não pule para soluções — o cliente precisa verbalizar o problema." },
      { badge: "I", color: "#C0392B", t: "Perguntas de Implicação — 10 min", d: "Amplie o custo de não resolver. 'Se isso continua por mais 12 meses, o que acontece com [resultado]?' Objetivo, não dramático." },
      { badge: "N", color: "#0A1628", t: "Perguntas de Necessidade — 10 min", d: "Deixe o cliente verbalizar o que precisa. Anote a necessidade nas palavras dele — vira o pitch da proposta." },
      { badge: "Ε", t: "Encerramento — 5 min", d: "Resuma o que entendeu em 2–3 pontos. Explique o próximo passo: devolutiva em até 48h. Confirme o contato." },
    ],
    spin: {
      emp: {
        S: ["Hoje existe algum programa de empreendedorismo em andamento?", "Quem costuma ser o público? (jovens, mulheres, MEIs?)", "A prefeitura já realizou parceria de capacitação antes?", "Quantas pessoas a secretaria quer alcançar?"],
        P: ["Quais os maiores obstáculos para quem quer empreender no município?", "O que impede que esses programas tenham continuidade?", "Falta acesso a mentores, crédito ou mercado?", "Como medem o sucesso de uma iniciativa de empreendedorismo?"],
        I: ["Se o problema continuar, o que acontece com os indicadores do município?", "Como isso impacta arrecadação, emprego e a imagem do gestor?", "Sem KPIs claros, como justificar o investimento?"],
        N: ["Seria valioso um programa com capacitação prática, mentoria e acompanhamento?", "Indicadores claros ajudariam na prestação de contas?", "Um formato flexível — presencial, híbrido ou itinerante — faria diferença?"],
      },
      proto: {
        S: ["Como vocês desenvolvem e testam novos produtos hoje?", "O processo depende de protótipos físicos para validar?", "A equipe tem documentação técnica atualizada das peças?", "Com que frequência lançam ou revisam produtos?"],
        P: ["Já houve retrabalho por erro de medida, encaixe ou projeto?", "Há peças antigas a reproduzir, mas sem desenho técnico?", "A falta de validação prévia já atrasou um lançamento?", "O processo atual limita a velocidade de desenvolvimento?"],
        I: ["Qual o impacto no custo e prazo se a validação continuar como está?", "Erros descobertos após fabricar em escala: quanto já custou?", "A empresa perde competitividade por não iterar mais rápido?"],
        N: ["Modelagem 3D e simulação antes de fabricar reduziria esses riscos?", "Impressão 3D, laser e CNC para protótipos físicos aceleraria o desenvolvimento?", "Documentação técnica atualizada daria mais segurança ao processo?"],
      },
    },
    mensagens: {
      emp: [
        { titulo: "WhatsApp de agradecimento — pós-visita", ctx: "Mesmo dia · obrigatório", msg: `[Nome], obrigado pela conversa de hoje.\n\nSaí com uma leitura clara do contexto de [município/secretaria] — em especial sobre [ponto concreto que o cliente mencionou].\n\nVou estruturar uma devolutiva com os caminhos possíveis e te envio até [data]. Qualquer coisa antes disso, estou por aqui.\n\n[Seu nome] · HUB SENAI Alagoas`, tip: "Cite UM ponto específico que o cliente disse. É a prova de que você ouviu de verdade — e o que separa você de 'mais um fornecedor'." },
        { titulo: "E-mail de devolutiva — 48h após visita", ctx: "Comercial ou analista", assunto: "Devolutiva do diagnóstico — [Município/Secretaria]", msg: `[Nome],\n\nComo combinado, segue a leitura do diagnóstico que fizemos em [data].\n\nO que mais ficou evidente foi [dor principal, nas palavras do cliente]. Diante disso, vejo dois caminhos concretos pelo HUB SENAI:\n\n• [Serviço 1 — descrição em 1 linha do formato e do resultado esperado]\n• [Serviço 2 — se aplicável]\n\nNenhum deles exige decisão agora. O próximo passo natural é uma conversa de 30 min para detalhar formato, prazos e como viabilizar. Fecha melhor [opção de dia] ou [opção de dia]?\n\n[Seu nome]`, tip: "Devolva a dor com as PALAVRAS do cliente — abre o e-mail com reconhecimento, não com pitch. A CTA volta com duas opções de dia." },
        { titulo: "WhatsApp — cliente não compareceu (no-show)", ctx: "Dia da visita · sem comparecimento", msg: `[Nome], passei em [local] no horário combinado e acho que cruzamos os sinais — acontece, a rotina aperta.\n\nSem problema nenhum. Quer remarcar? Me diz dois horários da próxima semana que funcionam pra você e eu me encaixo.`, tip: "No-show NUNCA é cobrado. Tom leve ('cruzamos os sinais') preserva a relação — culpa afasta, leveza reabre a porta." },
        { titulo: "E-mail — reagendamento após no-show", ctx: "1 dia após o no-show", assunto: "Vamos reencontrar uma data para [município]?", msg: `[Nome],\n\nTentamos nos encontrar [data] e não deu — sei como a agenda de gestão é imprevisível.\n\nO diagnóstico continua de pé e sem custo. Para facilitar, deixo três opções: [opção 1], [opção 2] ou [opção 3]. Basta responder com a que prefere.\n\nSe nenhuma servir, me diga o melhor período e eu me adapto.\n\n[Seu nome]`, tip: "Após no-show, ofereça MAIS opções (três) e reduza o atrito ao máximo. O cliente que faltou já sente algum desconforto — não aumente." },
      ],
      proto: [
        { titulo: "WhatsApp de agradecimento — pós-visita", ctx: "Mesmo dia · obrigatório", msg: `[Nome], obrigado pelo tempo de hoje.\n\nEntendi bem o processo de desenvolvimento de vocês — principalmente o ponto sobre [gargalo técnico que o cliente citou].\n\nVou montar a devolutiva indicando onde a prototipagem se encaixa e te envio até [data]. Fico à disposição.\n\n[Seu nome] · HUB SENAI Alagoas`, tip: "Cite o gargalo técnico exato que ele descreveu. Para engenheiro, especificidade é credibilidade." },
        { titulo: "E-mail de devolutiva — 48h após visita", ctx: "Comercial ou analista", assunto: "Devolutiva técnica — [Empresa]", msg: `[Nome],\n\nComo combinado, segue a análise após a visita de [data].\n\nO ponto central que identificamos foi [dor técnica, nas palavras do cliente]. Para isso, o HUB SENAI pode atuar com:\n\n• [Serviço — formato técnico em 1 linha]\n\nNa prática, isso significaria [benefício direto e mensurável — ex: erros detectados na bancada, não na linha de produção].\n\nPosso preparar um orçamento inicial sem compromisso. Quer que eu já avance com isso, ou prefere uma conversa técnica antes?`, tip: "Conecte a solução a uma consequência mensurável. A CTA dá ao cliente o controle do ritmo — 'avançar' ou 'conversar antes'." },
        { titulo: "WhatsApp — cliente não compareceu (no-show)", ctx: "Dia da visita · sem comparecimento", msg: `[Nome], estive em [local] no horário combinado — imagino que algo urgente surgiu na produção, acontece direto.\n\nSem stress. Quer remarcar? Me passa dois horários da próxima semana e eu organizo a visita técnica.`, tip: "Para indústria, atribua o no-show a 'algo na produção' — é plausível e tira qualquer peso do cliente." },
        { titulo: "E-mail — reagendamento após no-show", ctx: "1 dia após o no-show", assunto: "Reagendando a visita técnica — [Empresa]", msg: `[Nome],\n\nNossa visita de [data] não aconteceu — sei que imprevisto de chão de fábrica não escolhe hora.\n\nA visita técnica segue de pé, gratuita, cerca de 1h. Deixo três janelas: [opção 1], [opção 2] ou [opção 3]. Responda com a que encaixa melhor.\n\nSe preferir, me diga o período e eu me adapto à agenda de vocês.\n\n[Seu nome]`, tip: "Linguagem do mundo dele ('chão de fábrica', 'imprevisto') mostra que você entende a rotina industrial — e remove o constrangimento." },
      ],
    },
    objeccoes: {
      emp: [
        { q: "Já fazemos algo assim com outro parceiro.", r: "Que ótimo que já existe iniciativa — o que essa parceria cobre hoje? Tem algum gap ou algo que gostariam que fosse diferente?" },
        { q: "Isso é muito parecido com o SEBRAE.", r: "Tem semelhanças no objetivo, mas metodologia e foco são diferentes. Mostro o que é exclusivo do HUB depois do diagnóstico, quando soubermos o que faz sentido." },
        { q: "Município pequeno não comporta esse programa.", r: "É justamente o que o diagnóstico revela. Temos formatos adaptáveis para territórios com até 5 participantes. O que define a viabilidade é a demanda real." },
      ],
      proto: [
        { q: "Nosso processo atual funciona bem.", r: "Ótimo. Só para entender: qual o tempo médio entre o conceito de um produto e o primeiro protótipo físico? Em quantas tentativas chegam ao resultado final?" },
        { q: "Já temos fornecedores de usinagem.", r: "Faz sentido. A diferença do SENAI é unir modelagem 3D, simulação e protótipo físico no mesmo lugar, com suporte técnico em cada etapa. Seu fornecedor oferece isso?" },
        { q: "Não sei se temos escala para compensar.", r: "Entendo. Quanto costuma custar quando um erro de projeto só aparece depois da fabricação? A resposta mostra se a escala importa ou não." },
      ],
    },
    metas: [
      { label: "Relatório de dores", val: "100%", sub: "preenchido após cada visita" },
      { label: "WA de agradecimento", val: "D0", sub: "enviado no mesmo dia da visita" },
      { label: "Briefing entregue", val: "24h", sub: "após a visita para o comercial" },
    ],
    metaNota: "O que deve sair de cada visita: relatório de dores preenchido (dor nas palavras do cliente, necessidade verbalizada, serviço de fit, decisor final, objeções, próximo passo, urgência) · WA de agradecimento enviado · planilha atualizada para 'Visita realizada — aguardando proposta'.",
  },

  handoff: {
    objetivo: {
      emp: "Briefing enviado em até 24h após a visita. Um briefing incompleto é pior que nenhum — o comercial não monta a proposta certa sem contexto.",
      proto: "Briefing enviado em até 24h após a visita. Um briefing incompleto é pior que nenhum — o comercial não monta a proposta certa sem contexto.",
    },
    atividades: {
      emp: [
        { t: "Preencha o relatório de dores logo após a visita", d: "Idealmente em até 2h, com a memória fresca. Anote frases exatas do cliente — viram o pitch da proposta.", tools: ["Template Relatório de Dores"] },
        { t: "Envie o briefing para o time comercial (até 24h)", d: "Preencha o template e envie pelo canal do time. Inclua o relatório de dores como anexo. Sinal de fechamento rápido? Marque como prioridade.", tools: ["Template Briefing", "Canal do time"] },
        { t: "Envie WA de agradecimento ao cliente", d: "No mesmo dia ou dia seguinte, WA curto agradecendo e confirmando a data da devolutiva.", tools: ["Template WA Pós-visita"] },
        { t: "Atualize a planilha de leads", d: "Status para 'Visita realizada — aguardando proposta'. Registre data, pilar e serviço de fit. Alimenta os KPIs do sprint.", tools: ["Planilha de Leads"] },
      ],
      proto: [
        { t: "Preencha o relatório de dores logo após a visita", d: "Idealmente em até 2h, com a memória fresca. Anote frases exatas do cliente — viram o pitch da proposta.", tools: ["Template Relatório de Dores"] },
        { t: "Envie o briefing para o time comercial (até 24h)", d: "Preencha o template e envie pelo canal do time. Inclua o relatório de dores como anexo. Sinal de fechamento rápido? Marque como prioridade.", tools: ["Template Briefing", "Canal do time"] },
        { t: "Envie WA de agradecimento ao cliente", d: "No mesmo dia ou dia seguinte, WA curto agradecendo e confirmando a data da devolutiva.", tools: ["Template WA Pós-visita"] },
        { t: "Atualize a planilha de leads", d: "Status para 'Visita realizada — aguardando proposta'. Registre data, pilar e serviço de fit. Alimenta os KPIs do sprint.", tools: ["Planilha de Leads"] },
      ],
    },
    mensagens: {
      emp: [
        { titulo: "WhatsApp ao cliente — confirmação de devolutiva", ctx: "Mesmo dia da visita", msg: `Prezado(a) [Nome], agradeço pela conversa de hoje.\n\nEncaminharei o diagnóstico ao time e retornarei com a devolutiva até [data]. Não se trata de proposta fechada, mas dos caminhos possíveis para avaliação de vocês.\n\nPermaneço à disposição para qualquer esclarecimento nesse intervalo.\n\n[Seu nome] · HUB SENAI Alagoas`, tip: "Prometa somente a devolutiva, nunca a proposta — isso assegura ao comercial a margem para uma entrega bem elaborada e evita o risco de prometer além do previsto." },
        { titulo: "Briefing interno — para o time comercial", ctx: "Até 24h após a visita", msg: `📋 BRIEFING — Visita Técnica | [Data]\n\n▸ CLIENTE: [Nome] — [Cargo] — [Instituição]\n▸ SEGMENTO: [Ex: Prefeitura — interior de AL]\n▸ PILAR: Empreendedorismo Inovador\n\n▸ DOR PRINCIPAL (palavras do cliente):\n"[Frase exata transcrita da visita]"\n\n▸ SERVIÇO DE MAIOR FIT: [Ex: Capacitação Empreendedora]\n▸ JUSTIFICATIVA: [uma linha conectando a dor ao serviço]\n\n▸ CONTEXTO ORÇAMENTÁRIO: [há edital aberto / orçamento aprovado / depende de aprovação]\n▸ DECISOR FINAL (quem assina): [Nome e cargo]\n▸ URGÊNCIA: [prazo concreto mencionado pelo cliente]\n\n▸ OBJEÇÕES LEVANTADAS:\n— [Objeção 1]\n— [Objeção 2, se houver]\n\n▸ TEMPERATURA DO LEAD: [quente / morno / frio — com justificativa em uma linha]\n▸ PRÓXIMO PASSO COMBINADO: [ex: devolutiva até sexta-feira]\n\nRelatório de dores completo em anexo.`, tip: "O campo 'TEMPERATURA DO LEAD' orienta a priorização do comercial. Briefing específico resulta em proposta assertiva; briefing vago resulta em proposta genérica." },
        { titulo: "E-mail — contato indicado pelo decisor", ctx: "Após indicação interna", assunto: "Indicação de [Nome do decisor] — [Município]", msg: `Prezado(a) [Nome],\n\n[Nome do decisor], [cargo dele/dela], indicou seu contato após nossa conversa sobre empreendedorismo em [município].\n\nEm síntese: o HUB SENAI conduziu um diagnóstico inicial e identificou caminhos concretos na área de [tema]. [Nome do decisor] sugeriu que os detalhes fossem alinhados diretamente com você.\n\nHaveria disponibilidade para uma conversa de 30 minutos nesta semana? Sugiro [opção 1] ou [opção 2].\n\nAtenciosamente,\n[Seu nome] · HUB SENAI Alagoas`, tip: "Abrir mencionando quem indicou transfere a confiança do decisor ao novo contato — é a abordagem mais favorável possível com uma pessoa ainda desconhecida." },
      ],
      proto: [
        { titulo: "WhatsApp ao cliente — confirmação de devolutiva", ctx: "Mesmo dia da visita", msg: `Prezado(a) [Nome], agradeço pelo tempo dedicado hoje.\n\nEncaminharei o diagnóstico técnico ao time e retornarei até [data] com os pontos em que a prototipagem se aplica ao processo de vocês.\n\nPermaneço à disposição para esclarecimentos nesse intervalo.\n\n[Seu nome] · HUB SENAI Alagoas`, tip: "Conciso e técnico. Promete devolutiva, não orçamento — mantém a expectativa do cliente devidamente calibrada." },
        { titulo: "Briefing interno — para o time comercial", ctx: "Até 24h após a visita", msg: `📋 BRIEFING — Visita Técnica | [Data]\n\n▸ CLIENTE: [Nome] — [Cargo] — [Empresa]\n▸ SEGMENTO: [Ex: Manufatura metálica — AL]\n▸ PILAR: Prototipagem\n\n▸ DOR PRINCIPAL (palavras do cliente):\n"[Frase exata transcrita da visita]"\n\n▸ SERVIÇO DE MAIOR FIT: [Ex: Prototipagem Física — 3D/laser/CNC]\n▸ JUSTIFICATIVA: [uma linha conectando o gargalo técnico ao serviço]\n\n▸ PROCESSO ATUAL DO CLIENTE: [como desenvolvem e testam hoje — base do dimensionamento]\n▸ CONTEXTO ORÇAMENTÁRIO: [há orçamento / depende de aprovação / CAPEX previsto]\n▸ DECISOR FINAL (quem assina): [Nome e cargo]\n▸ URGÊNCIA: [lançamento previsto / prazo mencionado]\n\n▸ OBJEÇÕES LEVANTADAS:\n— [Objeção 1]\n— [Objeção 2, se houver]\n\n▸ TEMPERATURA DO LEAD: [quente / morno / frio — com justificativa em uma linha]\n▸ PRÓXIMO PASSO COMBINADO: [ex: orçamento inicial nesta semana]\n\nRelatório de dores completo em anexo.`, tip: "O campo 'PROCESSO ATUAL DO CLIENTE' é específico de prototipagem — o comercial depende dele para dimensionar a solução corretamente." },
        { titulo: "E-mail — contato indicado pelo decisor", ctx: "Após indicação interna", assunto: "Indicação de [Nome do decisor] — [Empresa]", msg: `Prezado(a) [Nome],\n\n[Nome do decisor], [cargo dele/dela], indicou seu contato após nossa visita técnica na [empresa].\n\nEm síntese: o HUB SENAI mapeou o processo de desenvolvimento de vocês e identificou onde a modelagem 3D e a prototipagem podem reduzir [retrabalho / custo / tempo]. [Nome do decisor] sugeriu que os detalhes técnicos fossem alinhados diretamente com você.\n\nHaveria disponibilidade para uma conversa de 30 minutos nesta semana? Sugiro [opção 1] ou [opção 2].\n\nAtenciosamente,\n[Seu nome] · HUB SENAI Alagoas`, tip: "A indicação interna é um ativo valioso — o novo contato recebe o analista com a confiança transferida de quem indicou. Mencione o nome logo na primeira linha." },
      ],
    },
    objeccoes: { emp: [], proto: [] },
    metas: [
      { label: "Prazo do briefing", val: "24h", sub: "após a visita, sem exceção" },
      { label: "Completude", val: "100%", sub: "dos campos obrigatórios preenchidos" },
      { label: "WA ao cliente", val: "D0", sub: "no mesmo dia da visita" },
    ],
    metaNota: "O briefing precisa ter: nome e cargo do cliente · segmento e porte · dor principal (palavras do cliente) · pilar de fit · serviço com maior chance de fechamento · contexto orçamentário · decisor final · objeções · urgência · maturidade · concorrentes mencionados · próximo passo combinado.",
  },
};

/* ════════════════ HELPERS ════════════════ */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysDiff = (iso) => {
  if (!iso) return null;
  return Math.round((new Date(iso + "T00:00") - new Date(todayISO() + "T00:00")) / 86400000);
};
const blankLead = (pillar = "emp") => ({
  id: uid(), stage: "mapeamento", pillar, org: "", segment: "", decisorNome: "", decisorCargo: "",
  contato: "", dor: "", fit: [], responsaveis: [], canal: "E-mail", proxContato: "", dataVisita: "",
  objecoes: "", relatorioDores: "", briefingEnviado: false, dataEntradaHandoff: "", checks: {},
  createdAt: todayISO(),
});
const SEED = [
  { ...blankLead("emp"), org: "Prefeitura de Arapiraca", segment: "Prefeitura — interior",
    decisorNome: "—", decisorCargo: "Sec. de Desenvolvimento Econômico", contato: "",
    dor: "Alta informalidade entre jovens", fit: ["EDUCAÇÃO EMPREENDEDORA E NOVOS NEGÓCIOS"],
    responsaveis: ["Marcel Muller"], stage: "mapeamento" },
  { ...blankLead("proto"), org: "MetalNorte Indústria", segment: "Manufatura metálica",
    decisorNome: "Carlos R.", decisorCargo: "Gerente de Engenharia", contato: "(82) 9xxxx-xxxx",
    dor: "Retrabalho por erro de encaixe", fit: ["PROTOTIPAGEM"],
    responsaveis: ["Wesley Andrade", "Helder Junior"], canal: "LinkedIn",
    proxContato: todayISO(), stage: "exploracao" },
];
/* ════════════════ TEMPLATES INTELIGENTES ════════════════ */
/* substitui placeholders [..] de um template pelos dados reais do lead */
function fillTemplate(txt, lead) {
  if (!lead) return txt;
  const map = [
    [/\[empresa\/instituição\]|\[empresa\/secretaria\]/gi, lead.org],
    [/\[empresa\]/gi, lead.org],
    [/\[município\/secretaria\]|\[secretaria\/município\]/gi, lead.org],
    [/\[município\]/gi, lead.org],
    [/\[instituição\]/gi, lead.org],
    [/\[nome\]/gi, lead.decisorNome],
    [/\[cargo\]/gi, lead.decisorCargo],
    [/\[secretário de desenvolvimento[^\]]*\]/gi, lead.decisorCargo],
    [/\[gerente de engenharia[^\]]*\]/gi, lead.decisorCargo],
    [/\[setor\]|\[x\]/gi, lead.segment],
    [/\[produto\/setor\]/gi, lead.segment],
    [/\[dor principal[^\]]*\]|\[dor[^\]]*\]/gi, lead.relatorioDores || lead.dor],
    [/\[serviço 1[^\]]*\]|\[serviço[^\]]*\]/gi, Array.isArray(lead.fit) ? lead.fit.join(", ") : lead.fit],
  ];
  let out = txt;
  for (const [re, val] of map) {
    if (val && String(val).trim()) out = out.replace(re, String(val).trim());
  }
  return out;
}

/* ════════════════ GERADOR DE BRIEFING ════════════════ */
function buildBriefing(lead) {
  const P = PILLARS[lead.pillar];
  const v = (x, fb) => (x && String(x).trim() ? x : fb);
  const dor = lead.relatorioDores && lead.relatorioDores.trim()
    ? lead.relatorioDores.trim() : v(lead.dor, "[preencher — dor principal nas palavras do cliente]");
  const objs = lead.objecoes && lead.objecoes.trim()
    ? lead.objecoes.trim().split(/\n+/).map((o) => "— " + o.replace(/^—\s*/, "")).join("\n")
    : "— [nenhuma objeção registrada]";
  const fitStr = Array.isArray(lead.fit) && lead.fit.length > 0
    ? lead.fit.map((s) => "• " + s).join("\n")
    : "[serviço(s) de fit]";
  const respStr = Array.isArray(lead.responsaveis) && lead.responsaveis.length > 0
    ? lead.responsaveis.join(", ") : "[responsável]";
  return `📋 BRIEFING — Visita Técnica | ${new Date().toLocaleDateString("pt-BR")}

Cliente: ${v(lead.decisorNome, "[nome]")} — ${v(lead.decisorCargo, "[cargo]")} — ${v(lead.org, "[empresa/instituição]")}
Segmento: ${v(lead.segment, "[segmento]")}
Pilar: ${P.label}
Responsável(eis) HUB: ${respStr}

DOR PRINCIPAL (palavras do cliente):
"${dor}"

SERVIÇO(S) DE MAIOR FIT:
${fitStr}

CONTEXTO ORÇAMENTÁRIO: [preencher — há edital / budget aprovado / precisa aprovação]
DECISOR FINAL: ${v(lead.decisorNome, "[nome]")} — ${v(lead.decisorCargo, "[cargo de quem assina]")}
URGÊNCIA: [preencher — prazo mencionado pelo cliente]

OBJEÇÕES LEVANTADAS:
${objs}

CANAL DE CONTATO: ${v(lead.canal, "—")}${lead.contato ? " · " + lead.contato : ""}
DATA DA VISITA: ${lead.dataVisita ? new Date(lead.dataVisita + "T00:00").toLocaleDateString("pt-BR") : "[preencher]"}

PRÓXIMO PASSO COMBINADO: [preencher — ex: devolutiva até sexta]

Relatório de dores completo em anexo.`;
}

/* ════════════════ APP ════════════════ */
export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated);
  const [view, setView] = useState("kanban");        // kanban | guia
  const [leads, setLeads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [saveErr, setSaveErr] = useState("");
  const [diag, setDiag] = useState(null);   // resultado do probe diagnoseConnection
  const [briefingLead, setBriefingLead] = useState(null);
  const [guiaLead, setGuiaLead] = useState(null);   // lead que originou a navegação ao guia
  /* guia state */
  const [guiaStage, setGuiaStage] = useState("mapeamento");
  const [guiaPillar, setGuiaPillar] = useState("emp");
  const [guiaTab, setGuiaTab] = useState("atividades");

  // Registra o erro real do Supabase e roda um probe (leitura/escrita/exclusão) para isolar a causa.
  const reportErr = useCallback((e, fallback) => {
    const msg = formatSupabaseError(e) || fallback;
    console.error("[Supabase]", fallback, e);
    setSaveErr(msg);
    diagnoseConnection().then(setDiag).catch(() => {});
  }, []);

  useEffect(() => {
    if (!authed) return;            // só carrega dados após o login
    if (!isSupabaseConfigured()) {
      setLoaded(true);
      return;
    }
    // Render instantâneo a partir do cache local; o Supabase revalida em segundo plano.
    const cached = readCachedLeads();
    if (cached?.length) {
      setLeads(cached.map(normalizeLead));
      setLoaded(true);
    }
    (async () => {
      try {
        const remote = await fetchLeads();
        const legacy = readLegacyLeads();
        if (remote.length > 0) {
          // Supabase é a fonte compartilhada da verdade quando tem dados.
          const normalized = remote.map(normalizeLead);
          setLeads(normalized);
          writeCachedLeads(normalized);
        } else if (cached?.length) {
          // Supabase vazio, mas há dados locais: sobe o local — NUNCA apaga o que já existe.
          await saveLeads(cached);
          writeCachedLeads(cached);
        } else {
          // Tudo vazio = primeira vez: semeia (migra legado se houver).
          const initial = (legacy?.length ? legacy : SEED).map(normalizeLead);
          await saveLeads(initial);
          setLeads(initial);
          writeCachedLeads(initial);
        }
        if (legacy?.length) clearLegacyLeads();
        setSaveErr(""); setDiag(null);
      } catch (e) {
        // Falha de rede/RLS: preserva o que estiver no cache; só semeia se não houver nada.
        if (!cached?.length) setLeads(SEED.map(normalizeLead));
        reportErr(e, "Falha ao carregar do Supabase");
      }
      setLoaded(true);
    })();
  }, [authed, reportErr]);

  const persist = useCallback(async (data) => {
    const normalized = data.map(normalizeLead);
    writeCachedLeads(normalized);          // salva local primeiro — garantido, nunca perde
    if (!isSupabaseConfigured()) return;
    try {
      await saveLeads(normalized);
      setSaveErr(""); setDiag(null);
    } catch (e) {
      reportErr(e, "Falha ao salvar no Supabase");
    }
  }, [reportErr]);
  const update = (data) => { setLeads(data); persist(data); };

  const saveLead = (lead) => {
    const normalized = normalizeLead(lead);
    const exists = leads.some((l) => l.id === normalized.id);
    update(exists ? leads.map((l) => (l.id === normalized.id ? normalized : l)) : [...leads, normalized]);
    setEditing(null);
  };
  const delLead = (id) => {
    const prev = leads;
    const next = leads.filter((l) => l.id !== id);
    setLeads(next);
    writeCachedLeads(next.map(normalizeLead));   // salva local primeiro — garantido
    if (!isSupabaseConfigured()) return;
    deleteLeadById(id)
      .then(() => { setSaveErr(""); setDiag(null); })
      .catch((e) => {
        setLeads(prev); writeCachedLeads(prev.map(normalizeLead));
        reportErr(e, "Falha ao excluir no Supabase");
      });
  };
  const dropTo = (stageId) => {
    if (!dragId) return;
    update(leads.map((l) => l.id === dragId
      ? { ...l, stage: stageId,
          dataEntradaHandoff: stageId === "handoff" && !l.dataEntradaHandoff ? todayISO() : l.dataEntradaHandoff }
      : l));
    setDragId(null); setDragOver(null);
  };
  const toggleCheck = (lead, idx) => {
    const checks = { ...lead.checks, [lead.stage + ":" + idx]: !lead.checks[lead.stage + ":" + idx] };
    update(leads.map((l) => (l.id === lead.id ? { ...l, checks } : l)));
  };
  const openGuia = (lead) => {
    setGuiaStage(lead.stage); setGuiaPillar(lead.pillar); setGuiaTab("atividades");
    setGuiaLead(lead); setView("guia");
    window.scrollTo(0, 0);
  };

  const shown = leads.filter((l) => filter === "all" || l.pillar === filter);
  const fichaCompleta = (l) =>
    l.org && l.segment && l.decisorNome && l.contato && l.dor && l.fit && l.fit.length > 0 && l.proxContato;
  const checkProgress = (lead) => {
    const list = CHECKLISTS[lead.stage];
    const done = list.filter((_, i) => lead.checks[lead.stage + ":" + i]).length;
    return { done, total: list.length, pct: Math.round((done / list.length) * 100) };
  };
  const kpi = {
    total: shown.length,
    fichasOk: shown.filter(fichaCompleta).length,
    visitas: shown.filter((l) => STAGE_IDX[l.stage] >= 2).length,
    handoff: shown.filter((l) => l.stage === "handoff").length,
  };
  const taxaAgenda = kpi.total ? Math.round((kpi.visitas / kpi.total) * 100) : 0;

  const alertaContato = (l) => {
    if (l.stage !== "mapeamento" && l.stage !== "exploracao") return null;
    const d = daysDiff(l.proxContato);
    if (d === null) return null;
    if (d < 0) return { txt: `Contato vencido há ${-d}d`, urgent: true };
    if (d === 0) return { txt: "Contato hoje", urgent: false };
    return null;
  };
  const alertaBriefing = (l) => {
    if (l.stage !== "handoff" || l.briefingEnviado) return null;
    const d = daysDiff(l.dataEntradaHandoff);
    if (d === null) return null;
    if (-d >= 1) return { txt: `Briefing atrasado (${-d}d)`, urgent: true };
    return { txt: "Briefing pendente (24h)", urgent: false };
  };

  const logout = () => { setAuthenticated(false); setAuthed(false); };

  if (!authed) return <Login onSuccess={() => { setAuthenticated(true); setAuthed(true); }} />;

  if (!isSupabaseConfigured()) return <SupabaseSetup />;

  if (!loaded)
    return <div style={{ padding: 40, fontFamily: "system-ui", color: C.ink3 }}>Carregando do Supabase…</div>;

  return (
    <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif", background: C.bg, minHeight: "100vh", color: C.ink }}>
      {/* ══ HEADER ══ */}
      <div style={{ background: C.ink, padding: "18px 26px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase",
            color: C.orange, marginBottom: 4 }}>HUB SENAI Alagoas · Sistema Operacional</div>
          <button onClick={logout} title="Sair"
            style={{ flexShrink: 0, background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.75)",
              border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600,
              cursor: "pointer" }}>
            Sair
          </button>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>Geração de Visitas Técnicas</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 3, marginBottom: 14 }}>
          Guia operacional + gestão Kanban do funil · 2026</div>
        {/* view switch */}
        <div style={{ display: "flex", gap: 4 }}>
          <ViewTab active={view === "kanban"} onClick={() => setView("kanban")} icon="▦" label="Kanban Vivo" />
          <ViewTab active={view === "dashboard"} onClick={() => setView("dashboard")} icon="📊" label="Dashboard" />
          <ViewTab active={view === "guia"} onClick={() => setView("guia")} icon="📖" label="Guia Operacional" />
        </div>
      </div>

      {view === "kanban" && (
        <KanbanView {...{ shown, kpi, taxaAgenda, filter, setFilter, setEditing, saveErr, diag,
          dragOver, setDragOver, setDragId, dropTo, checkProgress, alertaContato, alertaBriefing,
          fichaCompleta, toggleCheck, openGuia, setBriefingLead }} />
      )}
      {view === "dashboard" && (
        <DashboardView leads={leads} onOpenLead={setEditing} />
      )}
      {view === "guia" && (
        <GuiaView {...{ guiaStage, setGuiaStage, guiaPillar, setGuiaPillar, guiaTab, setGuiaTab,
          guiaLead, setGuiaLead }} />
      )}

      {editing && <Modal lead={editing} onClose={() => setEditing(null)} onSave={saveLead} onDelete={delLead} />}
      {briefingLead && <BriefingModal lead={briefingLead} onClose={() => setBriefingLead(null)} />}
    </div>
  );
}

/* ════════════════ VIEW TAB ════════════════ */
function ViewTab({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick}
      style={{ padding: "9px 18px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
        borderRadius: "8px 8px 0 0", background: active ? C.bg : "rgba(255,255,255,.07)",
        color: active ? C.ink : "rgba(255,255,255,.55)" }}>
      {icon} {label}
    </button>
  );
}

/* ════════════════ KANBAN VIEW ════════════════ */
function KanbanView({ shown, kpi, taxaAgenda, filter, setFilter, setEditing, saveErr, diag,
  dragOver, setDragOver, setDragId, dropTo, checkProgress, alertaContato, alertaBriefing,
  fichaCompleta, toggleCheck, openGuia, setBriefingLead }) {
  return (
    <>
      <div style={{ display: "flex", gap: 10, padding: "16px 26px 0", flexWrap: "wrap" }}>
        <Kpi label="Fichas no funil" val={kpi.total} sub={`${kpi.fichasOk} completas`} color={C.navy} />
        <Kpi label="Visitas agendadas" val={kpi.visitas} sub="etapa Visita + Handoff" color="#1565C0" />
        <Kpi label="Taxa de agendamento" val={taxaAgenda + "%"} sub="meta ≥ 15%" color={C.orange}
          warn={kpi.total >= 5 && taxaAgenda < 15} />
        <Kpi label="Handoffs pendentes" val={kpi.handoff} sub="briefing p/ comercial" color={C.emp} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "16px 26px 4px", flexWrap: "wrap", alignItems: "center" }}>
        <FilterBtn active={filter === "all"} onClick={() => setFilter("all")} label="Todos" />
        <FilterBtn active={filter === "emp"} onClick={() => setFilter("emp")}
          label="🚀 Empreendedorismo" color={C.emp} bg={C.empBg} />
        <FilterBtn active={filter === "proto"} onClick={() => setFilter("proto")}
          label="🔩 Prototipagem" color={C.proto} bg={C.protoBg} />
        <div style={{ flex: 1 }} />
        <button onClick={() => setEditing(blankLead(filter === "proto" ? "proto" : "emp"))}
          style={{ background: C.orange, color: "#fff", border: "none", borderRadius: 8,
            padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Novo lead
        </button>
      </div>

      {saveErr && (
        <div style={{ margin: "8px 26px 0", padding: "10px 12px", background: C.redBg,
          border: `1px solid ${C.red}`, borderRadius: 8, fontSize: 12, color: C.red }}>
          ⚠ Não foi possível salvar no Supabase. Verifique conexão, tabela hub_leads e políticas RLS.
          <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 11, opacity: .9, wordBreak: "break-word" }}>
            {saveErr}
          </div>
          {diag && (
            <div style={{ marginTop: 8, fontSize: 11 }}>
              <div style={{ opacity: .9 }}>Projeto Supabase em uso: <strong>{diag.host}</strong></div>
              <div style={{ fontFamily: "monospace", marginTop: 4, lineHeight: 1.7 }}>
                {diag.steps.map((s) => (
                  <div key={s.step}>
                    {s.ok ? "✓" : "✗"} {s.step}{s.error ? ` — ${s.error}` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, padding: "16px 26px 40px", overflowX: "auto", alignItems: "flex-start" }}>
        {STAGES.map((stage) => {
          const cards = shown.filter((l) => l.stage === stage.id);
          return (
            <div key={stage.id}
              onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id); }}
              onDragLeave={() => setDragOver((p) => (p === stage.id ? null : p))}
              onDrop={() => dropTo(stage.id)}
              style={{ minWidth: 290, width: 290, flexShrink: 0,
                background: dragOver === stage.id ? C.bg2 : "transparent", borderRadius: 12,
                transition: "background .12s",
                outline: dragOver === stage.id ? `2px dashed ${stage.color}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 12px" }}>
                <span style={{ fontSize: 16 }}>{stage.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{stage.name}</div>
                  <div style={{ fontSize: 10, color: C.ink3 }}>{stage.desc}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, background: stage.color, color: "#fff",
                  borderRadius: 20, padding: "2px 9px", minWidth: 24, textAlign: "center" }}>
                  {cards.length}
                </span>
              </div>
              {cards.length === 0 && (
                <div style={{ fontSize: 11, color: C.ink3, textAlign: "center", padding: "20px 0",
                  border: `1px dashed ${C.border}`, borderRadius: 10 }}>Sem leads aqui</div>
              )}
              {cards.map((lead) => (
                <Card key={lead.id} lead={lead} stage={stage} progress={checkProgress(lead)}
                  alertC={alertaContato(lead)} alertB={alertaBriefing(lead)} fichaOk={fichaCompleta(lead)}
                  onEdit={() => setEditing(lead)} onDragStart={() => setDragId(lead.id)}
                  onToggle={(i) => toggleCheck(lead, i)} onGuia={() => openGuia(lead)}
                  onBriefing={() => setBriefingLead(lead)} />
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ════════════════ DASHBOARD VIEW ════════════════ */
function DashboardView({ leads, onOpenLead }) {
  const [pillarFilter, setPillarFilter] = useState("all");

  const filtered = useMemo(() =>
    leads.filter((l) => pillarFilter === "all" || l.pillar === pillarFilter),
    [leads, pillarFilter]
  );

  /* ── métricas ── */
  const m = useMemo(() => {
    const total = filtered.length;
    const fichaOk = filtered.filter((l) =>
      l.org && l.segment && l.decisorNome && l.contato && l.dor &&
      Array.isArray(l.fit) && l.fit.length > 0 && l.proxContato).length;
    const visitas = filtered.filter((l) => STAGE_IDX[l.stage] >= 2).length;
    const handoffPend = filtered.filter((l) => l.stage === "handoff" && !l.briefingEnviado).length;

    /* alertas: contato vencido OU briefing atrasado */
    const today = todayISO();
    const dDiff = (iso) => iso ? Math.round((new Date(iso + "T00:00") - new Date(today + "T00:00")) / 86400000) : null;
    const alertas = filtered.filter((l) => {
      if ((l.stage === "mapeamento" || l.stage === "exploracao") && l.proxContato) {
        const d = dDiff(l.proxContato); if (d !== null && d < 0) return true;
      }
      if (l.stage === "handoff" && !l.briefingEnviado && l.dataEntradaHandoff) {
        const d = dDiff(l.dataEntradaHandoff); if (d !== null && -d >= 1) return true;
      }
      return false;
    });

    /* contagem por etapa */
    const porEtapa = STAGES.map((s) => ({
      etapa: s.name, id: s.id, color: s.color,
      n: filtered.filter((l) => l.stage === s.id).length,
    }));
    /* taxa de conversão entre etapas (acumulado) */
    const conv = porEtapa.map((e, i) => {
      if (i === 0) return { ...e, conv: null };
      const prev = porEtapa[i - 1].n;
      return { ...e, conv: prev > 0 ? Math.round((e.n / prev) * 100) : null };
    });

    /* carga por responsável (com breakdown por etapa) */
    const porResp = {};
    filtered.forEach((l) => {
      (l.responsaveis || []).forEach((r) => {
        if (!porResp[r]) porResp[r] = { name: r, total: 0,
          mapeamento: 0, exploracao: 0, visita: 0, handoff: 0 };
        porResp[r].total += 1;
        porResp[r][l.stage] += 1;
      });
    });
    const respArr = Object.values(porResp).sort((a, b) => b.total - a.total);

    /* distribuição por pilar */
    const porPilar = Object.entries(PILLARS).map(([k, p]) => ({
      name: p.label, key: k, color: p.color,
      value: filtered.filter((l) => l.pillar === k).length,
    })).filter((x) => x.value > 0);

    /* top serviços (fit) */
    const fitCount = {};
    filtered.forEach((l) => {
      (l.fit || []).forEach((s) => { fitCount[s] = (fitCount[s] || 0) + 1; });
    });
    const fitArr = Object.entries(fitCount).map(([s, n]) => ({ name: s, n }))
      .sort((a, b) => b.n - a.n).slice(0, 8);

    /* canais */
    const canalCount = {};
    filtered.forEach((l) => { if (l.canal) canalCount[l.canal] = (canalCount[l.canal] || 0) + 1; });
    const CANAL_COLORS = { "E-mail": "#0055A5", LinkedIn: "#1565C0", Telefone: "#EC5A24",
      WhatsApp: "#1A7A4A", Presencial: "#6C47D9" };
    const canalArr = Object.entries(canalCount)
      .map(([name, value]) => ({ name, value, color: CANAL_COLORS[name] || "#7A8EAA" }))
      .sort((a, b) => b.value - a.value);

    /* próximos contatos (7 dias) */
    const proximos = filtered.filter((l) => l.proxContato).map((l) => {
      const d = dDiff(l.proxContato);
      return { lead: l, d };
    }).filter(({ d }) => d !== null && d >= 0 && d <= 7).sort((a, b) => a.d - b.d);

    return { total, fichaOk, visitas, handoffPend, alertas, porEtapa: conv,
      respArr, porPilar, fitArr, canalArr, proximos };
  }, [filtered]);

  const taxaConv = m.total ? Math.round((m.visitas / m.total) * 100) : 0;

  return (
    <div style={{ padding: "20px 26px 50px", background: C.bg }}>
      {/* filtro */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
          color: C.ink3 }}>Filtrar por pilar:</span>
        <FilterBtn active={pillarFilter === "all"} onClick={() => setPillarFilter("all")} label="Todos" />
        <FilterBtn active={pillarFilter === "emp"} onClick={() => setPillarFilter("emp")}
          label="🚀 Empreendedorismo" color={C.emp} bg={C.empBg} />
        <FilterBtn active={pillarFilter === "proto"} onClick={() => setPillarFilter("proto")}
          label="🔩 Prototipagem" color={C.proto} bg={C.protoBg} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: C.ink3 }}>
          {m.total} {m.total === 1 ? "lead" : "leads"} considerado{m.total === 1 ? "" : "s"}
        </span>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))",
        gap: 10, marginBottom: 22 }}>
        <Kpi label="No funil" val={m.total} sub="leads ativos" color={C.navy} />
        <Kpi label="Fichas completas" val={m.fichaOk}
          sub={m.total ? `${Math.round((m.fichaOk / m.total) * 100)}% do total` : "—"} color="#1565C0" />
        <Kpi label="Visitas agendadas" val={m.visitas} sub="visita + handoff" color="#1565C0" />
        <Kpi label="Conversão" val={taxaConv + "%"} sub="mapeamento → visita" color={C.orange}
          warn={m.total >= 5 && taxaConv < 15} />
        <Kpi label="Alertas" val={m.alertas.length} sub="prazos vencidos" color={C.red}
          warn={m.alertas.length > 0} />
        <Kpi label="Handoffs pendentes" val={m.handoffPend} sub="briefing por enviar" color={C.emp} />
      </div>

      {/* FUNIL + PILAR */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 18 }}>
        <DashCard title="Funil de conversão" subtitle="Distribuição por etapa + taxa de conversão entre fases">
          <FunilChart data={m.porEtapa} />
        </DashCard>
        <DashCard title="Distribuição por pilar" subtitle="Participação no funil">
          <PilarDonut data={m.porPilar} />
        </DashCard>
      </div>

      {/* CARGA POR RESPONSÁVEL */}
      <DashCard title="Carga por responsável" subtitle="Quantos leads cada pessoa carrega, abertos por etapa">
        <RespBars data={m.respArr} />
      </DashCard>

      {/* SERVIÇOS + CANAIS */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginTop: 18 }}>
        <DashCard title="Top serviços de fit" subtitle="Serviços mais selecionados como aderentes">
          <ServicosBars data={m.fitArr} />
        </DashCard>
        <DashCard title="Canais de abordagem" subtitle="Canal preferido registrado nos leads">
          <CanaisDonut data={m.canalArr} />
        </DashCard>
      </div>

      {/* SAÚDE + PRÓXIMOS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}>
        <DashCard title={`Saúde do funil — ${m.alertas.length} ${m.alertas.length === 1 ? "alerta" : "alertas"}`}
          subtitle="Leads que demandam ação imediata · clique para abrir">
          <SaudeList alertas={m.alertas} onOpen={onOpenLead} />
        </DashCard>
        <DashCard title={`Próximos contatos (7 dias) — ${m.proximos.length}`}
          subtitle="Agenda planejada · clique para abrir o lead">
          <ProximosList proximos={m.proximos} onOpen={onOpenLead} />
        </DashCard>
      </div>
    </div>
  );
}

/* ── Dash card wrapper ── */
function DashCard({ title, subtitle, children }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: C.ink3, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

/* ── Funil ── */
function FunilChart({ data }) {
  if (data.every((d) => d.n === 0))
    return <Empty>Sem leads para exibir o funil.</Empty>;
  return (
    <div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
            <XAxis dataKey="etapa" tick={{ fontSize: 11, fill: C.ink2 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.ink3 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: C.bg2 }} contentStyle={chartTooltipStyle} />
            <Bar dataKey="n" radius={[6, 6, 0, 0]}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* taxas de conversão entre etapas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginTop: 10 }}>
        {data.map((d, i) => (
          <div key={d.id} style={{ background: C.bg, borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.ink3, fontWeight: 600, letterSpacing: ".05em",
              textTransform: "uppercase" }}>{d.etapa}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: d.color, lineHeight: 1.1, marginTop: 3 }}>{d.n}</div>
            {d.conv !== null && (
              <div style={{ fontSize: 9, color: C.ink3, marginTop: 2 }}>
                {d.conv}% da etapa anterior
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Donut por pilar ── */
function PilarDonut({ data }) {
  if (data.length === 0) return <Empty>Sem dados.</Empty>;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div style={{ height: 160 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64}
              paddingAngle={2}>
              {data.map((d, i) => <Cell key={i} fill={d.color} stroke="#fff" strokeWidth={2} />)}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        {data.map((d) => (
          <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
            <span style={{ color: C.ink2, flex: 1 }}>{d.name}</span>
            <span style={{ fontWeight: 700, color: d.color }}>{d.value}</span>
            <span style={{ fontSize: 10, color: C.ink3, minWidth: 32, textAlign: "right" }}>
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Barras por responsável (empilhadas por etapa) ── */
function RespBars({ data }) {
  if (data.length === 0)
    return <Empty>Nenhum responsável atribuído ainda. Atribua pessoas a partir do modal de edição.</Empty>;
  const max = Math.max(...data.map((r) => r.total));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((r) => (
        <div key={r.name} style={{ display: "grid", gridTemplateColumns: "175px 1fr 36px",
          gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar name={r.name} size={22} />
            <span style={{ fontSize: 12, color: C.ink2, fontWeight: 500 }}>{r.name}</span>
          </div>
          <div style={{ display: "flex", height: 16, borderRadius: 4, overflow: "hidden",
            background: C.bg2, width: `${(r.total / max) * 100}%`, minWidth: 4 }}>
            {STAGES.map((s) =>
              r[s.id] > 0 && (
                <div key={s.id} title={`${s.name}: ${r[s.id]}`}
                  style={{ background: s.color, flex: r[s.id], minWidth: 3 }} />
              )
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink2, textAlign: "right" }}>{r.total}</div>
        </div>
      ))}
      {/* legenda */}
      <div style={{ display: "flex", gap: 14, marginTop: 8, paddingTop: 10,
        borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
        {STAGES.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: C.ink3 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Barras top serviços ── */
function ServicosBars({ data }) {
  if (data.length === 0) return <Empty>Nenhum serviço selecionado ainda.</Empty>;
  const max = Math.max(...data.map((d) => d.n));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {data.map((d, i) => (
        <div key={d.name} style={{ display: "grid", gridTemplateColumns: "1fr 36px",
          gap: 8, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11.5, color: C.ink2, marginBottom: 3, lineHeight: 1.3 }}>{d.name}</div>
            <div style={{ height: 7, background: C.bg2, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(d.n / max) * 100}%`,
                background: i === 0 ? C.orange : (i < 3 ? C.navy : "#7A8EAA"),
                borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink2, textAlign: "right" }}>{d.n}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Donut canais ── */
function CanaisDonut({ data }) {
  if (data.length === 0) return <Empty>Sem dados de canal.</Empty>;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div style={{ height: 130 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={32} outerRadius={52} paddingAngle={2}>
              {data.map((d, i) => <Cell key={i} fill={d.color} stroke="#fff" strokeWidth={2} />)}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color }} />
            <span style={{ color: C.ink2, flex: 1 }}>{d.name}</span>
            <span style={{ fontWeight: 700, color: d.color, minWidth: 22, textAlign: "right" }}>{d.value}</span>
            <span style={{ fontSize: 10, color: C.ink3, minWidth: 30, textAlign: "right" }}>
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Lista de saúde ── */
function SaudeList({ alertas, onOpen }) {
  if (alertas.length === 0)
    return <Empty positive>✓ Nenhum prazo vencido. Funil está saudável.</Empty>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
      {alertas.map((l) => {
        let txt = "";
        if (l.stage === "handoff" && !l.briefingEnviado && l.dataEntradaHandoff) {
          const d = Math.round((new Date(l.dataEntradaHandoff + "T00:00") - new Date(todayISO() + "T00:00")) / 86400000);
          txt = `Briefing atrasado (${-d}d)`;
        } else if (l.proxContato) {
          const d = Math.round((new Date(l.proxContato + "T00:00") - new Date(todayISO() + "T00:00")) / 86400000);
          txt = `Contato vencido há ${-d}d`;
        }
        const stage = STAGES[STAGE_IDX[l.stage]];
        return (
          <button key={l.id} onClick={() => onOpen(l)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
              background: C.bg, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.red}`,
              borderRadius: 6, cursor: "pointer", textAlign: "left", width: "100%" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis" }}>{l.org}</div>
              <div style={{ fontSize: 10, color: C.ink3 }}>{stage.name}</div>
            </div>
            {Array.isArray(l.responsaveis) && l.responsaveis.length > 0 && (
              <AvatarStack names={l.responsaveis} max={2} size={18} />
            )}
            <span style={{ fontSize: 10, fontWeight: 600, color: C.red, background: C.redBg,
              padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>{txt}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Próximos contatos ── */
function ProximosList({ proximos, onOpen }) {
  if (proximos.length === 0)
    return <Empty>Sem contatos planejados para os próximos 7 dias.</Empty>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
      {proximos.map(({ lead: l, d }) => {
        const stage = STAGES[STAGE_IDX[l.stage]];
        const label = d === 0 ? "Hoje" : d === 1 ? "Amanhã" : `Em ${d} dias`;
        return (
          <button key={l.id} onClick={() => onOpen(l)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
              background: C.bg, border: `1px solid ${C.border}`, borderLeft: `3px solid ${stage.color}`,
              borderRadius: 6, cursor: "pointer", textAlign: "left", width: "100%" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis" }}>{l.org}</div>
              <div style={{ fontSize: 10, color: C.ink3 }}>{stage.name} · {l.canal}</div>
            </div>
            {Array.isArray(l.responsaveis) && l.responsaveis.length > 0 && (
              <AvatarStack names={l.responsaveis} max={2} size={18} />
            )}
            <span style={{ fontSize: 10, fontWeight: 600, color: stage.color, background: stage.color + "18",
              padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── helpers de dashboard ── */
const chartTooltipStyle = {
  background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
  fontSize: 11, padding: "6px 9px", boxShadow: "0 4px 12px rgba(0,0,0,.08)",
};
function Empty({ children, positive }) {
  return (
    <div style={{ padding: "22px 12px", textAlign: "center", fontSize: 11.5,
      color: positive ? C.proto : C.ink3, fontStyle: positive ? "normal" : "italic" }}>
      {children}
    </div>
  );
}

/* ════════════════ CARD ════════════════ */
function Card({ lead, stage, progress, alertC, alertB, fichaOk, onEdit, onDragStart, onToggle, onGuia, onBriefing }) {
  const [open, setOpen] = useState(false);
  const P = PILLARS[lead.pillar];
  const alert = alertB || alertC;
  return (
    <div draggable onDragStart={onDragStart}
      style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 10,
        boxShadow: "0 1px 3px rgba(0,0,0,.06)", borderLeft: `3px solid ${P.color}`, cursor: "grab" }}>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{lead.org || "Lead sem nome"}</div>
            <div style={{ fontSize: 10, color: C.ink3, marginTop: 1 }}>{lead.segment || "—"}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 12,
              background: P.bg, color: P.color, whiteSpace: "nowrap" }}>{P.icon} {P.short}</span>
            {Array.isArray(lead.responsaveis) && lead.responsaveis.length > 0 && (
              <AvatarStack names={lead.responsaveis} max={3} size={20} />
            )}
          </div>
        </div>
        {lead.decisorNome && (
          <div style={{ fontSize: 11, color: C.ink2, marginTop: 6 }}>
            👤 {lead.decisorNome}{lead.decisorCargo ? ` · ${lead.decisorCargo}` : ""}
          </div>
        )}
        {lead.dor && (
          <div style={{ fontSize: 11, color: C.ink2, marginTop: 3, fontStyle: "italic" }}>⚠ {lead.dor}</div>
        )}
        {Array.isArray(lead.fit) && lead.fit.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
            {lead.fit.slice(0, 2).map((s) => (
              <span key={s} style={{ fontSize: 9, fontWeight: 500, padding: "2px 6px", borderRadius: 4,
                background: P.bg, color: P.color, border: `1px solid ${P.color}33` }}>
                {s.length > 32 ? s.slice(0, 30) + "…" : s}
              </span>
            ))}
            {lead.fit.length > 2 && (
              <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                background: C.bg2, color: C.ink3 }}>
                +{lead.fit.length - 2}
              </span>
            )}
          </div>
        )}
        {(alert || (lead.stage === "mapeamento" && !fichaOk)) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
            {alert && (
              <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
                background: alert.urgent ? C.redBg : "#FEF6E8", color: alert.urgent ? C.red : "#9A6A00" }}>
                ⏰ {alert.txt}
              </span>
            )}
            {lead.stage === "mapeamento" && !fichaOk && (
              <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
                background: "#FEF6E8", color: "#9A6A00" }}>✗ Ficha incompleta</span>
            )}
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.ink3, marginBottom: 3 }}>
            <span>Checklist da etapa</span>
            <span style={{ fontWeight: 700, color: progress.pct === 100 ? stage.color : C.ink3 }}>
              {progress.done}/{progress.total}
            </span>
          </div>
          <div style={{ height: 5, background: C.bg2, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: progress.pct + "%", background: stage.color, transition: "width .2s" }} />
          </div>
        </div>
        <button onClick={() => setOpen(!open)}
          style={{ background: "none", border: "none", color: stage.color, fontSize: 10,
            fontWeight: 600, cursor: "pointer", padding: "6px 0 2px" }}>
          {open ? "▾ Ocultar tarefas" : "▸ Ver tarefas"}
        </button>
        {open && (
          <div style={{ marginTop: 4 }}>
            {CHECKLISTS[lead.stage].map((task, i) => {
              const checked = !!lead.checks[lead.stage + ":" + i];
              return (
                <label key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 10.5,
                  color: checked ? C.ink3 : C.ink2, padding: "3px 0", cursor: "pointer",
                  textDecoration: checked ? "line-through" : "none" }}>
                  <input type="checkbox" checked={checked} onChange={() => onToggle(i)}
                    style={{ accentColor: stage.color, marginTop: 1 }} />
                  <span>{task}</span>
                </label>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 9, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={onGuia}
            style={{ background: stage.color + "14", border: `1px solid ${stage.color}55`, borderRadius: 6,
              padding: "4px 9px", fontSize: 10, fontWeight: 600, color: stage.color, cursor: "pointer" }}>
            📖 Guia da etapa
          </button>
          {lead.stage === "handoff" && (
            <button onClick={onBriefing}
              style={{ background: C.emp, border: "none", borderRadius: 6, padding: "4px 9px",
                fontSize: 10, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              ⚡ Gerar briefing
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onEdit}
            style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: "4px 10px", fontSize: 11, fontWeight: 600, color: C.ink2, cursor: "pointer" }}>
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════ GUIA VIEW ════════════════ */
function GuiaView({ guiaStage, setGuiaStage, guiaPillar, setGuiaPillar, guiaTab, setGuiaTab,
  guiaLead, setGuiaLead }) {
  const stage = STAGES[STAGE_IDX[guiaStage]];
  const data = GUIA[guiaStage];
  const P = PILLARS[guiaPillar];
  const hasObj = data.objeccoes && data.objeccoes[guiaPillar] && data.objeccoes[guiaPillar].length > 0;
  /* o lead vinculado só faz sentido se etapa e pilar baterem com ele */
  const linkedLead = guiaLead && guiaLead.stage === guiaStage && guiaLead.pillar === guiaPillar
    ? guiaLead : null;
  const tabs = [
    { id: "atividades", label: guiaStage === "visita" ? "📋 Roteiro & SPIN" : "📋 Atividades" },
    { id: "mensagens", label: "✉ Mensagens" },
    ...(hasObj ? [{ id: "objeccoes", label: "💬 Objeções" }] : []),
    { id: "metas", label: "◎ Metas" },
  ];
  const tab = tabs.some((t) => t.id === guiaTab) ? guiaTab : "atividades";

  return (
    <div>
      {/* faixa de lead vinculado */}
      {guiaLead && (
        <div style={{ background: linkedLead ? PILLARS[guiaLead.pillar].bg : "#FEF6E8",
          padding: "9px 26px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 11, color: C.ink2 }}>
            {linkedLead
              ? <>🔗 Templates personalizados para <strong>{guiaLead.org}</strong> — os campos entre colchetes foram preenchidos com os dados do lead.</>
              : <>⚠ O lead <strong>{guiaLead.org}</strong> está em outra etapa/pilar. Os templates aqui não estão sendo personalizados.</>}
          </span>
          <button onClick={() => setGuiaLead(null)}
            style={{ marginLeft: "auto", background: "none", border: `1px solid ${C.border}`,
              borderRadius: 6, padding: "3px 9px", fontSize: 10, fontWeight: 600, color: C.ink3,
              cursor: "pointer" }}>
            ✕ Desvincular
          </button>
        </div>
      )}

      {/* etapa nav */}
      <div style={{ display: "flex", gap: 6, padding: "14px 26px 0", flexWrap: "wrap", background: C.bg }}>
        {STAGES.map((s) => (
          <button key={s.id} onClick={() => { setGuiaStage(s.id); setGuiaTab("atividades"); }}
            style={{ flex: "1 1 130px", padding: "10px 8px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${guiaStage === s.id ? s.color : C.border}`, textAlign: "left",
              background: guiaStage === s.id ? C.white : "transparent" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: ".06em" }}>
              {s.icon} ETAPA {s.num}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: guiaStage === s.id ? C.ink : C.ink3 }}>
              {s.name}
            </div>
          </button>
        ))}
      </div>

      {/* page header */}
      <div style={{ background: stage.color, padding: "26px 26px 22px", margin: "14px 0 0" }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase",
          color: "#fff", opacity: .7, marginBottom: 8 }}>{stage.eyebrow}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{stage.title}</div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.7)", marginTop: 8, maxWidth: 620, lineHeight: 1.7 }}>
          {stage.intro}
        </div>
      </div>

      <div style={{ padding: "20px 26px 50px" }}>
        {/* pillar switch */}
        {guiaStage !== "handoff" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {Object.entries(PILLARS).map(([k, p]) => (
              <button key={k} onClick={() => setGuiaPillar(k)}
                style={{ padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${guiaPillar === k ? p.color : C.border}`,
                  background: guiaPillar === k ? p.color : C.white,
                  color: guiaPillar === k ? "#fff" : C.ink2 }}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        )}

        {/* inner tabs */}
        <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 12,
          overflow: "hidden", marginBottom: 20 }}>
          {tabs.map((t, i) => (
            <button key={t.id} onClick={() => setGuiaTab(t.id)}
              style={{ flex: 1, padding: "11px 8px", fontSize: 12, fontWeight: tab === t.id ? 600 : 500,
                cursor: "pointer", border: "none",
                borderRight: i < tabs.length - 1 ? `1px solid ${C.border}` : "none",
                background: tab === t.id ? stage.color : C.white,
                color: tab === t.id ? "#fff" : C.ink3 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        {tab === "atividades" && <GuiaAtividades data={data} stage={stage} pillar={guiaPillar} P={P} />}
        {tab === "mensagens" && <GuiaMensagens data={data} pillar={guiaPillar} stage={stage} lead={linkedLead} />}
        {tab === "objeccoes" && <GuiaObjeccoes data={data} pillar={guiaPillar} />}
        {tab === "metas" && <GuiaMetas data={data} stage={stage} />}
      </div>
    </div>
  );
}

/* ── GUIA: Atividades / Roteiro+SPIN ── */
function GuiaAtividades({ data, stage, pillar, P }) {
  if (data.roteiro) {
    const SPIN_META = {
      S: { n: "Situação", s: "Entender o contexto atual", c: "#0055A5" },
      P: { n: "Problema", s: "Revelar as dores reais", c: "#EC5A24" },
      I: { n: "Implicação", s: "Ampliar o custo de não resolver", c: "#C0392B" },
      N: { n: "Necessidade", s: "O cliente verbaliza a solução", c: "#0A1628" },
    };
    return (
      <div>
        <InfoBanner color={stage.color} icon="🔍" text={data.objetivo[pillar]} />
        <SecLabel color={stage.color}>Roteiro cronometrado — 60 minutos</SecLabel>
        <div style={cardStyle}>
          {data.roteiro.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "14px 18px",
              borderBottom: i < data.roteiro.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: r.color || "#6B7A92", color: "#fff", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                {r.badge}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.t}</div>
                <div style={{ fontSize: 12, color: C.ink2, lineHeight: 1.6, marginTop: 2 }}>{r.d}</div>
              </div>
            </div>
          ))}
        </div>
        <SecLabel color={stage.color} mt>Perguntas SPIN — {P.label}</SecLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          {Object.entries(SPIN_META).map(([k, m]) => (
            <div key={k} style={{ ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", background: m.c + "14", borderBottom: `1px solid ${m.c}30` }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: m.c }}>{k}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{m.n}</div>
                <div style={{ fontSize: 10, color: C.ink3 }}>{m.s}</div>
              </div>
              <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {data.spin[pillar][k].map((q, i) => (
                  <div key={i} style={{ fontSize: 11, color: C.ink2, lineHeight: 1.45, padding: "7px 9px",
                    background: C.bg, borderRadius: 7, borderLeft: `2px solid ${m.c}` }}>{q}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  const acts = data.atividades[pillar];
  return (
    <div>
      <InfoBanner color={stage.color} icon="🎯" text={data.objetivo[pillar]} />
      <div style={cardStyle}>
        {acts.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 14, padding: "16px 18px",
            borderBottom: i < acts.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: stage.color,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700 }}>
              {a.tag || i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.t}</div>
              <div style={{ fontSize: 12, color: C.ink2, lineHeight: 1.6, margin: "3px 0 8px" }}>{a.d}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {a.tools.map((tl, j) => (
                  <span key={j} style={{ fontSize: 10.5, fontWeight: 500, padding: "3px 8px", borderRadius: 6,
                    background: C.bg2, color: C.ink2, border: `1px solid ${C.border}` }}>{tl}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {data.cadencia && (
        <>
          <SecLabel color={stage.color} mt>Cadência por canal e dia</SecLabel>
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr",
              background: stage.color }}>
              {["Dia", "E-mail", "LinkedIn", "Ligação", "WhatsApp"].map((h) => (
                <div key={h} style={{ padding: "9px 11px", fontSize: 9.5, fontWeight: 700,
                  letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.55)" }}>{h}</div>
              ))}
            </div>
            {data.cadencia.map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 1fr 1fr",
                borderTop: `1px solid ${C.border}`, background: i % 2 ? C.bg : C.white }}>
                <div style={{ padding: "9px 11px", fontSize: 12, fontWeight: 700 }}>{row.dia}</div>
                {[row.email, row.li, row.lig, row.wa].map((cell, j) => (
                  <div key={j} style={{ padding: "9px 11px", fontSize: 11, color: cell === "—" ? C.ink3 : C.ink2 }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                      marginRight: 5, background: cell === "—" ? C.border : C.orange }} />
                    {cell}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── GUIA: Mensagens ── */
function GuiaMensagens({ data, pillar, stage, lead }) {
  const msgs = data.mensagens[pillar] || [];
  const [copied, setCopied] = useState(null);
  const copy = (txt, i) => {
    navigator.clipboard?.writeText(txt).then(() => {
      setCopied(i); setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  };
  return (
    <div>
      <InfoBanner color={stage.color} icon="✉"
        text={lead
          ? `Templates personalizados para ${lead.org}. Os campos preenchidos aparecem destacados — confira os colchetes restantes antes de enviar.`
          : "Personalize sempre o que está entre colchetes. Mensagem genérica vai para spam — o cliente percebe na primeira linha."} />
      {msgs.map((m, i) => {
        const finalMsg = fillTemplate(m.msg, lead);
        const finalAssunto = m.assunto ? fillTemplate(m.assunto, lead) : null;
        return (
          <div key={i} style={{ ...cardStyle, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ padding: "11px 16px", borderBottom: `1px solid ${C.border}`, background: C.bg,
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{m.titulo}</span>
              {finalAssunto && (
                <span style={{ fontSize: 10, color: C.ink3, background: C.bg2, padding: "2px 8px",
                  borderRadius: 4 }}>✉ {finalAssunto}</span>
              )}
              <span style={{ fontSize: 10, color: C.ink3, marginLeft: "auto" }}>{m.ctx}</span>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: C.ink2, lineHeight: 1.75, background: C.bg, padding: "13px 15px",
                borderRadius: 8, borderLeft: `3px solid ${stage.color}`, whiteSpace: "pre-line",
                fontStyle: "italic" }}>
                {lead ? highlightFilled(finalMsg, m.msg, stage.color) : finalMsg}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                <button onClick={() => copy(finalMsg, i)}
                  style={{ background: copied === i ? stage.color : C.white,
                    color: copied === i ? "#fff" : stage.color, border: `1px solid ${stage.color}`,
                    borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {copied === i ? "✓ Copiado" : (lead ? "⧉ Copiar preenchido" : "⧉ Copiar")}
                </button>
                <span style={{ fontSize: 11, color: C.ink3, background: C.bg2, padding: "7px 11px",
                  borderRadius: 7, lineHeight: 1.5, flex: 1 }}>💡 {m.tip}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* destaca, no texto preenchido, os trechos que vieram do lead (que não são mais [..]) */
function highlightFilled(filled, original, color) {
  /* recorta o texto em segmentos: o que mudou em relação ao original recebe destaque.
     abordagem simples e robusta: destaca tudo que NÃO está entre colchetes e que
     também aparecia como [placeholder] no original. */
  const origHadPlaceholders = /\[[^\]]+\]/.test(original);
  if (!origHadPlaceholders) return filled;
  /* divide mantendo os colchetes restantes visíveis */
  const parts = filled.split(/(\[[^\]]+\])/g);
  return parts.map((p, i) => {
    if (/^\[[^\]]+\]$/.test(p)) {
      return <span key={i} style={{ background: "#FEF0EB", color: C.orange,
        borderRadius: 3, padding: "0 3px" }}>{p}</span>;
    }
    return <span key={i}>{p}</span>;
  });
}

/* ── GUIA: Objeções ── */
function GuiaObjeccoes({ data, pillar }) {
  const objs = data.objeccoes[pillar] || [];
  return (
    <div>
      <InfoBanner color={C.navy} icon="💬"
        text="Nunca argumente diretamente. Ouça, valide ('entendo') e reposicione para a visita técnica gratuita." />
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        {objs.map((o, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 3fr",
            borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <div style={{ padding: "13px 15px", fontSize: 12, fontStyle: "italic", color: C.red,
              background: C.redBg, borderRight: `1px solid ${C.border}`, lineHeight: 1.55 }}>
              "{o.q}"
            </div>
            <div style={{ padding: "13px 15px", fontSize: 12, color: C.ink2, lineHeight: 1.55 }}>{o.r}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── GUIA: Metas ── */
function GuiaMetas({ data, stage }) {
  return (
    <div>
      <SecLabel color={stage.color}>Metas da etapa</SecLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        {data.metas.map((m, i) => (
          <div key={i} style={{ ...cardStyle, padding: "16px 18px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase",
              color: C.ink3, marginBottom: 7 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stage.color, lineHeight: 1 }}>{m.val}</div>
            <div style={{ fontSize: 11, color: C.ink3, marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>
      {data.metaNota && (
        <div style={{ ...cardStyle, padding: "16px 18px", marginTop: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase",
            color: stage.color, marginBottom: 7 }}>Critério de conclusão</div>
          <div style={{ fontSize: 12, color: C.ink2, lineHeight: 1.7 }}>{data.metaNota}</div>
        </div>
      )}
    </div>
  );
}

/* ── small UI helpers ── */
const cardStyle = {
  background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
};
function SecLabel({ children, color, mt }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: mt ? 28 : 0, marginBottom: 14 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".11em", textTransform: "uppercase",
        color }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}
function InfoBanner({ color, icon, text }) {
  return (
    <div style={{ background: color + "12", border: `1px solid ${color}33`, borderRadius: 12,
      padding: "13px 16px", display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 18 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 12, color: C.ink2, lineHeight: 1.65 }}>{text}</span>
    </div>
  );
}

/* ════════════════ KPI / FILTER ════════════════ */
function Kpi({ label, val, sub, color, warn }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${warn ? C.red : C.border}`, borderRadius: 12,
      padding: "12px 16px", minWidth: 130, flex: "1 1 130px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
        color: C.ink3, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: warn ? C.red : color, lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 10, color: warn ? C.red : C.ink3, marginTop: 3 }}>{sub}</div>
    </div>
  );
}
function FilterBtn({ active, onClick, label, color = C.navy, bg = "#EEF3FB" }) {
  return (
    <button onClick={onClick}
      style={{ padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${active ? color : C.border}`, background: active ? bg : C.white,
        color: active ? color : C.ink3 }}>
      {label}
    </button>
  );
}

/* ════════════════ MODAL ════════════════ */
function Modal({ lead, onClose, onSave, onDelete }) {
  const [f, setF] = useState(() => ({
    ...lead,
    fit: Array.isArray(lead.fit) ? lead.fit : (lead.fit ? [lead.fit] : []),
    responsaveis: Array.isArray(lead.responsaveis) ? lead.responsaveis : [],
  }));
  const P = PILLARS[f.pillar] || PILLARS.emp;
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.55)", zIndex: 200,
        display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "30px 16px",
        overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: C.white, borderRadius: 14, width: "100%", maxWidth: 540,
          boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ background: C.navy, padding: "16px 22px", borderRadius: "14px 14px 0 0" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase",
            color: C.orange }}>{STAGES[STAGE_IDX[f.stage]].name}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>
            {lead.org ? "Editar lead" : "Novo lead"}
          </div>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <Field label="Pilar">
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(PILLARS).map(([k, p]) => (
                <button key={k} onClick={() => set("pillar", k)}
                  style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", border: `1px solid ${f.pillar === k ? p.color : C.border}`,
                    background: f.pillar === k ? p.bg : C.white,
                    color: f.pillar === k ? p.color : C.ink3 }}>
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label={`Responsáveis ${f.responsaveis && f.responsaveis.length > 0 ? `(${f.responsaveis.length})` : ""}`}>
            <PeoplePicker selected={f.responsaveis || []} onChange={(arr) => set("responsaveis", arr)} />
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Instituição / Empresa" flex>
              <Input value={f.org} onChange={(v) => set("org", v)} placeholder="Ex: Prefeitura de X" />
            </Field>
            <Field label="Segmento" flex>
              <Input value={f.segment} onChange={(v) => set("segment", v)}
                placeholder={f.pillar === "emp" ? "Ex: Prefeitura — interior" : "Ex: Manufatura metálica"} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Decisor — nome" flex>
              <Input value={f.decisorNome} onChange={(v) => set("decisorNome", v)} placeholder="Nome" />
            </Field>
            <Field label="Decisor — cargo" flex>
              <Input value={f.decisorCargo} onChange={(v) => set("decisorCargo", v)}
                placeholder={f.pillar === "emp" ? "Ex: Sec. de Desenvolvimento" : "Ex: Gerente de Engenharia"} />
            </Field>
          </div>
          <Field label="Contato (e-mail ou telefone)">
            <Input value={f.contato} onChange={(v) => set("contato", v)} placeholder="contato@..." />
          </Field>
          <Field label="Dor provável">
            <Input value={f.dor} onChange={(v) => set("dor", v)}
              placeholder={f.pillar === "emp" ? "Ex: Alta informalidade" : "Ex: Retrabalho por erro de projeto"} />
          </Field>
          <Field label={`Serviços de maior fit ${f.fit && f.fit.length > 0 ? `(${f.fit.length} selecionado${f.fit.length > 1 ? "s" : ""})` : ""}`}>
            <ServicesPicker selected={f.fit || []} onChange={(arr) => set("fit", arr)} pillarColor={P.color} />
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Canal de abordagem" flex>
              <select value={f.canal} onChange={(e) => set("canal", e.target.value)} style={inputStyle}>
                {["E-mail", "LinkedIn", "Telefone", "WhatsApp", "Presencial"].map((c) =>
                  <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Próximo contato" flex>
              <input type="date" value={f.proxContato} onChange={(e) => set("proxContato", e.target.value)}
                style={inputStyle} />
            </Field>
          </div>
          {STAGE_IDX[f.stage] >= 2 && (
            <>
              <Field label="Data da visita técnica">
                <input type="date" value={f.dataVisita} onChange={(e) => set("dataVisita", e.target.value)}
                  style={inputStyle} />
              </Field>
              <Field label="Relatório de dores (palavras do cliente)">
                <textarea value={f.relatorioDores} onChange={(e) => set("relatorioDores", e.target.value)}
                  rows={3} style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="Transcreva a frase exata do cliente sobre a dor principal..." />
              </Field>
              <Field label="Objeções levantadas">
                <textarea value={f.objecoes} onChange={(e) => set("objecoes", e.target.value)}
                  rows={2} style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="Ex: 'Já temos parceria com o SEBRAE'..." />
              </Field>
            </>
          )}
          {f.stage === "handoff" && (
            <Field label="Status do briefing">
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: C.ink2,
                cursor: "pointer", padding: "4px 0" }}>
                <input type="checkbox" checked={f.briefingEnviado}
                  onChange={(e) => set("briefingEnviado", e.target.checked)}
                  style={{ accentColor: C.emp }} />
                Briefing enviado ao time comercial
              </label>
            </Field>
          )}
          <Field label="Etapa do funil">
            <select value={f.stage} onChange={(e) => set("stage", e.target.value)} style={inputStyle}>
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.num} — {s.name}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {lead.org && (
              <button onClick={() => { onDelete(lead.id); onClose(); }}
                style={{ background: C.redBg, color: C.red, border: `1px solid ${C.red}`, borderRadius: 8,
                  padding: "9px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Excluir
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={onClose}
              style={{ background: C.white, color: C.ink2, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "9px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={() => onSave(f)} disabled={!f.org.trim()}
              style={{ background: f.org.trim() ? C.orange : C.bg2, color: f.org.trim() ? "#fff" : C.ink3,
                border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 12, fontWeight: 700,
                cursor: f.org.trim() ? "pointer" : "default" }}>
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════ BRIEFING MODAL ════════════════ */
function BriefingModal({ lead, onClose }) {
  const [text, setText] = useState(() => buildBriefing(lead));
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,.55)", zIndex: 200,
        display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "30px 16px",
        overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: C.white, borderRadius: 14, width: "100%", maxWidth: 560,
          boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ background: C.emp, padding: "16px 22px", borderRadius: "14px 14px 0 0" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase",
            color: "rgba(255,255,255,.7)" }}>Handoff comercial</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>Briefing gerado</div>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 12, color: C.ink2, lineHeight: 1.6, marginBottom: 12 }}>
            Montado a partir dos campos do lead <strong>{lead.org}</strong>. Revise e complete os trechos
            entre colchetes antes de enviar ao time comercial.
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={18}
            style={{ ...inputStyle, resize: "vertical", fontSize: 12, lineHeight: 1.7,
              fontFamily: "'DM Mono',ui-monospace,monospace", background: C.bg }} />
          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
            <button onClick={() => setText(buildBriefing(lead))}
              style={{ background: C.white, color: C.ink2, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "9px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              ↺ Restaurar
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={onClose}
              style={{ background: C.white, color: C.ink2, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "9px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Fechar
            </button>
            <button onClick={copy}
              style={{ background: copied ? C.proto : C.emp, color: "#fff", border: "none", borderRadius: 8,
                padding: "9px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {copied ? "✓ Copiado" : "⧉ Copiar briefing"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${C.border}`,
  fontSize: 13, fontFamily: "inherit", color: C.ink, background: C.white, outline: "none",
  boxSizing: "border-box",
};

/* ════════════════ PEOPLE PICKER ════════════════ */
function PeoplePicker({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const safe = Array.isArray(selected) ? selected : [];
  const toggle = (name) => {
    if (safe.includes(name)) onChange(safe.filter((n) => n !== name));
    else onChange([...safe, name]);
  };
  const remove = (name) => onChange(safe.filter((n) => n !== name));

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: C.white }}>
      {/* chips selecionados */}
      {safe.length > 0 && (
        <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}`,
          display: "flex", flexWrap: "wrap", gap: 6 }}>
          {safe.map((name) => (
            <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: 500, padding: "3px 6px 3px 3px", borderRadius: 14,
              background: colorFor(name) + "18", color: colorFor(name),
              border: `1px solid ${colorFor(name)}44` }}>
              <Avatar name={name} size={20} />
              {name}
              <button type="button" onClick={() => remove(name)}
                style={{ background: "none", border: "none", color: colorFor(name), cursor: "pointer",
                  fontSize: 13, padding: "0 3px", lineHeight: 1, fontWeight: 700 }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {/* toggle */}
      <button type="button" onClick={() => setOpen(!open)}
        style={{ width: "100%", background: "none", border: "none", padding: "8px 12px",
          fontSize: 12, fontWeight: 600, color: C.navy, cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 6 }}>
        <span>{open ? "▾" : "▸"}</span>
        <span>{safe.length === 0 ? "Atribuir responsáveis…" : "Editar atribuição"}</span>
      </button>
      {/* lista */}
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, maxHeight: 260, overflowY: "auto",
          background: C.bg }}>
          {RESPONSAVEIS.map((name) => {
            const checked = safe.includes(name);
            const col = colorFor(name);
            return (
              <label key={name} style={{ display: "flex", gap: 10, alignItems: "center",
                padding: "7px 12px", fontSize: 12, color: C.ink2, cursor: "pointer",
                background: checked ? col + "10" : "transparent",
                borderBottom: `1px solid ${C.border}` }}>
                <input type="checkbox" checked={checked} onChange={() => toggle(name)}
                  style={{ accentColor: col, flexShrink: 0 }} />
                <Avatar name={name} size={22} />
                <span style={{ fontWeight: checked ? 600 : 400 }}>{name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════ AVATAR & AVATAR STACK ════════════════ */
function Avatar({ name, size = 22, title }) {
  const col = colorFor(name);
  return (
    <span title={title || name}
      style={{ width: size, height: size, borderRadius: "50%", background: col, color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.42, fontWeight: 700, flexShrink: 0, letterSpacing: ".02em",
        border: "1.5px solid #fff", boxShadow: "0 0 0 1px " + col + "55" }}>
      {initialsOf(name)}
    </span>
  );
}
function AvatarStack({ names, max = 3, size = 22 }) {
  if (!Array.isArray(names) || names.length === 0) return null;
  const visible = names.slice(0, max);
  const rest = names.length - max;
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {visible.map((n, i) => (
        <span key={n} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <Avatar name={n} size={size} />
        </span>
      ))}
      {rest > 0 && (
        <span style={{ marginLeft: -6, width: size, height: size, borderRadius: "50%",
          background: C.bg2, color: C.ink2, display: "inline-flex", alignItems: "center",
          justifyContent: "center", fontSize: size * 0.38, fontWeight: 700,
          border: "1.5px solid #fff" }}>
          +{rest}
        </span>
      )}
    </span>
  );
}

/* ════════════════ SERVICES PICKER ════════════════ */
function ServicesPicker({ selected, onChange, pillarColor }) {
  const [open, setOpen] = useState(false);
  /* coerção defensiva: aceita array, string, null, undefined */
  const safe = Array.isArray(selected)
    ? selected
    : (typeof selected === "string" && selected ? [selected] : []);
  const toggle = (svc) => {
    if (safe.includes(svc)) onChange(safe.filter((s) => s !== svc));
    else onChange([...safe, svc]);
  };
  const remove = (svc) => onChange(safe.filter((s) => s !== svc));

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: C.white }}>
      {/* tags selecionadas */}
      <div style={{ padding: safe.length > 0 ? "8px 10px" : "0",
        borderBottom: safe.length > 0 ? `1px solid ${C.border}` : "none",
        display: "flex", flexWrap: "wrap", gap: 5 }}>
        {safe.map((s) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 11, fontWeight: 500, padding: "3px 4px 3px 9px", borderRadius: 14,
            background: pillarColor + "18", color: pillarColor, border: `1px solid ${pillarColor}44` }}>
            {s}
            <button type="button" onClick={() => remove(s)}
              style={{ background: "none", border: "none", color: pillarColor, cursor: "pointer",
                fontSize: 13, padding: "0 4px", lineHeight: 1, fontWeight: 700 }}>
              ×
            </button>
          </span>
        ))}
      </div>
      {/* toggle */}
      <button type="button" onClick={() => setOpen(!open)}
        style={{ width: "100%", background: "none", border: "none", padding: "8px 12px",
          fontSize: 12, fontWeight: 600, color: pillarColor, cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 6 }}>
        <span>{open ? "▾" : "▸"}</span>
        <span>{safe.length === 0 ? "Selecionar serviços…" : "Editar seleção"}</span>
      </button>
      {/* lista de serviços */}
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, maxHeight: 280, overflowY: "auto",
          background: C.bg }}>
          {SERVICES.map((svc) => {
            const checked = safe.includes(svc);
            return (
              <label key={svc} style={{ display: "flex", gap: 8, alignItems: "center",
                padding: "9px 12px", fontSize: 12, color: C.ink2, cursor: "pointer",
                background: checked ? pillarColor + "10" : "transparent",
                borderBottom: `1px solid ${C.border}` }}>
                <input type="checkbox" checked={checked} onChange={() => toggle(svc)}
                  style={{ accentColor: pillarColor, flexShrink: 0 }} />
                <span>{svc}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
function Field({ label, children, flex }) {
  return (
    <div style={{ marginBottom: 12, flex: flex ? 1 : "none" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
        color: C.ink3, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}
function Input({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={inputStyle} />
  );
}
