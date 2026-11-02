# Autoria — Machine Facturas

## Projeto

**Nome:** Machine Facturas  
**Descrição:** Sistema de facturação e gestão empresarial para o mercado angolano.  
**Versão:** 1.0.0  
**Repositório:** github.com/Dzumbuca/facturacao-angola (branch `main`)  
**Produção:** https://facturacao-angola.vercel.app  

## Autor / Mantenedor

**Nome:** Dzumbuca  
**GitHub:** github.com/Dzumbuca  
**Contacto:** Via issues no repositório GitHub  

## Contribuidores

Não há contribuidores listados atualmente.

## Licença

Este projeto é desenvolvido para o mercado angolano e segue as normas aplicáveis à facturação eletrónica em Angola (AGT — Administração Geral Tributária).

> ⚠️ **Aviso legal:** As facturas geradas por este sistema são assinadas digitalmente com uma chave privada RSA (`backups/invoice-signing-private-key.pem`). Esta chave **não deve ser partilhada, publicada ou regenerada** sem autorização expressa do autor. A perda desta chave invalida todas as facturas anteriormente assinadas.

## Tecnologias utilizadas

- Next.js 16 + React 19 + TypeScript
- Prisma ORM + PostgreSQL (Supabase)
- NextAuth v5 (autenticação)
- Tailwind CSS 4 + Vitest (testes)
- PDFKit (facturas assinadas digitalmente, padrão AGT)
- Exportação SAFT-AO

## Como contribuir

1. Faça um fork do repositório
2. Crie uma branch para a sua funcionalidade (`git checkout -b feature/minha-funcionalidade`)
3. Commit as suas alterações (`git commit -m "feat: descrição"`)
4. Faça push para a branch (`git push origin feature/minha-funcionalidade`)
5. Abra um Pull Request

## Segurança

Não publique o ficheiro `.env`, chaves privadas ou tokens. Reporte vulnerabilidades de segurança através de issues privadas no GitHub.

---

*Documento de autoria gerado automaticamente. Mantenha este ficheiro atualizado sempre que houver alterações na autoria ou na equipa do projeto.*