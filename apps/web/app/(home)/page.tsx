import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1">
      <h1 className="text-3xl font-bold mb-4">UnRAG</h1>
      <p>
        RAG installer that vendors small ingest/retrieve primitives into your project as source files you own.
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
