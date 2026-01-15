import type { ComponentProps, ReactNode } from 'react';
import { ButtonLink, Container, Eyebrow, PlainButtonLink, Subheading, Text } from '../elements';
import { ChevronIcon } from '../icons';

function CallToActionSimple({
  eyebrow,
  headline,
  subheadline,
  cta,
  className,
  ...props
}: {
  eyebrow?: ReactNode;
  headline: ReactNode;
  subheadline?: ReactNode;
  cta?: ReactNode;
} & ComponentProps<'section'>) {
  return (
    <section className={`py-16 ${className ?? ''}`} {...props}>
      <Container className="flex flex-col gap-10">
        <div className="flex flex-col gap-6">
          <div className="flex max-w-4xl flex-col gap-2">
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <Subheading>{headline}</Subheading>
          </div>
          {subheadline && <Text className="flex max-w-3xl flex-col gap-4 text-pretty">{subheadline}</Text>}
        </div>
        {cta}
      </Container>
    </section>
  );
}

export function CallToActionSection() {
  return (
    <CallToActionSimple
      id="call-to-action"
      headline="Ready to own your RAG?"
      subheadline={
        <p>
          Install Unrag, join hundreds of teams keeping their vector pipeline in their repo, and build the rest of
          your AI stack your way. No black-box, no third-party tooling.
        </p>
      }
      cta={
        <div className="flex items-center gap-4">
          <ButtonLink href="/install" size="lg">
            Install Unrag
          </ButtonLink>

          <PlainButtonLink href="/docs/getting-started/quickstart" size="lg">
            Read the quickstart <ChevronIcon />
          </PlainButtonLink>
        </div>
      }
    />
  );
}
