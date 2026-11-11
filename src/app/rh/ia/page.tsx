import { requireRhPage } from '@/lib/rh-page';
import { aiConfigured, aiProviderName } from '@/lib/rh-ai';
import { AiManager } from '@/components/rh/ai-manager';

export default async function RhAiPage() {
  await requireRhPage('documents:write');
  return <AiManager configured={aiConfigured()} provider={aiProviderName()} />;
}
