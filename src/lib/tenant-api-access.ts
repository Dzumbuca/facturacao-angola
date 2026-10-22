import { getTenantAccess, assertTenantWriteAllowed } from './admin-auth';
import { createTenantApiAccess } from './tenant-api-access-core';

export { createTenantApiAccess, type TenantAccess, type TenantApiAccessResult } from './tenant-api-access-core';

const tenantApiAccess = createTenantApiAccess({ getTenantAccess, assertTenantWriteAllowed });
export const getTenantReadAccess = tenantApiAccess.read;
export const getTenantWriteAccess = tenantApiAccess.write;
