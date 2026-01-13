/**
 * Help overlay component showing keyboard shortcuts.
 */

import React from "react";
import { Box, Text, useInput } from "ink";

type HelpOverlayProps = {
  onClose: () => void;
};

type Shortcut = {
  keys: string;
  description: string;
};

const GLOBAL_SHORTCUTS: Shortcut[] = [
  { keys: "q / Ctrl+C", description: "Quit" },
  { keys: "? / h", description: "Toggle help" },
  { keys: "Tab", description: "Next tab" },
  { keys: "Shift+Tab", description: "Previous tab" },
  { keys: "1-2", description: "Switch to tab by number" },
];

const EVENT_LIST_SHORTCUTS: Shortcut[] = [
  { keys: "j / Down", description: "Move down" },
  { keys: "k / Up", description: "Move up" },
  { keys: "Enter / e", description: "Toggle event details" },
  { keys: "Escape", description: "Close details" },
  { keys: "a", description: "Show all events" },
  { keys: "i", description: "Filter ingest events" },
  { keys: "r", description: "Filter retrieve events" },
  { keys: "k", description: "Filter rerank events" },
  { keys: "d", description: "Filter delete events" },
];

function ShortcutSection({
  title,
  shortcuts,
}: {
  title: string;
  shortcuts: Shortcut[];
}) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        {title}
      </Text>
      {shortcuts.map((s, i) => (
        <Box key={i}>
          <Text color="yellow">{s.keys.padEnd(16)}</Text>
          <Text dimColor>{s.description}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function HelpOverlay({ onClose }: HelpOverlayProps) {
  useInput((input, key) => {
    if (key.escape || key.return || input === "?" || input === "h") {
      onClose();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      padding={1}
      marginTop={1}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Keyboard Shortcuts
        </Text>
        <Text dimColor> (Press ? or Escape to close)</Text>
      </Box>

      <ShortcutSection title="Global" shortcuts={GLOBAL_SHORTCUTS} />
      <ShortcutSection title="Events Tab" shortcuts={EVENT_LIST_SHORTCUTS} />

      <Box marginTop={1}>
        <Text dimColor>
          Tip: The debug TUI connects to your app via WebSocket on port 3847.
          Make sure UNRAG_DEBUG=true is set in your app environment.
        </Text>
      </Box>
    </Box>
  );
}

export default HelpOverlay;
