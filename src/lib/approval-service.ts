/**
 * A13 — Approval workflow service
 *
 * Generic workflow for critical financial operations (reopen closed period,
 * reopen exercise, etc). Generic over operation name; operation handler is
 * registered by the caller to execute after approval.
 *
 * Segregation of functions: requester cannot decide their own request
 * unless tenant policy disables segregation. Authentication source-of-truth
 * is always server-side session.
 *
 * Idempotent: a request can move PENDING -> decided once; decided requests
 * cannot reopen. Execution is gated on: state == APPROVED && operation not
 * executed yet.
 *
 * NOT cryptographically inviolable against DBA — same guarantees as the rest
 * of our PostgreSQL tables.
 */

import { runWithTenant } from './tenant-db';
import { logAuditEvent } from './audit-log';

export type ApprovalState =
  | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'EXECUTED' | 'FAILED';

export type ApprovalDecision = 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type ApprovalRequest = {
  id: string;
  tenantId: string;
  operation: string;
  entityType: string;
  entityId: string;
  payload: any;
  requestedBy: string;
  state: ApprovalState;
  expiresAt: Date | null;
  createdAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  executedAt: Date | null;
};

export async function createApprovalRequest(params: {
  tenantId: string;
  operation: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
  requestedBy: string;
  justification: string;
  expiresInHours?: number;
}): Promise<ApprovalRequest> {
  if (!params.justification || params.justification.trim().length < 10) {
    throw new Error('JUSTIFICATION_TOO_SHORT — mínim. 10 caracteres');
  }
  const expiresAt = params.expiresInHours ? new Date(Date.now() + params.expiresInHours * 3600 * 1000) : null;
  return runWithTenant(params.tenantId, async (tx) => {
    const created = await tx.approvalRequest.create({
      data: {
        tenantId: params.tenantId,
        operation: params.operation,
        entityType: params.entityType,
        entityId: params.entityId,
        payload: params.payload === undefined ? {} : (params.payload as any),
        requestedBy: params.requestedBy,
        justification: params.justification.trim(),
        state: 'PENDING',
        expiresAt,
      } as any,
    });
    await logAuditEvent(params.tenantId, {
      actorUserId: params.requestedBy,
      action: 'APPROVAL_REQUESTED',
      entity: 'ApprovalRequest',
      entityId: created.id,
      after: { operation: params.operation, entityType: params.entityType, entityId: params.entityId } as any,
      source: 'approval-service',
      justification: params.justification,
    }, tx as any);
    return created as ApprovalRequest;
  });
}

export async function decideApprovalRequest(params: {
  tenantId: string;
  requestId: string;
  decision: ApprovalDecision;
  decidedBy: string;
  decisionReason?: string;
  /** Default true: a user cannot approve their own request unless explicitly allowed. */
  enforceSegregationOfFunctions?: boolean;
}): Promise<ApprovalRequest> {
  const segregate = params.enforceSegregationOfFunctions !== false;
  return runWithTenant(params.tenantId, async (tx) => {
    const req = await tx.approvalRequest.findUnique({ where: { id: params.requestId } });
    if (!req) throw new Error('APPROVAL_NOT_FOUND');
    if (req.tenantId !== params.tenantId) throw new Error('CROSS_TENANT_DENIED');
    if (req.state !== 'PENDING') throw new Error('APPROVAL_NOT_PENDING');

    if (segregate && req.requestedBy === params.decidedBy) {
      throw new Error('SEGREGATION_OF_FUNCTIONS — o solicitante não pode decidir o seu próprio pedido');
    }

    const newState: ApprovalState = params.decision === 'CANCELLED' ? 'CANCELLED' : (params.decision as ApprovalState);
    const updated = await tx.approvalRequest.update({
      where: { id: params.requestId },
      data: {
        state: newState,
        decision: params.decision,
        decidedAt: new Date(),
        decidedBy: params.decidedBy,
        decisionReason: params.decisionReason ?? null,
        updatedAt: new Date(),
      } as any,
    });
    await logAuditEvent(params.tenantId, {
      actorUserId: params.decidedBy,
      action: `APPROVAL_${params.decision}`,
      entity: 'ApprovalRequest',
      entityId: req.id,
      before: { state: req.state } as any,
      after: { state: newState } as any,
      justification: params.decisionReason,
      source: 'approval-service',
    }, tx as any);
    return updated as ApprovalRequest;
  });
}

/**
 * Execute the approved action payload atomically. The `execute` callback
 * is responsible for the actual operation. Idempotent: if the request is
 * in state EXECUTED, this returns the previously-executed result without
 * re-running.
 */
export async function executeApprovedRequest<T>(params: {
  tenantId: string;
  requestId: string;
  executedBy: string;
  execute: (tx: any, request: ApprovalRequest) => Promise<T>;
}): Promise<{ request: ApprovalRequest; executed: T | null; skipped: boolean }> {
  return runWithTenant(params.tenantId, async (tx) => {
    const req = await tx.approvalRequest.findUnique({ where: { id: params.requestId } });
    if (!req) throw new Error('APPROVAL_NOT_FOUND');
    if (req.tenantId !== params.tenantId) throw new Error('CROSS_TENANT_DENIED');
    if (req.state === 'EXECUTED') {
      return { request: req as ApprovalRequest, executed: (req.executedSummary as any)?.value ?? null, skipped: true };
    }
    if (req.state !== 'APPROVED') throw new Error('APPROVAL_NOT_APPROVED');

    // Caller resolves the operation; we just persist the result
    const executed = await params.execute(tx, req as ApprovalRequest);
    const updated = await tx.approvalRequest.update({
      where: { id: params.requestId },
      data: {
        state: 'EXECUTED',
        executedAt: new Date(),
        executedSummary: { value: executed ?? null } as any,
        updatedAt: new Date(),
      } as any,
    });
    await logAuditEvent(params.tenantId, {
      actorUserId: params.executedBy,
      action: 'APPROVAL_EXECUTED',
      entity: 'ApprovalRequest',
      entityId: req.id,
      after: { state: 'EXECUTED' } as any,
      source: 'approval-service',
    }, tx as any);
    return { request: updated as ApprovalRequest, executed, skipped: false };
  });
}
