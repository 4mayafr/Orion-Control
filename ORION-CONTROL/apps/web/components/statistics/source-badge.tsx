import { STAT_SOURCE_DESCRIPTIONS, STAT_SOURCE_LABELS, type StatSource } from '@orion/shared';
import { Badge, type BadgeVariant } from '@/components/ui/primitives';

const VARIANTS: Record<StatSource, BadgeVariant> = {
  simulated: 'warning',
  retrieved: 'success',
  unavailable: 'neutral',
};

export function SourceBadge({ source }: { source: StatSource }) {
  return (
    <span title={STAT_SOURCE_DESCRIPTIONS[source]}>
      <Badge variant={VARIANTS[source]} dot>
        {STAT_SOURCE_LABELS[source]}
      </Badge>
    </span>
  );
}
