'use client';

import { Button } from '@/components/ui/button';
import { NavIcon } from '@/components/nav-icons';

type Action = {
  key: 'entry' | 'exit' | 'transfer' | 'adjust';
  label: string;
  icon: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
};

export function StockActions({ actions }: { actions: Action[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((action) => (
        <Button
          key={action.key}
          type="button"
          variant="secondary"
          disabled={action.disabled}
          onClick={action.onClick}
          className="flex h-auto min-h-[92px] flex-col items-start gap-1.5 rounded-xl border border-[#e2e9f1] bg-white p-3.5 text-left transition hover:border-[#2878d0]/40 hover:bg-[#f7faff] disabled:cursor-not-allowed disabled:opacity-50 sm:p-4"
        >
          <span className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef4ff] text-[#2878d0]">
              <NavIcon name={action.icon} className="h-5 w-5" />
            </span>
            <span className="text-[13px] font-semibold text-[#1c2d3f] sm:text-sm">{action.label}</span>
          </span>
          <span className="text-[11px] leading-snug text-[#708195] sm:text-xs">{action.description}</span>
        </Button>
      ))}
    </div>
  );
}