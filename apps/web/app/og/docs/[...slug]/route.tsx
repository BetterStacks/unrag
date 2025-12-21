import { getPageImage, source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';

export const revalidate = false;

const geistRegularPromise = readFile(
  new URL('./fonts/Geist-Regular.ttf', import.meta.url),
);

const geistBoldPromise = readFile(
  new URL('./fonts/Geist-Bold.ttf', import.meta.url),
);

const logoPromise = readFile(
  new URL('../../../../public/logo.svg', import.meta.url),
);

const bannerPromise = readFile(
  new URL('../../../../public/banner-og.png', import.meta.url),
);

export async function GET(
  _req: Request,
  { params }: RouteContext<'/og/docs/[...slug]'>,
) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  const [geistRegular, geistBold, logo, banner] = await Promise.all([
    geistRegularPromise,
    geistBoldPromise,
    logoPromise,
    bannerPromise,
  ]);

  const logoSrc = `data:image/svg+xml;base64,${logo.toString('base64')}`;

  const bannerSrc = `data:image/png;base64,${banner.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          position: 'relative',
          fontFamily: 'Geist',
        }}
      >
        {/* Background image */}
        <img
          src={bannerSrc}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        {/* Dark overlay gradient for better text readability */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(to right, rgba(0, 0, 0, 0.8) -30%, transparent 130%)',
          }}
        />
        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '60px 80px',
            height: '100%',
            position: 'relative',
            zIndex: 1,
            maxWidth: '1000px',
          }}
        >
          {/* Logo */}
          <img
            src={logoSrc}
            alt=""
            style={{
              width: 140,
              height: 35,
              marginBottom: 48,
            }}
          />
          {/* Title */}
          <div
            style={{
              fontSize: 70,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.4,
              marginBottom: 36
            }}
          >
            {page.data.title}
          </div>
          {/* Description */}
          {page.data.description && (
            <div
              style={{
                fontSize: 36,
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: 1.6,
                maxWidth: '700px',
              }}
            >
              {page.data.description}
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Geist',
          data: geistRegular,
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Geist',
          data: geistBold,
          weight: 700,
          style: 'normal',
        },
      ],
    },
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }));
}
