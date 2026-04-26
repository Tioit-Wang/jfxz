import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

beforeEach(() => {
  document.cookie = "jfxz_csrf=csrf-token; path=/";
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  })
});

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    writeText: async () => undefined
  }
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverMock
});

Object.defineProperty(document, "elementFromPoint", {
  configurable: true,
  value: () => document.body
});

if (!Range.prototype.getClientRects) {
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => []
  });
}

if (!Range.prototype.getBoundingClientRect) {
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => undefined
    })
  });
}

Object.defineProperty(HTMLElement.prototype, "getClientRects", {
  configurable: true,
  value: () => []
});
