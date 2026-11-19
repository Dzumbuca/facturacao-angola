/**
 * A11 — In-process semaphore/anti-starvation semaphore for fiscal-chain emission
 *
 * The fiscal chain (InvoiceChainState) serializes FT issuance per tenant.
 * The PostgreSQL connection pool (default 17) is much smaller than a
 * burst of issueInvoice calls. Without a local gate, 50+ concurrent FTs
 * exhaust the pool and trip maxWait (P2028).
 *
 * This semaphore bounds how many issueInvoice calls execute per tenant at
 * once. It does NOT increase the pool, does NOT raise timeouts, and does
 * NOT weaken the fiscal chain. It only caps concurrent in-flight FTs so
 * they can complete with ordered chain processing.
 *
 * Tail latency grows linearly with queue length — honest.
 */

const inflight = new Map<string, { running: number; queue: Array<() => void> }>();
const DEFAULT_MAX = 2;

const slotFor = (tenantId: string) => {
  const existing = inflight.get(tenantId);
  if (existing) return existing;
  const fresh = { running: 0, queue: [] as Array<() => void> };
  inflight.set(tenantId, fresh);
  return fresh;
};

export async function withEmissionSlot<T>(tenantId: string, fn: () => Promise<T>, max = DEFAULT_MAX): Promise<T> {
  const state = slotFor(tenantId);
  while (state.running >= max) {
    await new Promise<void>((resolve) => state.queue.push(resolve));
  }
  state.running += 1;
  try {
    return await fn();
  } finally {
    state.running -= 1;
    const next = state.queue.shift();
    if (next) next();
  }
}

export function inflightEmission(tenantId: string): number {
  return inflight.get(tenantId)?.running ?? 0;
}

export const __resetEmissionSlots = () => { inflight.clear(); };
