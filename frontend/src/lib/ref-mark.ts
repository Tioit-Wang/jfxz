export type ParsedRefMark = {
  type: "chapter" | "character" | "setting";
  id: string;
  label: string;
  range?: string;
  start: number;
  end: number;
};

const REF_MARK_REGEX = /\[([^\]]+)\]\(ref:(chapter|character|setting):([^:\)]+)(?::(L\d+-L\d+))?\)/g;

export function parseRefMarks(text: string): ParsedRefMark[] {
  const marks: ParsedRefMark[] = [];
  let match: RegExpExecArray | null;
  while ((match = REF_MARK_REGEX.exec(text)) !== null) {
    marks.push({
      label: match[1],
      type: match[2] as ParsedRefMark["type"],
      id: match[3],
      range: match[4],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return marks;
}
