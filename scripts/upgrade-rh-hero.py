from pathlib import Path

def upgrade(path, old_header, new_header):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if 'RhModuleHero' not in s:
        lines = s.splitlines(keepends=True)
        last_import = max(i for i, l in enumerate(lines) if l.startswith('import'))
        lines.insert(last_import + 1, "import { RhModuleHero } from '@/components/rh/premium-kit';\n")
        s = ''.join(lines)
    assert old_header in s, path + ' missing anchor'
    s = s.replace(old_header, new_header, 1)
    p.write_text(s, encoding='utf-8')
    print('upgraded', path)

upgrade('src/components/rh/positions-manager.tsx',
"""      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[#708195]">Organização</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Cargos</h1>
          <p className="mt-1 text-sm text-[#607286]">Funções por departamento e nível hierárquico.</p>
        </div>
        <button type="button" onClick={() => { setError(''); setOpen(true); }} className="min-h-11 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white">Novo cargo</button>
      </div>""",
"""      <RhModuleHero
        eyebrow="Organização"
        title="Cargos"
        description="Funções por departamento e nível hierárquico. Estrutura a empresa antes de contratar."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.418-4.03 8-9 8s-9-3.582-9-8 4.03-8 9-8 9 3.582 9 8z"/></svg>}
        action={<button type="button" onClick={() => { setError(''); setOpen(true); }} className="min-h-12 rounded-[14px] bg-gradient-to-br from-[#021f87] via-[#0b2b6b] to-[#1b3a7a] px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(2,31,135,.32)] transition hover:-translate-y-0.5">Novo cargo</button>}
      />""")

upgrade('src/components/rh/departments-manager.tsx',
"""      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[#708195]">Organização</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Departamentos</h1>
          <p className="mt-1 text-sm text-[#607286]">Estrutura hierárquica e responsáveis.</p>
        </div>
        <button type="button" onClick={openCreate} className="min-h-11 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white">Novo departamento</button>
      </div>""",
"""      <RhModuleHero
        eyebrow="Organização"
        title="Departamentos"
        description="Estrutura hierárquica e responsáveis. Cria a cadeia antes de distribuir funções."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h18M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/></svg>}
        action={<button type="button" onClick={openCreate} className="min-h-12 rounded-[14px] bg-gradient-to-br from-[#021f87] via-[#0b2b6b] to-[#1b3a7a] px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(2,31,135,.32)] transition hover:-translate-y-0.5">Novo departamento</button>}
      />""")

upgrade('src/components/rh/training-manager.tsx',
"""      <div>
        <p className="text-sm text-[#708195]">Desenvolvimento humano</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Formação profissional</h1>
        <p className="mt-1 text-sm text-[#607286]">Cursos, inscrições, participação e conclusão.</p>
      </div>""",
"""      <RhModuleHero
        eyebrow="Desenvolvimento humano"
        title="Formação profissional"
        description="Cursos, inscrições, participação e conclusão. Informação certa para auditorias e desenvolvimento de competências."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}
      />""")

upgrade('src/components/rh/recruitment-manager.tsx',
"""      <div>
        <p className="text-sm text-[#708195]">Recrutamento e Seleção</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Recrutamento</h1>
        <p className="mt-1 text-sm text-[#607286]">Vagas → candidaturas → triagem → entrevista → avaliação → admissão.</p>
      </div>""",
"""      <RhModuleHero
        eyebrow="Recrutamento e Seleção"
        title="Recrutamento"
        description="Vagas, candidaturas, triagem, entrevista, avaliação e admissão. Um único sítio para toda a jornada de contratação."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>}
      />""")

upgrade('src/components/rh/announcements-manager.tsx',
"""      <div>
        <p className="text-sm text-[#708195]">Comunicação interna</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Comunicados</h1>
        <p className="mt-1 text-sm text-[#607286]">Avisos visíveis para todos os funcionários em Meu RH.</p>
      </div>""",
"""      <RhModuleHero
        eyebrow="Comunicação interna"
        title="Comunicados"
        description="Avisos visíveis para todos os funcionários em Meu RH. Comunica uma vez, todos recebem."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5-5 18-3-8-8-3z"/><path d="M13 15l6-6"/></svg>}
      />""")

upgrade('src/components/rh/templates-manager.tsx',
"""      <div>
        <p className="text-sm text-[#708195]">Machine Documents</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Modelos</h1>
        <p className="mt-1 text-sm text-[#607286]">Cada edição cria uma versão imutável. A validação jurídica é obrigatória antes de emitir.</p>
      </div>""",
"""      <RhModuleHero
        eyebrow="Machine Documents"
        title="Modelos"
        description="Cada edição cria uma versão imutável. A validação jurídica é obrigatória antes de emitir."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 12h4"/><path d="M10 16h4"/></svg>}
      />""")

upgrade('src/components/rh/members-manager.tsx',
"""      <div>
        <p className="text-sm text-[#708195]">Administração</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Equipa RH</h1>
        <p className="mt-1 text-sm text-[#607286]">Funções por empresa. O administrador da empresa mantém acesso total.</p>
      </div>""",
"""      <RhModuleHero
        eyebrow="Administração"
        title="Equipa RH"
        description="Funções por empresa. O administrador da empresa mantém acesso total, sem excepções."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4"/><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><path d="M19 11l2 2 4-4"/></svg>}
      />""")

upgrade('src/components/rh/deductions-manager.tsx',
"""    <section className="rounded-xl border border-[#e1e8f0] bg-white">
      <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[#1c2d3f]">Descontos recorrentes</h2>""",
"""    <RhModuleHero
      eyebrow="Payroll"
      title="Descontos recorrentes"
      description="Adiantamentos e descontos mensais promovidos directamente no processamento salarial. Nunca são aplicados sem registo."
      icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
    />
    <section className="rounded-[18px] border border-[#e2e8ef] bg-white shadow-[0_10px_28px_rgba(18,36,68,.05)] overflow-hidden">
      <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[#1c2d3f]">Descontos recorrentes</h2>""")

print('all upgraded')
