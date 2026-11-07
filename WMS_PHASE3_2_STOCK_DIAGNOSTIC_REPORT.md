# WMS Phase 3.2 — Stock Diagnostic Report

**Projeto:** facturacao-angola (Machine Facturas)
**Database:** 127.0.0.1:5436/wms_staging (PostgreSQL 18.6)
**Data:** 2026-11-04
**Tipo:** Diagnóstico (apenas leitura, Script C)

## 1. Resultados do Script C

| Tenant | Produto | Product.stock | SUM(PWS.quantity) | Diferença | Movimentos IN | Movimentos OUT | Classificação |
|--------|---------|---------------|-------------------|-----------|---------------|----------------|---------------|
| Tenant A | Produto A | 50.000 | 10.000 | 40.000 | 0 | 0 | Diferença não explicada (investigar) |
| Tenant B | Produto B | 30.000 | 0 (sem PWS) | 30.000 | 0 | 0 | Sem PWS (requer criação) |

## 2. Análise

- **Produto A:** `Product.stock` = 50, mas `ProductWarehouseStock.quantity` = 10. Diferença de 40 unidades não explicada por movimentos (zero movimentos). Requer reconciliação manual antes de qualquer backfill.
- **Produto B:** `Product.stock` = 30, mas não existe registo `ProductWarehouseStock`. Requer criação de PWS (Script A) com quantidade inicial a determinar (não copiar 30 indiscriminadamente).

## 3. Divergências positivas/negativas

- Ambas as diferenças são positivas (Product.stock > PWS total).
- Nenhuma diferença negativa encontrada.

## 4. Produtos sem stock por armazém

- Produto B: sem registo PWS (nenhum armazém).

## 5. Inconsistências entre armazéns

- Nenhum movimento registado; não é possível validar consistência via movimentos.
- Tenant A tem apenas 1 armazém; Tenant B tem apenas 1 armazém. Sem cenário multi-armazém nos dados atuais.

## 6. Conclusão

Divergências confirmadas e documentadas. Nenhuma alteração foi feita ao staging. Aguardando autorização expressa para executar Script A (criação de PWS em falta).