import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type CSSProperties } from "react";

import {
  Sidebar,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuSubButton,
  SidebarProvider,
} from "./sidebar";

function renderSidebarButton(className?: string) {
  return renderToStaticMarkup(
    <SidebarProvider>
      <SidebarMenuButton className={className}>Projects</SidebarMenuButton>
    </SidebarProvider>,
  );
}

describe("sidebar interactive cursors", () => {
  it("uses a pointer cursor for menu buttons by default", () => {
    const html = renderSidebarButton();

    expect(html).toContain('data-slot="sidebar-menu-button"');
    expect(html).toContain("cursor-pointer");
  });

  it("lets project drag handles override the default pointer cursor", () => {
    const html = renderSidebarButton("cursor-grab");

    expect(html).toContain("cursor-grab");
    expect(html).not.toContain("cursor-pointer");
  });

  it("uses a pointer cursor for menu actions", () => {
    const html = renderToStaticMarkup(
      <SidebarMenuAction aria-label="Create thread">
        <span>+</span>
      </SidebarMenuAction>,
    );

    expect(html).toContain('data-slot="sidebar-menu-action"');
    expect(html).toContain("cursor-pointer");
  });

  it("uses a pointer cursor for submenu buttons", () => {
    const html = renderToStaticMarkup(
      <SidebarMenuSubButton render={<button type="button" />}>Show more</SidebarMenuSubButton>,
    );

    expect(html).toContain('data-slot="sidebar-menu-sub-button"');
    expect(html).toContain("cursor-pointer");
  });

  it("applies sidebar transparency to the surface color instead of container opacity", () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <Sidebar
          style={
            {
              "--sidebar-background-opacity": 0.4,
              "--sidebar-border-opacity": 0.52,
            } as CSSProperties
          }
        >
          <div>Projects</div>
        </Sidebar>
      </SidebarProvider>,
    );

    expect(html).toContain("--sidebar-background-opacity:0.4");
    expect(html).toContain("background-color:color-mix");
    expect(html).toContain("border-color:color-mix");
    expect(html).not.toContain("opacity:0.4");
  });
});
