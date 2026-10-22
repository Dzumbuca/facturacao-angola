type PlatformRole = 'NONE' | 'ADMIN' | 'SUPERADMIN' | 'COMPANY_MANAGER' | 'USER_MANAGER' | 'DOCUMENT_MANAGER' | 'AUDITOR' | 'SUPPORT';
type AccountStatus = 'ACTIVE' | 'SUSPENDED';

export function isLastActivePlatformAdminChange(input: {
  currentRole: PlatformRole;
  currentStatus: AccountStatus;
  nextRole: PlatformRole;
  nextStatus: AccountStatus;
  activeAdminCount: number;
}) {
  const isActiveAdmin = (input.currentRole === 'ADMIN' || input.currentRole === 'SUPERADMIN') && input.currentStatus === 'ACTIVE';
  const losesAccess = (input.nextRole !== 'ADMIN' && input.nextRole !== 'SUPERADMIN') || input.nextStatus !== 'ACTIVE';
  return isActiveAdmin && losesAccess && input.activeAdminCount <= 1;
}

export function validateAdminReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const reason = value.trim();
  return reason.length >= 5 && reason.length <= 500 ? reason : null;
}
