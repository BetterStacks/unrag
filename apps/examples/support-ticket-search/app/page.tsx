import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { TicketSearch } from "@/components/ticket-search";

export default async function Page() {
  const tickets = await db
    .select()
    .from(schema.supportTickets)
    .orderBy(desc(schema.supportTickets.createdAt))
    .limit(50);

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <TicketSearch initialTickets={tickets} />
      </div>
      <footer className="py-6 text-center">
        <p className="text-muted-foreground text-xs">
          Powered by{" "}
          <a
            href="https://unrag.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            unrag.dev
          </a>
        </p>
      </footer>
    </div>
  );
}
