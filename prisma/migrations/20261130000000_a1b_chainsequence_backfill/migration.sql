-- A18 CORRECTIVE — A1b: backfill determinístico de "chainSequence" antes da constraint.
--
-- Motivo: a migration 20261117001000_a1_integrity_documental adiciona a coluna
-- "chainSequence" (nullable, sem default) e, na mesma transação, cria a CHECK
-- "invoice_issued_requires_chain_sequence". Em qualquer base que já contenha
-- facturas com status='ISSUED', essa CHECK falha (SQLSTATE 23514) porque as
-- facturas históricas têm "chainSequence" IS NULL. A migration nunca chegou a
-- ser aplicada em produção (produção está em 15bb189, anterior a A1), pelo que
-- esta migration correctiva é segura e não reescreve histórico já aplicado.
--
-- Âmbito da sequência (confirmado no código, não inferido):
--   src/lib/invoice-service.ts:182  chainSequence = chainState.lastSequence + 1
--   src/lib/invoice-integrity.ts    InvoiceChainState PK = ("tenantId")
--   => uma cadeia por TENANT (não por série nem por ano).
-- A numeração documental (Invoice.number) é independente e vive em InvoiceSeries
-- (tenantId + seriesCode + documentType + year).
--
-- Regra de reconstrução:
--   Ordenar as facturas históricas de cada tenant por (issuedAt, createdAt, id)
--   e atribuir 1..N (continuação a partir do maior chainSequence existente).
--   Isto reproduz exatamente a ordem em que teriam sido emitidas se a cadeia já existisse.
--   Não altera number, total, datas, cliente, estado, hash nem previousHash.
--   Apenas facturas ISSUED recebem sequência (as DRAFT/ANULADA ficam NULL,
--   coerente com a CHECK que só exige sequência a documentos emitidos).
--
-- FIX: Corrigido para numeração 1-based (compatível com A1 e código da aplicação)
--      e para continuar a partir do maior chainSequence existente por tenant.

-- 1. Backfill idempotente: só actua onde "chainSequence" IS NULL.
--    A janela "WHERE chainSequence IS NULL" garante idempotência total.
--    Usa base do maior chainSequence existente por tenant (igual à migration A1).
WITH bases AS (
  SELECT "tenantId", COALESCE(MAX("chainSequence"), 0) AS base
  FROM "Invoice"
  WHERE "chainSequence" IS NOT NULL
  GROUP BY "tenantId"
),
ordenado AS (
  SELECT
    i.id,
    COALESCE(b.base, 0) + ROW_NUMBER() OVER (
      PARTITION BY i."tenantId"
      ORDER BY i."issuedAt" ASC, i."createdAt" ASC, i.id ASC
    ) AS sequencia
  FROM "Invoice" i
  LEFT JOIN bases b ON b."tenantId" = i."tenantId"
  WHERE i."status" = 'ISSUED'
    AND i."chainSequence" IS NULL
)
UPDATE "Invoice" AS alvo
SET "chainSequence" = ordenado.sequencia
FROM ordenado
WHERE alvo.id = ordenado.id
  AND alvo."chainSequence" IS NULL;

-- 2. Alinhar "InvoiceChainState" com o maior "chainSequence" já atribuído,
--    para que a próxima emissão continue a sequência em vez de recomeçar em 1.
INSERT INTO "InvoiceChainState" ("tenantId", "lastHash", "lastSequence", "lastInvoiceId")
SELECT
  distinto."tenantId",
  ultima."hash",
  distinto."maxSequence",
  ultima."id"
FROM (
  SELECT "tenantId", MAX("chainSequence") AS "maxSequence"
  FROM "Invoice"
  WHERE "chainSequence" IS NOT NULL
  GROUP BY "tenantId"
) AS distinto
JOIN LATERAL (
  SELECT "hash", "id"
  FROM "Invoice"
  WHERE "tenantId" = distinto."tenantId"
    AND "chainSequence" = distinto."maxSequence"
  ORDER BY "issuedAt" ASC, "createdAt" ASC, "id" ASC
  LIMIT 1
) AS ultima ON TRUE
ON CONFLICT ("tenantId") DO UPDATE
  SET "lastSequence"  = GREATEST("InvoiceChainState"."lastSequence", EXCLUDED."lastSequence"),
      "lastHash"      = COALESCE("InvoiceChainState"."lastHash", EXCLUDED."lastHash"),
      "lastInvoiceId" = COALESCE("InvoiceChainState"."lastInvoiceId", EXCLUDED."lastInvoiceId");