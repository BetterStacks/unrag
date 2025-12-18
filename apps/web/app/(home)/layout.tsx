import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: LayoutProps<'/'>) {
  const { nav, ...base } = baseOptions();

  return (
    <HomeLayout
      {...base}
      nav={{
        ...nav,
        transparentMode: 'always'
      }}
    >
      {children}
    </HomeLayout>
  );
}
