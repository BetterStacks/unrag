import type { ComponentProps, ReactNode } from 'react';
import { Link, Screenshot, Section } from '../elements';
import { ArrowNarrowRightIcon } from '../icons';

function Feature({
  demo,
  headline,
  subheadline,
  cta,
  className,
}: {
  demo: ReactNode;
  headline: ReactNode;
  subheadline: ReactNode;
  cta: ReactNode;
} & Omit<ComponentProps<'div'>, 'children'>) {
  return (
    <div className={`rounded-lg bg-olive-950/2.5 p-2 dark:bg-white/5 ${className ?? ''}`}>
      <div className="relative overflow-hidden rounded-sm dark:after:absolute dark:after:inset-0 dark:after:rounded-sm dark:after:outline-1 dark:after:-outline-offset-1 dark:after:outline-white/10">
        {demo}
      </div>
      <div className="flex flex-col gap-4 p-6 sm:p-10 lg:p-6">
        <div>
          <h3 className="text-base/8 font-medium text-olive-950 dark:text-white">{headline}</h3>
          <div className="mt-2 flex flex-col gap-4 text-sm/7 text-olive-700 dark:text-olive-400">{subheadline}</div>
        </div>
        {cta}
      </div>
    </div>
  );
}

function FeaturesTwoColumnWithDemos({
  features,
  ...props
}: { features: ReactNode } & Omit<ComponentProps<typeof Section>, 'children'>) {
  return (
    <Section {...props}>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">{features}</div>
    </Section>
  );
}

export function FeaturesSection() {
  return (
    <FeaturesTwoColumnWithDemos
      id="features"
      eyebrow="Built for ownership"
      headline="RAG primitives you can read, ship, and extend."
      subheadline={
        <p>
          Install a small, auditable module into your codebase and keep the core of retrieval fully under your control.
        </p>
      }
      features={
        <>
          <Feature
            demo={
              <Screenshot wallpaper="purple" placement="bottom-right">
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?left=1000&top=800"
                  alt=""
                  className="bg-white/75 sm:hidden dark:hidden"
                  width={1000}
                  height={800}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?left=1000&top=800&color=olive"
                  alt=""
                  className="bg-black/75 not-dark:hidden sm:hidden"
                  width={1000}
                  height={800}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?left=1800&top=660"
                  alt=""
                  className="bg-white/75 max-sm:hidden lg:hidden dark:hidden"
                  width={1800}
                  height={660}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?left=1800&top=660&color=olive"
                  alt=""
                  className="bg-black/75 not-dark:hidden max-sm:hidden lg:hidden"
                  width={1800}
                  height={660}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?left=1300&top=1300"
                  alt=""
                  className="bg-white/75 max-lg:hidden xl:hidden dark:hidden"
                  width={1300}
                  height={1300}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?left=1300&top=1300&color=olive"
                  alt=""
                  className="bg-black/75 not-dark:hidden max-lg:hidden xl:hidden"
                  width={1300}
                  height={1300}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?left=1800&top=1250"
                  alt=""
                  className="bg-white/75 max-xl:hidden dark:hidden"
                  width={1800}
                  height={1250}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?left=1800&top=1250&color=olive"
                  alt=""
                  className="bg-black/75 not-dark:hidden max-xl:hidden"
                  width={1800}
                  height={1250}
                />
              </Screenshot>
            }
            headline="Vendored source, not a black box"
            subheadline={
              <p>
                Unrag installs TypeScript source files you own. Review them in PRs, debug locally, and change the behavior
                when your product needs it.
              </p>
            }
            cta={
              <Link href="/docs/getting-started/installation">
                See the install flow <ArrowNarrowRightIcon />
              </Link>
            }
          />
          <Feature
            demo={
              <Screenshot wallpaper="blue" placement="bottom-left">
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?right=1000&top=800"
                  alt=""
                  className="bg-white/75 sm:hidden dark:hidden"
                  width={1000}
                  height={800}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?right=1000&top=800&color=olive"
                  alt=""
                  className="bg-black/75 not-dark:hidden sm:hidden"
                  width={1000}
                  height={800}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?right=1800&top=660"
                  alt=""
                  className="bg-white/75 max-sm:hidden lg:hidden dark:hidden"
                  width={1800}
                  height={660}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?right=1800&top=660&color=olive"
                  alt=""
                  className="bg-black/75 not-dark:hidden max-sm:hidden lg:hidden"
                  width={1800}
                  height={660}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?right=1300&top=1300"
                  alt=""
                  className="bg-white/75 max-lg:hidden xl:hidden dark:hidden"
                  width={1300}
                  height={1300}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?right=1300&top=1300&color=olive"
                  alt=""
                  className="bg-black/75 not-dark:hidden max-lg:hidden xl:hidden"
                  width={1300}
                  height={1300}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?right=1800&top=1250"
                  alt=""
                  className="bg-white/75 max-xl:hidden dark:hidden"
                  width={1800}
                  height={1250}
                />
                <img
                  src="https://assets.tailwindplus.com/screenshots/1.webp?right=1800&top=1250&color=olive"
                  alt=""
                  className="bg-black/75 not-dark:hidden max-xl:hidden"
                  width={1800}
                  height={1250}
                />
              </Screenshot>
            }
            headline="Postgres + pgvector by default"
            subheadline={
              <p>
                Store vectors in the database you already run. Unrag ships adapters for Drizzle, Prisma, and raw SQL so
                you can keep your stack and your migrations.
              </p>
            }
            cta={
              <Link href="/docs/concepts/architecture">
                Explore the pipeline <ArrowNarrowRightIcon />
              </Link>
            }
          />
        </>
      }
    />
  );
}
