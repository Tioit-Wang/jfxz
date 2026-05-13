import { describe, expect, it } from "vitest";
import { formatRange, getParagraphRange } from "../src/components/ChapterPlainTextEditor";

function makeDoc(paragraphs: string[]) {
  // ProseMirror paragraph: nodeSize = content.length + 2 (start token + content + end token)
  const nodeSizes = paragraphs.map((t) => t.length + 2);
  // Absolute doc position of each paragraph start = 1 + sum of previous nodeSizes
  // (doc open token at pos 0, first paragraph at pos 1)
  const offsets = [1];
  for (let i = 1; i < nodeSizes.length; i++) {
    offsets.push(offsets[i - 1] + nodeSizes[i - 1]);
  }
  return {
    resolve(pos: number) {
      // Find which paragraph contains this position
      for (let i = nodeSizes.length - 1; i >= 0; i--) {
        if (pos >= offsets[i]) {
          return { index: (_depth: number) => i };
        }
      }
      return { index: (_depth: number) => 0 };
    }
  };
}

describe("getParagraphRange", () => {
  it("选区在第1段内 → {start:1, end:1}", () => {
    const doc = makeDoc(["第一段文字"]);
    // from=2 is inside the paragraph
    expect(getParagraphRange(doc, 2, 5)).toEqual({ start: 1, end: 1 });
  });

  it("选区跨第2-3段 → {start:2, end:3}", () => {
    const doc = makeDoc(["第一段", "第二段", "第三段", "第四段"]);
    // start inside 2nd para, end inside 3rd para
    expect(getParagraphRange(doc, 7, 12)).toEqual({ start: 2, end: 3 });
  });

  it("选区覆盖全文 → {start:1, end:N}", () => {
    const doc = makeDoc(["a", "b", "c"]);
    expect(getParagraphRange(doc, 0, 8)).toEqual({ start: 1, end: 3 });
  });

  it("选区只选中段落中部分文字 → 仍返回段落范围", () => {
    const doc = makeDoc(["第一段", "第二段超长文字", "第三段"]);
    expect(getParagraphRange(doc, 7, 10)).toEqual({ start: 2, end: 2 });
  });
});

describe("formatRange", () => {
  it("格式化段落范围", () => {
    expect(formatRange({ start: 5, end: 8 })).toBe("L5-L8");
  });

  it("单段落范围", () => {
    expect(formatRange({ start: 3, end: 3 })).toBe("L3-L3");
  });
});
