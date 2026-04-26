import { useEffect, useState } from "react";
import { useThemeEngine } from "@/components/theme/ThemeProvider";
import type { Theme } from "@/lib/theme";

/**
 * Backward-compatible hook. New code should prefer `useThemeEngine` directly,
 * but every existing call site (TopBar, Settings) continues to work.
 */
export const useTheme = (): [Theme, (t: Theme) => void] => {
  const { theme, setTheme } = useThemeEngine();
  // Local mirror keeps Suspense / strict-mode renders stable
  const [t, setT] = useState<Theme>(theme);
  useEffect(() => { setT(theme); }, [theme]);
  return [t, setTheme];
};
