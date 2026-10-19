import { describe, expect, it } from "vitest";
import { parseBold, parseNotes, sourceHost, sourceUrl } from "./notes";

describe("parseNotes", () => {
  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    expect(parseNotes("First line\nsecond line\n\n  \nNew paragraph")).toEqual([
      { type: "paragraph", lines: ["First line", "second line"] },
      { type: "paragraph", lines: ["New paragraph"] },
    ]);
  });

  it("turns '- ', '* ' and '• ' lines into bullet lists", () => {
    expect(parseNotes("Tips:\n- one\n* two\n• three\nAfter")).toEqual([
      { type: "paragraph", lines: ["Tips:"] },
      { type: "list", items: ["one", "two", "three"] },
      { type: "paragraph", lines: ["After"] },
    ]);
  });

  it("does not treat bold text as a bullet", () => {
    expect(parseNotes("**Tip:** rest it")).toEqual([{ type: "paragraph", lines: ["**Tip:** rest it"] }]);
  });

  it("returns nothing for blank notes", () => {
    expect(parseNotes("  \n \n")).toEqual([]);
  });
});

describe("parseBold", () => {
  it("splits bold spans", () => {
    expect(parseBold("Use **ghee** not **oil**.")).toEqual([
      { text: "Use ", bold: false },
      { text: "ghee", bold: true },
      { text: " not ", bold: false },
      { text: "oil", bold: true },
      { text: ".", bold: false },
    ]);
  });

  it("leaves unpaired markers and markup-looking text as plain text", () => {
    expect(parseBold("2 ** 3 <b>x</b>")).toEqual([{ text: "2 ** 3 <b>x</b>", bold: false }]);
  });
});

describe("source links", () => {
  it("accepts only http(s) URLs", () => {
    expect(sourceUrl(" https://www.example.com/a?b=1 ")).toBe("https://www.example.com/a?b=1");
    expect(sourceUrl("javascript:alert(1)")).toBeNull();
    expect(sourceUrl("Grandma's notebook")).toBeNull();
    expect(sourceUrl("https://exa mple.com")).toBeNull();
  });

  it("shows the host without www", () => {
    expect(sourceHost("https://www.example.com/recipes/1")).toBe("example.com");
  });
});
