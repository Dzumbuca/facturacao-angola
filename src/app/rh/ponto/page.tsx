import { requireRhPage } from '@/lib/rh-page';
import { KioskManager } from '@/components/rh/kiosk-manager';

export default async function RhKioskPage() {
  await requireRhPage();
  return <KioskManager />;
}
