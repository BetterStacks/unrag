import { clsx } from 'clsx/lite';
import type { ComponentProps, ReactNode } from 'react';
import { AnnouncementBadge, ButtonLink, Container, Heading, Logo, LogoGrid, PlainButtonLink, Text } from '../elements';
import { ArrowNarrowRightIcon } from '../icons';

function HeroLeftAlignedWithDemo({
  eyebrow,
  headline,
  subheadline,
  cta,
  demo,
  footer,
  className,
  ...props
}: {
  eyebrow?: ReactNode;
  headline: ReactNode;
  subheadline: ReactNode;
  cta?: ReactNode;
  demo?: ReactNode;
  footer?: ReactNode;
} & ComponentProps<'section'>) {
  return (
    <section className={className} {...props}>
      <Container className="flex flex-col gap-16">
        <div className="flex flex-col gap-32">
          <div className="flex flex-col items-start gap-6">
            {eyebrow}
            <Heading className="max-w-5xl">{headline}</Heading>
            <Text size="lg" className="flex max-w-3xl flex-col gap-4">
              {subheadline}
            </Text>
            {cta}
          </div>
          {demo}
        </div>
        {footer}
      </Container>
    </section>
  );
}

function HeroImageFrame({ className, imageClassName }: { className?: string; imageClassName?: string }) {
  return (
    <div
      className={clsx('relative overflow-hidden bg-cover bg-center', className)}
      style={{ backgroundImage: "url('/hero-image-bg.png')" }}
    >
      <div className="relative [--padding:min(10%,--spacing(16))] max-h-[700px] overflow-hidden px-(--padding) pt-(--padding)">
        <div className="*:relative *:ring-1 *:ring-black/10 *:rounded-t-sm">
          <img
            src="/hero-image.png"
            alt="Unrag product interface"
            className={clsx('block w-full', imageClassName)}
          />
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <HeroLeftAlignedWithDemo
      id="hero"
      className="py-16"
      eyebrow={<AnnouncementBadge href="/docs/debugging" text="Devtools for debugging RAG pipelines" cta="Learn more" />}
      headline="Composable & extendable primitives to build rag systems."
      subheadline={
        <p>
          A simple system of ergonomically designed primitives that you can customize, extend, and build on to create
          versatile, robust and extendable RAG systems.
        </p>
      }
      cta={
        <div className="flex items-center gap-4">
          <ButtonLink href="/install" size="lg">
            Install Unrag
          </ButtonLink>

          <PlainButtonLink href="/docs" size="lg">
            Go to documentation <ArrowNarrowRightIcon />
          </PlainButtonLink>
        </div>
      }
      demo={
        <>
          <HeroImageFrame className="rounded-md lg:hidden" />
          <HeroImageFrame className="rounded-lg max-lg:hidden" />
        </>
      }
      footer={
        <LogoGrid>
          <Logo>
            <img
              src="https://assets.tailwindplus.com/logos/9.svg?color=black&height=32"
              className="dark:hidden"
              alt=""
              width={51}
              height={32}
            />
            <img
              src="https://assets.tailwindplus.com/logos/9.svg?color=white&height=32"
              className="bg-black/75 not-dark:hidden"
              alt=""
              width={51}
              height={32}
            />
          </Logo>
          <Logo>
            <img
              src="https://assets.tailwindplus.com/logos/10.svg?color=black&height=32"
              className="dark:hidden"
              alt=""
              width={70}
              height={32}
            />
            <img
              src="https://assets.tailwindplus.com/logos/10.svg?color=white&height=32"
              className="bg-black/75 not-dark:hidden"
              alt=""
              width={70}
              height={32}
            />
          </Logo>
          <Logo>
            <img
              src="https://assets.tailwindplus.com/logos/11.svg?color=black&height=32"
              className="dark:hidden"
              alt=""
              width={100}
              height={32}
            />
            <img
              src="https://assets.tailwindplus.com/logos/11.svg?color=white&height=32"
              className="bg-black/75 not-dark:hidden"
              alt=""
              width={100}
              height={32}
            />
          </Logo>
          <Logo>
            <img
              src="https://assets.tailwindplus.com/logos/12.svg?color=black&height=32"
              className="dark:hidden"
              alt=""
              width={85}
              height={32}
            />
            <img
              src="https://assets.tailwindplus.com/logos/12.svg?color=white&height=32"
              className="bg-black/75 not-dark:hidden"
              alt=""
              width={85}
              height={32}
            />
          </Logo>
          <Logo>
            <img
              src="https://assets.tailwindplus.com/logos/13.svg?color=black&height=32"
              className="dark:hidden"
              alt=""
              width={75}
              height={32}
            />
            <img
              src="https://assets.tailwindplus.com/logos/13.svg?color=white&height=32"
              className="bg-black/75 not-dark:hidden"
              alt=""
              width={75}
              height={32}
            />
          </Logo>
          <Logo>
            <img
              src="https://assets.tailwindplus.com/logos/8.svg?color=black&height=32"
              className="dark:hidden"
              alt=""
              width={85}
              height={32}
            />
            <img
              src="https://assets.tailwindplus.com/logos/8.svg?color=white&height=32"
              className="bg-black/75 not-dark:hidden"
              alt=""
              width={85}
              height={32}
            />
          </Logo>
        </LogoGrid>
      }
    />
  );
}
