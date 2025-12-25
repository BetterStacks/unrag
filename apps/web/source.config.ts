import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from 'fumadocs-mdx/config';
import { z } from 'zod';
import {
  rehypeCode,
  remarkMdxMermaid,
  type RehypeCodeOptions,
} from 'fumadocs-core/mdx-plugins';

// Code syntax highlighting theme configuration
const rehypeCodeOptions: RehypeCodeOptions = {
  themes: {
    light: 'github-light',
    dark: 'night-owl',
  },
};

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: frontmatterSchema.extend({
      /**
       * Optional badge text to render in the sidebar (e.g. "New").
       * This is used by our page-tree transform in `lib/source.ts`.
       */
      badge: z.string().optional(),
      /**
       * Convenience boolean: if true, we render a "New" badge.
       */
      new: z.boolean().optional(),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema.extend({
      /**
       * Optional badge text to render for this folder in the sidebar (e.g. "New").
       */
      badge: z.string().optional(),
      /**
       * Convenience boolean: if true, we render a "New" badge.
       */
      new: z.boolean().optional(),
    }),
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMdxMermaid],
    rehypePlugins: [[rehypeCode, rehypeCodeOptions]],
  },
});
