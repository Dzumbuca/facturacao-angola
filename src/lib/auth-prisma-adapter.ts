import 'server-only';
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { PrismaClient } from '@prisma/client';
import { runAsSystem, runWithRlsContext, PRIVILEGED_RLS } from './tenant-db';

// RLS-aware wrapper for @auth/prisma-adapter.
// 5437 mf_rls_staging state (prototype): Account/Session/VerificationToken/EmailActionToken have RLS OFF;
// User/EmailRequestLimit have RLS ON. NextAuth adapter calls are server-controlled (never client-shaped
// tenant/user ids for authorization decisions). We run adapter operations in narrow transaction-local
// contexts: auth tables use system context (admin GUC, no tenant) because they are identity/bootstrap
// infrastructure in this prototype; User reads required by adapter use system context only where no
// authenticated user context exists (email/account lookup), otherwise they run under the resolved user
// context. This preserves NextAuth compatibility without granting BYPASSRLS roles.
// NOT a claim of full production/OAuth/pooling readiness.

type Awaitable<T> = T | PromiseLike<T>;
type Adapter = ReturnType<typeof PrismaAdapter>;

function withSystem<T>(fn: (tx: any) => Awaitable<T>): Promise<T> {
  return runAsSystem((tx) => Promise.resolve(fn(tx)), PRIVILEGED_RLS);
}

function withUser<T>(userId: string | null | undefined, fn: (tx: any) => Awaitable<T>): Promise<T> {
  const id = typeof userId === 'string' && userId.trim() ? userId.trim() : null;
  return id
    ? runWithRlsContext((tx) => Promise.resolve(fn(tx)), { userId: id, tenantId: null, isAdmin: false })
    : runAsSystem((tx) => Promise.resolve(fn(tx)), PRIVILEGED_RLS);
}

export function createRlsPrismaAdapter(prisma: any): Adapter {
  const base = PrismaAdapter(prisma as any) as any;
  return {
    ...base,
    // User methods: server-controlled. getUser has known id; getUserByEmail/getUserByAccount are
    // bootstrap lookups and use system context narrowly (same trust boundary as Credentials authorize).
    createUser: (data: any) => withSystem((tx) => PrismaAdapter(tx as any).createUser!(data)),
    getUser: (id: string) => withUser(id, (tx) => PrismaAdapter(tx as any).getUser!(id)),
    getUserByEmail: (email: string) => withSystem((tx) => PrismaAdapter(tx as any).getUserByEmail!(email)),
    getUserByAccount: (provider_providerAccountId: any) => withSystem((tx) => PrismaAdapter(tx as any).getUserByAccount!(provider_providerAccountId)),
    updateUser: ({ id, ...data }: any) => withUser(id, (tx) => PrismaAdapter(tx as any).updateUser!({ id, ...data })),
    deleteUser: (id: string) => withUser(id, (tx) => PrismaAdapter(tx as any).deleteUser!(id)),

    // Account table (RLS-off prototype). Operations are server-controlled by NextAuth.
    linkAccount: (data: any) => withUser(data?.userId, (tx) => PrismaAdapter(tx as any).linkAccount!(data)),
    unlinkAccount: (provider_providerAccountId: any) => withSystem((tx) => PrismaAdapter(tx as any).unlinkAccount!(provider_providerAccountId)),
    getAccount: base.getAccount ? (providerAccountId: string, provider: string) => withSystem((tx) => PrismaAdapter(tx as any).getAccount!(providerAccountId, provider)) : undefined,

    // Session table (RLS-off prototype). Strategy is JWT; these may be unused but kept compatible.
    getSessionAndUser: (sessionToken: string) => withSystem((tx) => PrismaAdapter(tx as any).getSessionAndUser!(sessionToken)),
    createSession: (data: any) => withUser(data?.userId, (tx) => PrismaAdapter(tx as any).createSession!(data)),
    updateSession: (data: any) => withSystem((tx) => PrismaAdapter(tx as any).updateSession!(data)),
    deleteSession: (sessionToken: string) => withSystem((tx) => PrismaAdapter(tx as any).deleteSession!(sessionToken)),

    // VerificationToken (RLS-off prototype). Token values are secrets handled server-side by NextAuth.
    createVerificationToken: (data: any) => withSystem((tx) => PrismaAdapter(tx as any).createVerificationToken!(data)),
    useVerificationToken: (identifier_token: any) => withSystem((tx) => PrismaAdapter(tx as any).useVerificationToken!(identifier_token)),

    // Authenticators (WebAuthn) — not used currently; keep base behavior but wrap in system context.
    ...(base.createAuthenticator ? { createAuthenticator: (data: any) => withSystem((tx) => PrismaAdapter(tx as any).createAuthenticator!(data)) } : {}),
    ...(base.getAuthenticator ? { getAuthenticator: (credentialID: string) => withSystem((tx) => PrismaAdapter(tx as any).getAuthenticator!(credentialID)) } : {}),
    ...(base.listAuthenticatorsByUserId ? { listAuthenticatorsByUserId: (userId: string) => withUser(userId, (tx) => PrismaAdapter(tx as any).listAuthenticatorsByUserId!(userId)) } : {}),
    ...(base.updateAuthenticatorCounter ? { updateAuthenticatorCounter: (credentialID: string, counter: number) => withSystem((tx) => PrismaAdapter(tx as any).updateAuthenticatorCounter!(credentialID, counter)) } : {}),
  } as Adapter;
}
