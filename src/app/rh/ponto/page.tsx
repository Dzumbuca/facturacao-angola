import { requireRhAccess } from '@/lib/rh-access';
import { KioskManager } from '@/components/rh/kiosk-manager';

export default async function RhKioskPage() {
  await requireRhAccess();
  return <KioskManager />;
}
