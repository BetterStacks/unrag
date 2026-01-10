import { createUnragEngine } from "@/unrag.config";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const topK = parseInt(searchParams.get("topK") || "10");
    const useRerank = searchParams.get("rerank") === "true";

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const engine = createUnragEngine();

    // Perform semantic search
    // If reranking, retrieve more candidates first
    const retrieveTopK = useRerank ? Math.max(topK * 3, 30) : topK;
    let results = await engine.retrieve({
      query,
      topK: retrieveTopK,
    });

    // Rerank if enabled
    if (useRerank && results.chunks.length > 0) {
      const reranked = await engine.rerank({
        query,
        candidates: results.chunks,
        topK,
      });

      console.log("Reranked results:", reranked);

      results = { ...results, chunks: reranked.chunks };
    }

    // Extract ticket IDs from results
    const ticketIds = results.chunks
      .map((chunk) => {
        const ticketId = chunk.metadata?.ticketId as string | undefined;
        return ticketId;
      })
      .filter((id): id is string => !!id);

    // Fetch full ticket details
    const uniqueTicketIds = [...new Set(ticketIds)];
    const tickets =
      uniqueTicketIds.length > 0
        ? await db
            .select()
            .from(schema.supportTickets)
            .where(inArray(schema.supportTickets.id, uniqueTicketIds))
        : [];

    // Map tickets by ID for quick lookup
    const ticketMap = new Map(tickets.map((t) => [t.id, t]));

    // Combine results with full ticket data
    const enrichedResults = results.chunks.map((chunk) => {
      const ticketId = chunk.metadata?.ticketId as string | undefined;
      const ticket = ticketId ? ticketMap.get(ticketId) : undefined;

      return {
        chunk: {
          id: chunk.id,
          content: chunk.content,
          score: chunk.score,
        },
        ticket,
      };
    });

    return NextResponse.json({
      query,
      results: enrichedResults,
      count: enrichedResults.length,
    });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
