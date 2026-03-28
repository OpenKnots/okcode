import { useEffect, useMemo } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useMediaQuery } from "./useMediaQuery";
import {
  CLIENT_MODE_STORAGE_KEY,
  type ClientMode,
  persistClientMode,
  readClientModeFromSearch,
  readClientModeFromStorage,
  resolveClientMode,
} from "../lib/clientMode";

export function useClientMode(): ClientMode {
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const prefersMobileViewport = useMediaQuery({ max: "md", pointer: "coarse" });
  const queryMode = useMemo(() => readClientModeFromSearch(search), [search]);
  const storedMode =
    typeof window === "undefined" ? null : readClientModeFromStorage(window.localStorage);

  useEffect(() => {
    if (typeof window === "undefined" || queryMode === null) {
      return;
    }
    persistClientMode(window.localStorage, queryMode);
  }, [queryMode]);

  return resolveClientMode({
    search,
    storedMode,
    prefersMobileViewport,
  });
}

export { CLIENT_MODE_STORAGE_KEY };
