import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from 'fumadocs-mdx/config';
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
    schema: frontmatterSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMdxMermaid],
    rehypePlugins: [[rehypeCode, rehypeCodeOptions]],
  },
});
