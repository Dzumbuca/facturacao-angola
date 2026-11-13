from pathlib import Path
import json, sys

TYPES = [
    ("DECLARACAO_TRABALHO","Declaração de trabalho","Confirmar vínculo laboral, função, admissão e salário.","Declaração para empréstimo bancário.","DECLARACOES",[
        ("funcionarioNome","Nome do funcionário","Ex.: João Kaluana","text"),
        ("funcionarioBi","BI","Ex.: 000123456LA036","text"),
        ("funcionarioNif","NIF","Ex.: 512345678","text"),
        ("cargo","Cargo","Ex.: Técnico Contabilidade","text"),
        ("departamento","Departamento","Ex.: Contabilidade","text",True),
        ("dataAdmissao","Data de admissão","DD/MM/AAAA","date"),
        ("dataTermino","Data de término","DD/MM/AAAA (se aplicável)","date",True),
        ("jornada","Jornada semanal","Ex.: 40 horas","text"),
        ("salario","Salário mensal bruto (Kz)","Ex.: 150.000,00","text"),
        ("finalidade","Finalidade","Ex.: empréstimo bancário","text"),
    ]),
    ("DECLARACAO_ACTIVIDADE","Declaração de actividade","Comprovar actividade económica regular.","Declaração para licença municipal.","DECLARACOES",[
        ("actividade","Actividade exercida","Ex.: Comércio geral","text"),
        ("dataInicio","Início da actividade","DD/MM/AAAA","date"),
        ("finalidade","Finalidade","Ex.: licença municipal","text"),
    ]),
    ("DECLARACAO_IDONEIDADE","Declaração de idoneidade","Idoneidade moral e profissional.","Idoneidade para candidatura.","DECLARACOES",[
        ("pessoaNome","Nome da pessoa","Ex.: Maria António","text"),
        ("finalidade","Finalidade","Ex.: candidatura","text"),
    ]),
    ("CARTA_FORMAL","Carta formal","Carta comercial ou institucional.","Carta de apresentação de proposta.","CARTAS_FORMAIS",[
        ("destinatario","Destinatário","Ex.: Exmo. Senhor Presidente do Conselho de Administração","text"),
        ("assunto","Assunto","Ex.: Apresentação da empresa","text"),
        ("objectivo","Objectivo do pedido","Ex.: solicitar reunião de apresentação","textarea"),
    ]),
    ("CARTA_RESPOSTA","Carta de resposta","Resposta formal a carta recebida.","Resposta à reclamação do cliente.","CARTAS_FORMAIS",[
        ("referencia","Referência da carta recebida","Ex.: Carta n.º 45/2026","text"),
        ("resposta","Resposta pretendida","Ex.: aceite e pedido de desculpas","textarea"),
    ]),
    ("CARTA_RECLAMACAO","Reclamação","Reclamação formal de um serviço ou produto.","Reclamação de entrega atrasada.","CARTAS_FORMAIS",[
        ("empresaDestinataria","Destinatário","Ex.: Logística KP, S.A.","text"),
        ("objecto","Objecto da reclamação","Ex.: serviço de transporte não prestado","textarea"),
        ("prazoExigido","Prazo pretendido para resposta","Ex.: 5 dias úteis","text",True),
    ]),
    ("CONTRATO_TRABALHO","Contrato de trabalho","Contrato entre empresa e trabalhador.","Contrato a prazo de 12 meses.","CONTRATOS",[
        ("funcionarioNome","Nome do funcionário","Ex.: João Kaluana","text"),
        ("funcionarioBi","BI","Ex.: 000123456LA036","text"),
        ("funcionarioNif","NIF","Ex.: 512345678","text"),
        ("cargo","Cargo","Ex.: Técnico Contabilidade","text"),
        ("salario","Salário mensal bruto (Kz)","Ex.: 150.000,00","text"),
        ("dataInicio","Início","DD/MM/AAAA","date"),
        ("dataTermino","Término (se a prazo)","DD/MM/AAAA","date",True),
        ("periodoProbatorio","Período experimental","Ex.: 30 dias","text",True),
    ]),
    ("CONTRATO_PRESTACAO","Contrato de prestação de serviços","Contrato de serviços externos.","Contrato de manutenção.","CONTRATOS",[
        ("prestadorNome","Prestador do serviço","Ex.: Manutenção KP, Lda","text"),
        ("prestadorNif","NIF do prestador","Ex.: 512345678","text"),
        ("escopo","Escopo dos serviços","Ex.: manutenção mensal dos equipamentos","textarea"),
        ("valor","Valor do contrato (Kz)","Ex.: 250.000,00","text"),
        ("prazo","Prazo de execução","Ex.: 12 meses","text"),
    ]),
    ("RELATORIO_TECNICO","Relatório técnico","Relatório de actividade ou auditoria.","Relatório de auditoria interna.","RELATORIOS",[
        ("tema","Tema do relatório","Ex.: Auditoria interna Q3","text"),
        ("objectivo","Objectivo","Ex.: identificar não conformidades","textarea"),
        ("metodologia","Metodologia","Ex.: entrevistas e análise documental","textarea"),
        ("periodo","Período analisado","Ex.: Julho a Setembro de 2026","text"),
    ]),
    ("RELATORIO_ADMINISTRATIVO","Relatório administrativo","Relatório de gestão.","Relatório de gestão semestral.","RELATORIOS",[
        ("tema","Tema do relatório","Ex.: Gestão comercial 1.º semestre","text"),
        ("escopo","Escopo","Ex.: vendas e cobranças","textarea"),
        ("periodo","Período","Ex.: Jan–Jun 2026","text"),
    ]),
    ("PROPOSTA_COMERCIAL","Proposta comercial","Oferta de produtos ou serviços.","Proposta para fornecedor.","PROPOSTAS_COMERCIAIS",[
        ("cliente","Cliente","Ex.: Hospital Central de Luanda","text"),
        ("escopo","Escopo do que se propõe","Ex.: fornecimento de 20 computadores","textarea"),
        ("valor","Valor total (Kz)","Ex.: 12.500.000,00","text"),
        ("prazo","Prazo de entrega","Ex.: 60 dias","text"),
    ]),
    ("MEMORANDO_INTERNO","Memorando interno","Comunicação interna oficial.","Memorando sobre nova política de férias.","MEMORANDOS",[
        ("destinatarios","Destinatários","Ex.: Todos os funcionários","text"),
        ("assunto","Assunto","Ex.: Nova política de férias","text"),
        ("conteudo","Conteúdo","Ex.: comunicar as novas regras","textarea"),
    ]),
    ("ACTA_REUNIAO","Acta de reunião","Registo de deliberações.","Acta do conselho de administração.","ACTAS",[
        ("data","Data da reunião","DD/MM/AAAA","date"),
        ("local","Local","Ex.: Sala de reuniões A","text"),
        ("participantes","Participantes","Ex.: Joaquim, Ana, Pedro","textarea"),
        ("deliberacoes","Deliberações","Ex.: aprovar o orçamento de 2027","textarea"),
    ]),
    ("COMUNICADO","Comunicado","Aviso para toda a equipa.","Comunicado sobre horário de trabalho.","COMUNICADOS",[
        ("assunto","Assunto","Ex.: Alteração do horário de trabalho","text"),
        ("conteudo","Conteúdo do comunicado","Ex.: a partir de 01/01/2027","textarea"),
    ]),
    ("OFICIO","Ofício","Ofício a outro órgão ou empresa.","Ofício à Câmara Municipal.","OFICIOS_REQUERIMENTOS",[
        ("destinatarioOrgao","Destinatário","Ex.: Exmo. Presidente da Câmara Municipal","text"),
        ("assunto","Assunto","Ex.: Pedido de licença de obras","text"),
        ("pedido","O que se pede","Ex.: emissão de licença de construção","textarea"),
    ]),
    ("ANUNCIO_VAGA","Anúncio de vaga","Recrutamento.","Anúncio para vaga de contabilista.","RECURSOS_HUMANOS",[
        ("cargo","Cargo a recrutar","Ex.: Contabilista Sénior","text"),
        ("departamento","Departamento","Ex.: Contabilidade","text",True),
        ("requisitos","Requisitos","Ex.: licenciatura, 3 anos experiência","textarea"),
        ("beneficios","Salário e benefícios","Ex.: 250.000 Kz + subsídio de alimentação","textarea",True),
    ]),
    ("OUTRO","Documento livre","Qualquer documento empresarial.","Qualquer documento empresarial.","OUTROS",[
        ("descricao","O que deve conter","Ex.: declaração de idoneidade moral","textarea"),
    ]),
]

def js(text):
    return "'" + text.replace("\\", "\\\\").replace("'", "\\'") + "'"

out = []
out.append("export const DOCUMENT_TYPES: DocumentType[] = [")
for tid,label,desc,example,cat,fields in TYPES:
    out.append("  {")
    out.append("    id: " + js(tid) + ",")
    out.append("    label: " + js(label) + ",")
    out.append("    description: " + js(desc) + ",")
    out.append("    example: " + js(example) + ",")
    out.append("    category: " + js(cat) + ",")
    out.append("    fields: [")
    for f in fields:
        key, lab, ph = f[0], f[1], f[2]
        kind = f[3] if len(f) > 3 else "text"
        optional = f[4] if len(f) > 4 else False
        parts = ["key: " + js(key), "label: " + js(lab), "placeholder: " + js(ph)]
        if kind != "text":
            parts.append("kind: " + js(kind))
        if optional:
            parts.append("optional: true")
        out.append("      { " + ", ".join(parts) + " },")
    out.append("      ...COMPANY,")
    out.append("      ...SIGNATORY,")
    out.append("    ],")
    out.append("  },")
out.append("];")
out.append("")
out.append("export function documentTypeById(id: string): DocumentType | undefined {")
out.append("  return DOCUMENT_TYPES.find((type) => type.id === id);")
out.append("}")
out.append("")
out.append("export function buildInstruction(type: DocumentType, values: Record<string, string>): string {")
out.append("  const lines: string[] = [];")
out.append("  const answer = (key: string) => (values[key] ?? '').trim();")
out.append("  lines.push(`Redige o seguinte ${type.label.toLowerCase()}, estruturado em secções, linguagem formal e profissional.`);")
out.append("  lines.push('Segue rigorosamente os factos fornecidos; não inventes nomes, NIF, datas ou valores.');")
out.append("  lines.push('Se algum dado não foi fornecido, escreve [A PREENCHER: descrição] no lugar correspondente; nunca inventes.');")
out.append("  lines.push('Usa Markdown simples: # títulos, ## subtítulos, listas com -, tabelas com |.');")
out.append("  for (const field of type.fields) {")
out.append("    const value = answer(field.key);")
out.append("    if (value) lines.push(`${field.label}: ${value}`);")
out.append("  }")
out.append("  for (const field of [...COMPANY, ...SIGNATORY]) {")
out.append("    const value = answer(field.key);")
out.append("    if (value) lines.push(`${field.label}: ${value}`);")
out.append("  }")
out.append("  return lines.join('\\n');")
out.append("}")
out.append("")

p = Path("src/lib/rh-ai-studio.ts")
s = p.read_text(encoding="utf-8")
s += "\n".join(out) + "\n"
p.write_text(s, encoding="utf-8")
print("ok")