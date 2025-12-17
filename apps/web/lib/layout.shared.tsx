import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2">
          <Image src="/logo.svg" alt="UnRAG" width={96} height={24} className="h-6 w-auto" priority />
        </span>
      ),
    },
  };
}
