import type { ComponentProps, ReactNode } from 'react';
import { Container } from '../elements';
import { ArrowNarrowRightIcon, GitHubIcon } from '../icons';

function FooterCategory({ title, children, ...props }: { title: ReactNode } & ComponentProps<'div'>) {
  return (
    <div {...props}>
      <h3>{title}</h3>
      <ul role="list" className="mt-2 flex flex-col gap-2">
        {children}
      </ul>
    </div>
  );
}

function FooterLink({ href, className, ...props }: { href: string } & Omit<ComponentProps<'a'>, 'href'>) {
  return (
    <li className={`text-olive-700 dark:text-olive-400 ${className ?? ''}`}>
      <a href={href} {...props} />
    </li>
  );
}

function SocialLink({
  href,
  name,
  className,
  ...props
}: {
  href: string;
  name: string;
} & Omit<ComponentProps<'a'>, 'href'>) {
  return (
    <a
      href={href}
      target="_blank"
      aria-label={name}
      className={`text-olive-950 *:size-6 dark:text-white ${className ?? ''}`}
      {...props}
    />
  );
}

function NewsletterForm({
  headline,
  subheadline,
  className,
  ...props
}: {
  headline: ReactNode;
  subheadline: ReactNode;
} & ComponentProps<'form'>) {
  return (
    <form className={`flex max-w-sm flex-col gap-2 ${className ?? ''}`} {...props}>
      <p>{headline}</p>
      <div className="flex flex-col gap-4 text-olive-700 dark:text-olive-400">{subheadline}</div>
      <div className="flex items-center border-b border-olive-950/20 py-2 has-[input:focus]:border-olive-950 dark:border-white/20 dark:has-[input:focus]:border-white">
        <input
          type="email"
          placeholder="Email"
          aria-label="Email"
          className="flex-1 text-olive-950 focus:outline-hidden dark:text-white"
        />
        <button
          type="submit"
          aria-label="Subscribe"
          className="relative inline-flex size-7 items-center justify-center rounded-full after:absolute after:-inset-2 hover:bg-olive-950/10 dark:hover:bg-white/10 after:pointer-fine:hidden"
        >
          <ArrowNarrowRightIcon />
        </button>
      </div>
    </form>
  );
}

function FooterWithNewsletterFormCategoriesAndSocialIcons({
  cta,
  links,
  fineprint,
  socialLinks,
  className,
  ...props
}: {
  cta: ReactNode;
  links: ReactNode;
  fineprint: ReactNode;
  socialLinks?: ReactNode;
} & ComponentProps<'footer'>) {
  return (
    <footer className={`pt-16 ${className ?? ''}`} {...props}>
      <div className="bg-olive-950/2.5 py-16 text-olive-950 dark:bg-white/5 dark:text-white">
        <Container className="flex flex-col gap-16">
          <div className="grid grid-cols-1 gap-x-6 gap-y-16 text-sm/7 lg:grid-cols-2">
            {cta}
            <nav className="grid grid-cols-2 gap-6 sm:has-[>:last-child:nth-child(3)]:grid-cols-3 sm:has-[>:nth-child(5)]:grid-cols-3 md:has-[>:last-child:nth-child(4)]:grid-cols-4 lg:max-xl:has-[>:last-child:nth-child(4)]:grid-cols-2">
              {links}
            </nav>
          </div>
          <div className="flex items-center justify-between gap-10 text-sm/7">
            <div className="text-olive-600 dark:text-olive-500">{fineprint}</div>
            {socialLinks && <div className="flex items-center gap-4 sm:gap-10">{socialLinks}</div>}
          </div>
        </Container>
      </div>
    </footer>
  );
}

export function FooterSection() {
  return (
    <FooterWithNewsletterFormCategoriesAndSocialIcons
      id="footer"
      cta={
        <NewsletterForm
          headline="Stay in the loop"
          subheadline={
            <p>Get release notes, RAG implementation tips, and new adapters as they ship.</p>
          }
          action="#"
        />
      }
      links={
        <>
          <FooterCategory title="Product">
            <FooterLink href="/docs/getting-started/installation">Install</FooterLink>
            <FooterLink href="/docs/getting-started/quickstart">Quickstart</FooterLink>
            <FooterLink href="/docs/reference/unrag-config">Config reference</FooterLink>
          </FooterCategory>
          <FooterCategory title="Company">
            <FooterLink href="https://github.com/BetterStacks/unrag">GitHub</FooterLink>
            <FooterLink href="/docs/changelog">Changelog</FooterLink>
            <FooterLink href="/docs/getting-started/introduction">About Unrag</FooterLink>
          </FooterCategory>
          <FooterCategory title="Resources">
            <FooterLink href="/docs">Documentation</FooterLink>
            <FooterLink href="/docs/concepts/architecture">Architecture</FooterLink>
            <FooterLink href="/docs/concepts/philosophy">Philosophy</FooterLink>
            <FooterLink href="/docs/debugging">Debugging</FooterLink>
          </FooterCategory>
          <FooterCategory title="Legal">
            <FooterLink href="https://github.com/BetterStacks/unrag/blob/main/LICENSE">License</FooterLink>
          </FooterCategory>
        </>
      }
      fineprint="© 2025 Betterstacks, Ltd."
      socialLinks={
        <>
          <SocialLink href="https://github.com/BetterStacks/unrag" name="GitHub">
            <GitHubIcon />
          </SocialLink>
        </>
      }
    />
  );
}
