import { describe, expect, it } from "vitest";
import { parseRefMarks } from "../src/lib/ref-mark";

describe("parseRefMarks", () => {
  it("解析章节引用", () => {
    const marks = parseRefMarks("[第一章](ref:chapter:abc-123)");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ label: "第一章", type: "chapter", id: "abc-123", range: undefined });
    expect(marks[0].start).toBe(0);
  });

  it("解析角色引用", () => {
    const marks = parseRefMarks("看看 [林麦穗](ref:character:def-456) 的性格");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ label: "林麦穗", type: "character", id: "def-456" });
    expect(marks[0].start).toBe(3);
  });

  it("解析设定引用", () => {
    const marks = parseRefMarks("[魔法体系](ref:setting:ghi-789)");
    expect(marks).toMatchObject([{ label: "魔法体系", type: "setting", id: "ghi-789" }]);
  });

  it("解析带段落范围的引用", () => {
    const marks = parseRefMarks("[第一章](ref:chapter:abc:L5-L8)");
    expect(marks).toMatchObject([{ label: "第一章", type: "chapter", id: "abc", range: "L5-L8" }]);
  });

  it("解析同一消息中的多个引用", () => {
    const text = "[第一章](ref:chapter:aaa) 和 [林麦穗](ref:character:bbb) 怎么样？";
    const marks = parseRefMarks(text);
    expect(marks).toHaveLength(2);
    expect(marks[0]).toMatchObject({ type: "chapter", id: "aaa" });
    expect(marks[1]).toMatchObject({ type: "character", id: "bbb" });
  });

  it("解析不同类型的多个引用", () => {
    const text = "[第一章](ref:chapter:c1) [魔法](ref:setting:s1) [林麦穗](ref:character:p1)";
    const marks = parseRefMarks(text);
    expect(marks.map((m) => m.type)).toEqual(["chapter", "setting", "character"]);
  });

  it("正确计算混合文本中的位置偏移", () => {
    const text = "请问 [第一章](ref:chapter:c1) 的 [林麦穗](ref:character:p1) 怎么改？";
    const marks = parseRefMarks(text);
    expect(text.slice(marks[0].start, marks[0].end)).toBe("[第一章](ref:chapter:c1)");
    expect(text.slice(marks[1].start, marks[1].end)).toBe("[林麦穗](ref:character:p1)");
  });

  it("无引用时返回空数组", () => {
    expect(parseRefMarks("普通消息没有引用")).toEqual([]);
    expect(parseRefMarks("")).toEqual([]);
  });

  it("不匹配普通 markdown link", () => {
    const marks = parseRefMarks("[点击这里](https://example.com)");
    expect(marks).toEqual([]);
  });

  it("不匹配非引用类型", () => {
    const marks = parseRefMarks("[东西](ref:unknown:id123)");
    expect(marks).toEqual([]);
  });

  it("不匹配缺少 id 的标记", () => {
    const marks = parseRefMarks("[名称](ref:chapter:)");
    expect(marks).toEqual([]);
  });

  it("同一 id 重复出现时每个都被解析", () => {
    const text = "[第一章](ref:chapter:c1) 和 [第一章](ref:chapter:c1:L5-L8)";
    const marks = parseRefMarks(text);
    expect(marks).toHaveLength(2);
  });

  it("处理包含特殊字符的名称", () => {
    const marks = parseRefMarks("[第一章：谷雨（上）](ref:chapter:c1)");
    expect(marks).toHaveLength(1);
    expect(marks[0].label).toBe("第一章：谷雨（上）");
  });

  it("段落范围只匹配 L数字-L数字 格式", () => {
    expect(parseRefMarks("[章](ref:chapter:c1:L5-L8)")).toHaveLength(1);
    expect(parseRefMarks("[章](ref:chapter:c1:5-8)")).toHaveLength(0);
    expect(parseRefMarks("[章](ref:chapter:c1:invalid)")).toHaveLength(0);
  });

  it("marks 之间不重叠", () => {
    const text = "[A](ref:chapter:a) [B](ref:character:b) [C](ref:setting:c)";
    const marks = parseRefMarks(text);
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i].start).toBeGreaterThanOrEqual(marks[i - 1].end);
    }
  });
});
