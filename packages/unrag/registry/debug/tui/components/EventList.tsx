/**
 * Event list component with filtering and details.
 */

import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import type { DebugEvent, DebugEventType } from "@registry/core/debug-events";
import { EventRow } from "./EventRow";
import { EventDetail } from "./EventDetail";

type EventListProps = {
  events: DebugEvent[];
};

type FilterType = "all" | "ingest" | "retrieve" | "rerank" | "delete";

const FILTERS: { id: FilterType; label: string; shortcut: string }[] = [
  { id: "all", label: "All", shortcut: "a" },
  { id: "ingest", label: "Ingest", shortcut: "i" },
  { id: "retrieve", label: "Retrieve", shortcut: "r" },
  { id: "rerank", label: "Rerank", shortcut: "k" },
  { id: "delete", label: "Delete", shortcut: "d" },
];

export function EventList({ events }: EventListProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDetail, setShowDetail] = useState(false);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.type.startsWith(filter));
  }, [events, filter]);

  // Keep selection in bounds
  const maxIndex = Math.max(0, filteredEvents.length - 1);
  const boundedIndex = Math.min(selectedIndex, maxIndex);

  // Reverse to show newest first
  const displayEvents = useMemo(
    () => [...filteredEvents].reverse(),
    [filteredEvents]
  );

  const selectedEvent = displayEvents[boundedIndex];

  useInput((input, key) => {
    // Filter shortcuts
    for (const f of FILTERS) {
      if (input === f.shortcut) {
        setFilter(f.id);
        setSelectedIndex(0);
        return;
      }
    }

    // Navigation
    if (key.upArrow || input === "k") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow || input === "j") {
      setSelectedIndex((prev) => Math.min(maxIndex, prev + 1));
      return;
    }

    // Toggle detail view
    if (key.return || input === "e") {
      setShowDetail((prev) => !prev);
      return;
    }

    // Close detail view
    if (key.escape && showDetail) {
      setShowDetail(false);
      return;
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Filter bar */}
      <Box gap={2} marginBottom={1}>
        {FILTERS.map((f) => (
          <Text
            key={f.id}
            inverse={filter === f.id}
            color={filter === f.id ? "cyan" : undefined}
          >
            {" "}
            [{f.shortcut}] {f.label}{" "}
          </Text>
        ))}
      </Box>

      {/* Event count */}
      <Text dimColor>
        Showing {displayEvents.length} events
        {filter !== "all" && ` (filtered: ${filter})`}
      </Text>

      {showDetail && selectedEvent ? (
        /* Detail view */
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Press Escape or Enter to close detail view</Text>
          <EventDetail event={selectedEvent} />
        </Box>
      ) : (
        /* List view */
        <Box flexDirection="column" marginTop={1} flexGrow={1}>
          <Text dimColor>
            j/k or arrows: navigate | Enter/e: expand | Filter shortcuts shown
            above
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {displayEvents.length === 0 ? (
              <Text dimColor>No events matching filter.</Text>
            ) : (
              displayEvents.slice(0, 20).map((event, i) => (
                <EventRow
                  key={`${event.timestamp}-${i}`}
                  event={event}
                  selected={i === boundedIndex}
                  compact={false}
                />
              ))
            )}
            {displayEvents.length > 20 && (
              <Text dimColor>... and {displayEvents.length - 20} more</Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default EventList;
