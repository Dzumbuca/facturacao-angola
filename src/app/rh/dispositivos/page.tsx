import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess } from '@/lib/rh-access';
import { DevicesManager } from '@/components/rh/devices-manager';

export default async function RhDevicesPage() {
  const access = await requireRhAccess();
  const devices = await runWithTenant(access.tenantId, (tx) => tx.rhDevice.findMany({
    where: { tenantId: access.tenantId },
    select: { id: true, name: true, isActive: true, lastSeenAt: true, createdAt: true },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  }), { userId: access.userId });
  return (
    <DevicesManager
      devices={(devices as any[]).map((device) => ({
        ...device,
        lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
        createdAt: device.createdAt.toISOString(),
      }))}
    />
  );
}
