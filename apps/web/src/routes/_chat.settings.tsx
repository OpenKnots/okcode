import { Outlet, createFileRoute } from "@tanstack/react-router";

import { SettingsRouteContextProvider } from "../components/settings/SettingsRouteContext";

function SettingsLayoutRouteView() {
  return (
    <SettingsRouteContextProvider>
      <Outlet />
    </SettingsRouteContextProvider>
  );
}

export const Route = createFileRoute("/_chat/settings")({
  component: SettingsLayoutRouteView,
});
