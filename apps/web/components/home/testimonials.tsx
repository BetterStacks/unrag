import type { ComponentProps, ReactNode } from 'react';
import { Section } from '../elements';

function Testimonial({
  quote,
  img,
  name,
  byline,
  className,
  ...props
}: {
  quote: ReactNode;
  img: ReactNode;
  name: ReactNode;
  byline: ReactNode;
} & ComponentProps<'blockquote'>) {
  return (
    <figure
      className={`flex flex-col justify-between gap-10 rounded-md bg-olive-950/2.5 p-6 text-sm/7 text-olive-950 dark:bg-white/5 dark:text-white ${className ?? ''}`}
      {...props}
    >
      <blockquote className="relative flex flex-col gap-4 *:first:before:absolute *:first:before:inline *:first:before:-translate-x-full *:first:before:content-['“'] *:last:after:inline *:last:after:content-['”']">
        {quote}
      </blockquote>
      <figcaption className="flex items-center gap-4">
        <div className="flex size-12 overflow-hidden rounded-full outline -outline-offset-1 outline-black/5 *:size-full *:object-cover dark:outline-white/5">
          {img}
        </div>
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-olive-700 dark:text-olive-400">{byline}</p>
        </div>
      </figcaption>
    </figure>
  );
}

function TestimonialThreeColumnGrid({ children, ...props }: ComponentProps<typeof Section>) {
  return (
    <Section {...props}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </Section>
  );
}

export function TestimonialsSection() {
  return (
    <TestimonialThreeColumnGrid
      id="testimonial"
      headline="What teams build with Unrag"
      subheadline={<p>Notes from builders who wanted RAG they could actually own and evolve.</p>}
    >
      <Testimonial
        quote={
          <p>
            We needed RAG we could debug and ship. Unrag gave us a clean baseline we could read and extend without
            waiting on a vendor.
          </p>
        }
        img={
          <img
            src="https://assets.tailwindplus.com/avatars/10.webp?size=160"
            alt=""
            className="not-dark:bg-white/75 dark:bg-black/75"
            width={160}
            height={160}
          />
        }
        name="Jordan Rogers"
        byline="Founder at Anomaly"
      />
      <Testimonial
        quote={
          <p>
            The Postgres-first approach fit our stack perfectly. We kept our migrations and added vector search without
            rewriting half the app.
          </p>
        }
        img={
          <img
            src="https://assets.tailwindplus.com/avatars/15.webp?size=160"
            alt=""
            className="not-dark:bg-white/75 dark:bg-black/75"
            width={160}
            height={160}
          />
        }
        name="Lynn Marshall"
        byline="Founder at Pine Labs"
      />
      <Testimonial
        quote={
          <p>
            The primitives are small enough to audit in one sitting. That made compliance reviews fast and painless.
          </p>
        }
        img={
          <img
            src="https://assets.tailwindplus.com/avatars/13.webp?size=160"
            alt=""
            className="not-dark:bg-white/75 dark:bg-black/75"
            width={160}
            height={160}
          />
        }
        name="Rajat Singh"
        byline="Head of Support at Concise"
      />
      <Testimonial
        quote={
          <p>
            We swapped in our own chunker and embedding provider in a day. It felt like wiring up utilities, not adopting
            a framework.
          </p>
        }
        img={
          <img
            src="https://assets.tailwindplus.com/avatars/12.webp?size=160"
            alt=""
            className="not-dark:bg-white/75 dark:bg-black/75"
            width={160}
            height={160}
          />
        }
        name="John Walters"
        byline="CPO at Orbital"
      />
      <Testimonial
        quote={
          <p>
            I wanted ownership and clarity. The code lives in my repo, and I can change it when my product changes.
          </p>
        }
        img={
          <img
            src="https://assets.tailwindplus.com/avatars/11.webp?size=160"
            alt=""
            className="not-dark:bg-white/75 dark:bg-black/75"
            width={160}
            height={160}
          />
        }
        name="Noah Gold"
        byline="CEO at Looply"
      />
      <Testimonial
        quote={
          <p>
            The install was straightforward, and the engine API is refreshingly simple. It feels like part of our code,
            not a dependency we fear.
          </p>
        }
        img={
          <img
            src="https://assets.tailwindplus.com/avatars/14.webp?size=160"
            alt=""
            className="not-dark:bg-white/75 dark:bg-black/75"
            width={160}
            height={160}
          />
        }
        name="Mark Levinson"
        byline="COO at Quirk"
      />
    </TestimonialThreeColumnGrid>
  );
}
