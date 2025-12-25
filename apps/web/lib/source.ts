import { docs } from 'fumadocs-mdx:collections/server';
import { type InferPageType, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import React from 'react';

function ensureKeyedIcon(node: any) {
  const icon = node?.icon;
  if (React.isValidElement(icon) && icon.key == null) {
    node.icon = React.cloneElement(icon, { key: 'unrag-icon' });
  }
}

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  plugins: [
    lucideIconsPlugin(),
    {
      transformPageTree: {
        folder(node, _folderPath, metaPath) {
          if (!metaPath) return node;

          const original = this.storage.read(metaPath) as any;
          const data = original?.data ?? original;

          const badge =
            typeof data?.badge === 'string'
              ? data.badge
              : data?.new === true
                ? 'New'
                : undefined;

          if (!badge) return node;
          const currentName = (node as any).name;
          if (currentName == null) return node;

          // Fumadocs UI renders folder triggers/links as an array literal:
          // `[item.icon, item.name]`. Arrays of React elements require keys.
          ensureKeyedIcon(node as any);

          (node as any).name = React.createElement(
            'span',
            { className: 'unrag-nav-label', key: 'unrag-name' },
            React.createElement(
              'span',
              { className: 'unrag-nav-text' },
              React.Children.toArray(currentName),
            ),
            React.createElement(
              'span',
              { className: 'unrag-sidebar-badge' },
              badge,
            ),
          );

          return node;
        },
        file(node, file) {
          if (!file) return node;

          // `file` is an internal storage key. The storage read returns the original,
          // unfiltered file data (including our custom frontmatter/meta fields).
          const original = this.storage.read(file) as any;
          const data = original?.data ?? original;

          const badge =
            typeof data?.badge === 'string'
              ? data.badge
              : data?.new === true
                ? 'New'
                : undefined;

          // Keep default rendering unless a badge is explicitly set.
          if (!badge) return node;
          const currentName = (node as any).name;
          if (currentName == null) return node;

          ensureKeyedIcon(node as any);

          // We decorate the `name` with a badge node, but keep it hidden outside the
          // sidebar via CSS rules in `app/global.css`.
          (node as any).name = React.createElement(
            'span',
            { className: 'unrag-nav-label', key: 'unrag-name' },
            React.createElement(
              'span',
              { className: 'unrag-nav-text' },
              // Folder titles (and some page titles) can be a ReactNode array (e.g. icon + text).
              // Normalize to an array with stable keys to avoid React's "unique key" warning.
              React.Children.toArray(currentName),
            ),
            React.createElement(
              'span',
              { className: 'unrag-sidebar-badge' },
              badge,
            ),
          );

          return node;
        },
      },
    },
  ],
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: `/og/docs/${segments.join('/')}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title}

${processed}`;
}
