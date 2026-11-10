import { requireRhAccess } from '@/lib/rh-access';
import { aiConfigured, aiProviderName } from '@/lib/rh-ai';
import { AiManager } from '@/components/rh/ai-manager';

export default async function RhAiPage() {
  await requireRhAccess('documents:write');
  return <AiManager configured={aiConfigured()} provider={aiProviderName()} />;
}
