import { requireRhPage } from '@/lib/rh-page';
import { aiConfigured, aiProviderName } from '@/lib/rh-ai';
import { RhAiStudio } from '@/components/rh/ai-studio';

export default async function RhAiPage() {
  await requireRhPage('documents:write');
  return <RhAiStudio configured={aiConfigured()} provider={aiProviderName()} />;
}
