import { describe, expect, it } from "vitest";
import { cn } from "../src/lib/utils";

describe("ui utilities", () => {
  it("merges conditional class names and resolves tailwind conflicts", () => {
    expect(cn("px-2", false && "hidden", "px-4", ["text-sm"])).toBe("px-4 text-sm");
  });
});
