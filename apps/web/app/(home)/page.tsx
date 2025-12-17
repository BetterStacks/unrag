import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1">
      <h1 className="text-3xl font-bold mb-4">Unrag</h1>
      <p>
        Shadcn-style RAG installer: drop ingest/retrieve primitives into any project.
      </p>
      <p className="mt-4">
        Start here:{' '}
        <Link href="/docs" className="font-medium underline">
          /docs
        </Link>{' '}
        .
      </p>
    </div>
  );
}
