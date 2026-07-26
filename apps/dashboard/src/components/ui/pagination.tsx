import type * as React from 'react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
  readonly previousLabel: string;
  readonly nextLabel: string;
  readonly rangeLabel: string;
}

export function Pagination({ page, pageSize, total, onPageChange, previousLabel, nextLabel, rangeLabel }: PaginationProps): React.JSX.Element | null {
  if (total <= pageSize) return null;

  const lastPage = Math.ceil(total / pageSize);

  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {previousLabel}
      </Button>
      <span className="flex items-center px-2 text-sm text-muted-foreground">{rangeLabel}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= lastPage}
        onClick={() => onPageChange(page + 1)}
      >
        {nextLabel}
      </Button>
    </div>
  );
}
