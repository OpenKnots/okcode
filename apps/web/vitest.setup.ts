function HTMLElementShim() {}

if (typeof globalThis.HTMLElement === "undefined") {
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    // Provide the minimal DOM surface needed by @create-markdown/preview in node tests.
    value: HTMLElementShim,
    writable: true,
  });
}

if (typeof globalThis.customElements === "undefined") {
  Object.defineProperty(globalThis, "customElements", {
    configurable: true,
    value: {
      define() {},
      get() {
        return undefined;
      },
    },
    writable: true,
  });
}
