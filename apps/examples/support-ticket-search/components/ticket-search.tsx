"use client";

import * as React from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { TicketList } from "@/components/ticket-list";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { SupportTicket } from "@/db/schema";
import { MagnifyingGlassIcon, XIcon, ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { Switch } from "@/components/ui/switch";
import { motion } from "motion/react";
import { toast } from "sonner";

function truncate(str: string, maxLength: number) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

interface SearchResult {
  chunk: {
    id: string;
    content: string;
    score: number;
  };
  ticket?: SupportTicket;
}

interface TicketSearchProps {
  initialTickets: SupportTicket[];
}

const exampleQueries = [
  {
    query: "customer charged twice",
    description: "Find billing disputes",
  },
  {
    query: "can't login to my account",
    description: "Authentication issues",
  },
  {
    query: "api returning errors intermittently",
    description: "Technical problems",
  },
  {
    query: "request for dark mode",
    description: "Feature requests",
  },
];

export function TicketSearch({ initialTickets }: TicketSearchProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [useRerank, setUseRerank] = React.useState(false);

  const search = React.useCallback(async (searchQuery: string, rerank: boolean) => {
    if (!searchQuery.trim()) {
      setResults(null);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&topK=10&rerank=${rerank}`
      );

      if (response.status === 429) {
        toast.error("Bro calm down, our servers are melting", {
          description: "Too many requests. Try again in a minute",
        });
        setHasSearched(false);
        return;
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    search(query, useRerank);
  };

  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
    search(exampleQuery, useRerank);
  };

  const displayTickets = results
    ? results.map((r) => r.ticket).filter((t): t is SupportTicket => !!t)
    : [];

  const showCentered = !hasSearched;

  if (showCentered) {
    return (
      <div className="flex min-h-[70vh] flex-col justify-center">
        <div className="space-y-8">
          <div className="space-y-1 text-center">
            <h1 className="text-foreground text-xl font-medium">
              Support Ticket Search
            </h1>
            <p className="text-muted-foreground text-sm">
              Search support tickets in natural language
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mx-auto max-w-md">
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <MagnifyingGlassIcon className="size-3.5" weight="bold" />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Describe what you're looking for..."
              />
              {query && (
                <InputGroupAddon align="inline-end">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setResults(null);
                      setHasSearched(false);
                    }}
                  >
                    <XIcon className="size-3" weight="bold" />
                  </Button>
                </InputGroupAddon>
              )}
            </InputGroup>
          </form>

          <div className="space-y-3">
            <p className="text-muted-foreground text-center text-xs">
              Examples
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {exampleQueries.map((example) => (
                <Button
                  key={example.query}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExampleClick(example.query)}
                >
                  {example.query}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <MagnifyingGlassIcon className="size-3.5" weight="bold" />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe what you're looking for..."
          />
          {query && (
            <InputGroupAddon align="inline-end">
              <Button
                variant="ghost"
                size="icon-xs"
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults(null);
                  setHasSearched(false);
                }}
              >
                <XIcon className="size-3" weight="bold" />
              </Button>
            </InputGroupAddon>
          )}
        </InputGroup>
      </form>

      {isSearching ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center">
          <Shimmer className="font-mono text-sm" duration={2} spread={2}>
            {`engine.retrieve({ query: "${truncate(query, 24)}" })`}
          </Shimmer>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <p className="text-muted-foreground text-xs">
                {displayTickets.length} results for "{query}"
              </p>
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <Switch
                  size="sm"
                  checked={useRerank}
                  onCheckedChange={(checked) => {
                    setUseRerank(checked);
                    search(query, checked);
                  }}
                />
                <span>Rerank</span>
              </label>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setQuery("");
                setResults(null);
                setHasSearched(false);
              }}
            >
              Clear
            </Button>
          </div>
          <TicketList tickets={displayTickets} />
        </motion.div>
      )}
    </div>
  );
}
