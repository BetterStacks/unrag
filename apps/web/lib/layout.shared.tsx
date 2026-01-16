import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import { GITHUB_REPO } from '@/constants';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="Unrag"
            width={96}
            height={24}
            className="h-6 w-auto invert dark:invert-0"
            priority
          />
        </span>
      ),
    },
    links: [
      {
        text: 'Docs',
        url: '/docs',
        active: 'nested-url',
      },
      {
        text: 'Changelog',
        url: '/docs/changelog',
        active: 'url',
      },
    ],
    githubUrl: GITHUB_REPO,
    themeSwitch: {
      enabled: false,
    },
  };
}
