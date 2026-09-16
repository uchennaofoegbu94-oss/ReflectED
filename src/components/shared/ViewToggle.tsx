import { Button } from '@/components/ui/button';
import { LayoutGrid, List } from 'lucide-react';

export type ViewMode = 'card' | 'list';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border border-border p-0.5">
      <Button
        type="button"
        size="icon"
        variant={value === 'card' ? 'secondary' : 'ghost'}
        className="h-8 w-8"
        onClick={() => onChange('card')}
        title="Card view"
      >
        <LayoutGrid size={16} />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={value === 'list' ? 'secondary' : 'ghost'}
        className="h-8 w-8"
        onClick={() => onChange('list')}
        title="List view"
      >
        <List size={16} />
      </Button>
    </div>
  );
}
