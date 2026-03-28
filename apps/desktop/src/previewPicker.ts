import type { DesktopPreviewElementSelection } from "@okcode/contracts";

const PREVIEW_PICKER_CHANNEL = "__okcodePreviewPicker";

function buildPreviewPickerScript(): string {
  return `
(() => {
  const CHANNEL_KEY = ${JSON.stringify(PREVIEW_PICKER_CHANNEL)};
  const globalState = window;
  const existingPicker = globalState[CHANNEL_KEY];
  if (existingPicker && typeof existingPicker.cancel === "function") {
    existingPicker.cancel();
  }

  const escapeSelector = (value) => {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
  };

  const normalizeText = (value, maxLength = 180) => {
    const normalized = typeof value === "string" ? value.replace(/\\s+/g, " ").trim() : "";
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd() + "...";
  };

  const describeElement = (element) => {
    const tagName = (element.tagName || "element").toLowerCase();
    const role = normalizeText(element.getAttribute("role"), 80) || null;
    const ariaLabel = normalizeText(element.getAttribute("aria-label"), 120) || null;
    const text =
      normalizeText(
        "innerText" in element && typeof element.innerText === "string"
          ? element.innerText
          : element.textContent,
      ) || "";
    const href =
      "href" in element && typeof element.href === "string" && element.href.length > 0
        ? element.href
        : null;
    const name = normalizeText(element.getAttribute("name"), 120) || null;
    const placeholder = normalizeText(element.getAttribute("placeholder"), 120) || null;
    const pageTitle = normalizeText(document.title, 160) || null;
    const pageUrl = window.location.href;
    const selector = buildSelector(element);

    return {
      pageUrl,
      pageTitle,
      selector,
      tagName,
      role,
      ariaLabel,
      text,
      href,
      name,
      placeholder,
    };
  };

  const describeLabel = (selection) => {
    const kind = selection.role || selection.tagName || "element";
    const primary =
      selection.ariaLabel ||
      selection.text ||
      selection.placeholder ||
      selection.name ||
      selection.selector;
    if (primary && primary !== selection.selector) {
      return kind + ' "' + primary + '"';
    }
    return kind + " " + selection.selector;
  };

  const buildSelector = (element) => {
    const segments = [];
    let current = element;
    let depth = 0;

    while (current && current.nodeType === Node.ELEMENT_NODE && depth < 5) {
      const tagName = current.tagName.toLowerCase();
      if (current.id) {
        segments.unshift(tagName + "#" + escapeSelector(current.id));
        break;
      }

      let segment = tagName;
      const prioritizedAttributes = [
        "data-testid",
        "data-test",
        "data-qa",
        "aria-label",
        "name",
      ];
      for (const attributeName of prioritizedAttributes) {
        const attributeValue = current.getAttribute(attributeName);
        if (!attributeValue) {
          continue;
        }
        segment +=
          "[" +
          attributeName +
          '="' +
          String(attributeValue).replace(/"/g, '\\\\"') +
          '"]';
        segments.unshift(segment);
        return segments.join(" > ");
      }

      const classNames = Array.from(current.classList)
        .filter(Boolean)
        .slice(0, 2);
      if (classNames.length > 0) {
        segment += classNames.map((className) => "." + escapeSelector(className)).join("");
      } else if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children).filter(
          (child) => child.tagName === current.tagName,
        );
        if (siblings.length > 1) {
          const siblingIndex = siblings.indexOf(current);
          segment += ":nth-of-type(" + String(siblingIndex + 1) + ")";
        }
      }

      segments.unshift(segment);
      current = current.parentElement;
      depth += 1;
    }

    return segments.join(" > ");
  };

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.width = "0";
  overlay.style.height = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "2147483646";
  overlay.style.borderRadius = "8px";
  overlay.style.border = "2px solid rgba(59, 130, 246, 0.92)";
  overlay.style.background = "rgba(59, 130, 246, 0.12)";
  overlay.style.boxShadow = "0 0 0 1px rgba(15, 23, 42, 0.3), 0 10px 30px rgba(15, 23, 42, 0.18)";

  const badge = document.createElement("div");
  badge.style.position = "fixed";
  badge.style.left = "0";
  badge.style.top = "0";
  badge.style.maxWidth = "min(360px, calc(100vw - 24px))";
  badge.style.pointerEvents = "none";
  badge.style.zIndex = "2147483647";
  badge.style.borderRadius = "999px";
  badge.style.padding = "6px 10px";
  badge.style.font = "600 12px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  badge.style.color = "white";
  badge.style.background = "rgba(15, 23, 42, 0.88)";
  badge.style.boxShadow = "0 10px 24px rgba(15, 23, 42, 0.28)";
  badge.style.transform = "translate(-9999px, -9999px)";
  badge.textContent = "Select an element";

  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(badge);

  let activeTarget = null;
  let resolved = false;

  const moveOverlayToTarget = (target) => {
    if (!target) {
      overlay.style.width = "0";
      overlay.style.height = "0";
      badge.style.transform = "translate(-9999px, -9999px)";
      return;
    }

    const rect = target.getBoundingClientRect();
    overlay.style.left = rect.left + "px";
    overlay.style.top = rect.top + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";

    const selection = describeElement(target);
    badge.textContent = describeLabel(selection);
    const nextLeft = Math.max(12, Math.min(rect.left, window.innerWidth - 372));
    const nextTop = rect.top > 40 ? rect.top - 36 : rect.bottom + 12;
    badge.style.transform = "translate(" + nextLeft + "px, " + nextTop + "px)";
  };

  const cleanup = (result) => {
    if (resolved) {
      return result;
    }
    resolved = true;
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("scroll", onViewportChange, true);
    window.removeEventListener("resize", onViewportChange, true);
    overlay.remove();
    badge.remove();
    if (globalState[CHANNEL_KEY] && globalState[CHANNEL_KEY].cleanup === cleanup) {
      delete globalState[CHANNEL_KEY];
    }
    return result;
  };

  const cancel = () => cleanup(null);

  const updateTarget = (target) => {
    if (!(target instanceof Element)) {
      activeTarget = null;
      moveOverlayToTarget(null);
      return;
    }
    activeTarget = target;
    moveOverlayToTarget(target);
  };

  const onMouseMove = (event) => {
    updateTarget(document.elementFromPoint(event.clientX, event.clientY));
  };

  const onViewportChange = () => {
    moveOverlayToTarget(activeTarget);
  };

  const onClick = (event) => {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!(target instanceof Element)) {
      event.preventDefault();
      event.stopPropagation();
      resolvePromise(cancel());
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    resolvePromise(cleanup(describeElement(target)));
  };

  const onKeyDown = (event) => {
    if (event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    resolvePromise(cancel());
  };

  globalState[CHANNEL_KEY] = {
    cancel: () => resolvePromise(cancel()),
    cleanup,
  };

  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("scroll", onViewportChange, true);
  window.addEventListener("resize", onViewportChange, true);

  updateTarget(document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2));
  return promise;
})()
`;
}

const PREVIEW_PICKER_SCRIPT = buildPreviewPickerScript();

const PREVIEW_PICKER_CANCEL_SCRIPT = `
(() => {
  const picker = window[${JSON.stringify(PREVIEW_PICKER_CHANNEL)}];
  if (picker && typeof picker.cancel === "function") {
    picker.cancel();
  }
})()
`;

interface PreviewPickerWebContents {
  executeJavaScript<T>(code: string): Promise<T>;
}

export async function beginPreviewElementPick(
  webContents: PreviewPickerWebContents,
): Promise<DesktopPreviewElementSelection | null> {
  return webContents.executeJavaScript<DesktopPreviewElementSelection | null>(
    PREVIEW_PICKER_SCRIPT,
  );
}

export async function cancelPreviewElementPick(
  webContents: PreviewPickerWebContents,
): Promise<void> {
  await webContents.executeJavaScript(PREVIEW_PICKER_CANCEL_SCRIPT);
}
