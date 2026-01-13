/**
 * Main Debug TUI Application.
 *
 * Terminal interface for debugging Unrag RAG operations.
 * Uses Ink (React for CLI) for rendering.
 */

import React, { useState, useCallback } from "react";
import { render, Box, useInput, useApp } from "ink";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { StatusBar } from "./components/StatusBar";
import { Dashboard } from "./components/Dashboard";
import { EventList } from "./components/EventList";
import { HelpOverlay } from "./components/HelpOverlay";
import { useConnection } from "./hooks/useConnection";
import { useEvents } from "./hooks/useEvents";
import { useTerminalSize } from "./hooks/useTerminalSize";

export type Tab = "dashboard" | "events";

type AppProps = {
  url?: string;
};

export function App({ url }: AppProps) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [showHelp, setShowHelp] = useState(false);
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();

  const connection = useConnection(url);
  const events = useEvents(connection);

  // Tab navigation
  const tabs: Tab[] = ["dashboard", "events"];

  const cycleTab = useCallback(
    (direction: 1 | -1) => {
      const currentIndex = tabs.indexOf(activeTab);
      const newIndex = (currentIndex + direction + tabs.length) % tabs.length;
      setActiveTab(tabs[newIndex] ?? "dashboard");
    },
    [activeTab, tabs]
  );

  // Keyboard handling
  useInput((input, key) => {
    // Quit
    if (input === "q" || (key.ctrl && input === "c")) {
      connection.disconnect();
      exit();
      return;
    }

    // Help toggle
    if (input === "?" || input === "h") {
      setShowHelp((prev) => !prev);
      return;
    }

    // Close help overlay if open
    if (showHelp && (key.escape || key.return)) {
      setShowHelp(false);
      return;
    }

    // Tab navigation
    if (key.tab || (key.shift && key.tab)) {
      cycleTab(key.shift ? -1 : 1);
      return;
    }

    // Number keys for direct tab selection
    if (input === "1") setActiveTab("dashboard");
    if (input === "2") setActiveTab("events");
  });

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Header bar */}
      <Header
        title="Unrag Debug"
        status={connection.status}
        sessionId={connection.sessionId}
        columns={columns}
        rows={rows}
      />

      {/* Tab bar */}
      <TabBar
        tabs={[
          { id: "dashboard", label: "Dashboard", shortcut: "1" },
          { id: "events", label: "Events", shortcut: "2" },
        ]}
        activeTab={activeTab}
        onSelect={(tab) => setActiveTab(tab as Tab)}
      />

      {/* Main content */}
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        {activeTab === "dashboard" && (
          <Dashboard events={events} connection={connection} />
        )}
        {activeTab === "events" && <EventList events={events} />}
      </Box>

      {/* Status bar */}
      <StatusBar
        hint="? help · q quit"
        eventCount={events.length}
        status={connection.status}
      />

      {/* Help overlay */}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </Box>
  );
}

type RunOptions = {
  url?: string;
};

/**
 * Run the debug TUI.
 */
export function runDebugTui(options?: RunOptions) {
  const { waitUntilExit } = render(<App url={options?.url} />);
  return waitUntilExit();
}

export default App;
