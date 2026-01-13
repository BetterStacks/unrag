/**
 * Tab navigation bar component.
 */

import React from "react";
import { Box, Text } from "ink";

type TabDefinition = {
  id: string;
  label: string;
  shortcut?: string;
};

type TabBarProps = {
  tabs: TabDefinition[];
  activeTab: string;
  onSelect: (tabId: string) => void;
};

export function TabBar({ tabs, activeTab, onSelect }: TabBarProps) {
  return (
    <Box paddingX={1} gap={2}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <Box key={tab.id}>
            <Text
              bold={isActive}
              color={isActive ? "cyan" : undefined}
              inverse={isActive}
            >
              {" "}
              {tab.shortcut && (
                <Text dimColor={!isActive}>[{tab.shortcut}]</Text>
              )}{" "}
              {tab.label}{" "}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

export default TabBar;
