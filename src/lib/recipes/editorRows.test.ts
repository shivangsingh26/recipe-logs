import { describe, expect, it } from "vitest";
import { emptyRecipeDraft } from "@/lib/db/normalize";
import {
  applyPaste,
  draftFromEditorState,
  editorStateFromDraft,
  insertRow,
  itemNumbers,
  itemsFromRows,
  moveRow,
  removeRow,
  rowsFromItems,
  splitPastedText,
  type EditorRow,
} from "./editorRows";

/** Deterministic ids: n1, n2, … */
function counter() {
  let n = 0;
  return () => `n${++n}`;
}

const item = (id: string, text: string): EditorRow => ({ id, kind: "item", text });
const heading = (id: string, text: string): EditorRow => ({ id, kind: "heading", text });
const shape = (rows: EditorRow[]) => rows.map((r) => `${r.kind === "heading" ? "#" : ""}${r.text}`);

describe("rowsFromItems", () => {
  it("inserts a heading whenever the group changes and keeps item ids", () => {
    const rows = rowsFromItems(
      [
        { id: "a", text: "Onions", group: "Birista" },
        { id: "b", text: "Oil", group: "Birista" },
        { id: "c", text: "Chicken", group: "Marinade" },
      ],
      counter(),
    );
    expect(shape(rows)).toEqual(["#Birista", "Onions", "Oil", "#Marinade", "Chicken"]);
    expect(rows.filter((r) => r.kind === "item").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("starts without a heading when the first items have no group", () => {
    const rows = rowsFromItems([{ text: "Salt" }, { text: "Rice", group: "Rice" }], counter());
    expect(shape(rows)).toEqual(["Salt", "#Rice", "Rice"]);
  });

  it("writes a return to 'no group' as a blank heading", () => {
    const rows = rowsFromItems([{ text: "A", group: "G" }, { text: "B" }], counter());
    expect(shape(rows)).toEqual(["#G", "A", "#", "B"]);
  });

  it("gives missing and duplicate ids fresh unique ones without stealing existing ids", () => {
    const makeId = (() => {
      const queue = ["x", "x", "y", "z"];
      return () => queue.shift() ?? "fallback";
    })();
    const rows = rowsFromItems([{ text: "1" }, { id: "x", text: "2" }, { id: "x", text: "3" }], makeId);
    const itemIds = rows.map((r) => r.id);
    expect(itemIds[1]).toBe("x");
    expect(new Set(itemIds).size).toBe(3);
  });
});

describe("itemsFromRows", () => {
  it("assigns each item the nearest heading above and drops blank items", () => {
    const items = itemsFromRows([
      item("1", "Salt"),
      heading("h", "For the marinade:"),
      item("2", "  Curd  "),
      item("3", "   "),
      heading("h2", ""),
      item("4", "Water"),
    ]);
    expect(items).toEqual([
      { id: "1", text: "Salt" },
      { id: "2", text: "Curd", group: "For the marinade" },
      { id: "4", text: "Water" },
    ]);
  });

  it("round-trips grouped items", () => {
    const original = [
      { id: "a", text: "Onions", group: "Birista" },
      { id: "b", text: "Ghee" },
      { id: "c", text: "Rice", group: "Rice" },
    ];
    expect(itemsFromRows(rowsFromItems(original, counter()))).toEqual(original);
  });
});

describe("splitPastedText", () => {
  it("strips bullets and numbering and skips blank lines", () => {
    const text = "- 2 eggs\r\n* 1 cup milk\n\n• 1 tsp salt\n•2 tbsp oil\n1. Boil water\n2) Add rice\n- [ ] 1 onion";
    expect(splitPastedText(text)).toEqual(
      ["2 eggs", "1 cup milk", "1 tsp salt", "2 tbsp oil", "Boil water", "Add rice", "1 onion"].map((t) => ({
        kind: "item",
        text: t,
      })),
    );
  });

  it("keeps quantities that only look like numbering", () => {
    expect(splitPastedText("1.5 kg chicken\n1/2 cup curd").map((l) => l.text)).toEqual(["1.5 kg chicken", "1/2 cup curd"]);
  });

  it("turns '#' lines, lines ending in ':' and bold labels into headings", () => {
    expect(splitPastedText("## Rice\nFor the marinade:\n- Dum:\n**Garnish:**\n**Rest 10 min.**")).toEqual([
      { kind: "heading", text: "Rice" },
      { kind: "heading", text: "For the marinade" },
      { kind: "heading", text: "Dum" },
      { kind: "heading", text: "Garnish" },
      { kind: "item", text: "**Rest 10 min.**" },
    ]);
  });

  it("ignores lines without words", () => {
    expect(splitPastedText("---\n***\n•\n#\nSalt")).toEqual([{ kind: "item", text: "Salt" }]);
  });
});

describe("applyPaste", () => {
  it("returns null for single-line text so the browser pastes normally", () => {
    expect(applyPaste([item("a", "")], 0, { start: 0, end: 0 }, "2 eggs\n")).toBeNull();
  });

  it("fills an empty row and adds the remaining lines below it", () => {
    const rows = [item("a", ""), item("z", "Last")];
    const result = applyPaste(rows, 0, { start: 0, end: 0 }, "Marinade:\n- curd\n- salt", counter());
    expect(result && shape(result.rows)).toEqual(["#Marinade", "curd", "salt", "Last"]);
    expect(result?.rows[0].id).toBe("a");
    expect(result?.focusId).toBe("n2");
    expect(result?.caret).toBe(4);
  });

  it("splices into existing text at the selection like a text editor", () => {
    const rows = [item("a", "2 cups RICE water")];
    const result = applyPaste(rows, 0, { start: 7, end: 11 }, "basmati\n1 tsp salt\n", counter());
    expect(result && shape(result.rows)).toEqual(["2 cups basmati", "1 tsp salt water"]);
    expect(result?.rows[0]).toEqual({ id: "a", kind: "item", text: "2 cups basmati" });
    expect(result?.caret).toBe("1 tsp salt".length);
  });
});

describe("row edits", () => {
  const rows = [item("a", "A"), heading("h", "H"), item("b", "B")];

  it("inserts after an index (or at the top with -1)", () => {
    const { rows: next, id } = insertRow(rows, 0, "item", () => "new");
    expect(next.map((r) => r.id)).toEqual(["a", "new", "h", "b"]);
    expect(id).toBe("new");
    expect(insertRow(rows, -1, "heading", () => "top").rows[0]).toEqual({ id: "top", kind: "heading", text: "" });
    expect(insertRow(rows, 2, "item", () => "end").rows.at(-1)?.id).toBe("end");
  });

  it("removes and moves rows, ignoring moves past either end", () => {
    expect(removeRow(rows, 1).map((r) => r.id)).toEqual(["a", "b"]);
    expect(moveRow(rows, 2, -1).map((r) => r.id)).toEqual(["a", "b", "h"]);
    expect(moveRow(rows, 0, 1).map((r) => r.id)).toEqual(["h", "a", "b"]);
    expect(moveRow(rows, 0, -1).map((r) => r.id)).toEqual(["a", "h", "b"]);
    expect(moveRow(rows, 2, 1).map((r) => r.id)).toEqual(["a", "h", "b"]);
  });

  it("numbers items only", () => {
    expect(itemNumbers([heading("h", "Prep"), item("a", "x"), item("b", "y"), heading("i", "Dum"), item("c", "z")])).toEqual([
      null,
      1,
      2,
      null,
      3,
    ]);
  });
});

describe("editor state", () => {
  it("starts empty lists with one blank row that is dropped again on save", () => {
    const state = editorStateFromDraft({ ...emptyRecipeDraft(), title: "" }, counter());
    expect(state.ingredientRows).toEqual([{ id: "n1", kind: "item", text: "" }]);
    expect(state.stepRows).toHaveLength(1);
    const draft = draftFromEditorState({ ...state, title: "  Dal  ", notes: " tip \n" });
    expect(draft.title).toBe("Dal");
    expect(draft.notes).toBe("tip");
    expect(draft.ingredients).toEqual([]);
    expect(draft.steps).toEqual([]);
  });

  it("preserves ingredient and step ids through the form", () => {
    const draft = {
      ...emptyRecipeDraft(),
      ingredients: [{ id: "i1", text: "Salt", group: "Spices" }],
      steps: [{ id: "s1", text: "Cook" }],
    };
    const back = draftFromEditorState(editorStateFromDraft(draft, counter()));
    expect(back.ingredients).toEqual([{ id: "i1", text: "Salt", group: "Spices" }]);
    expect(back.steps).toEqual([{ id: "s1", text: "Cook" }]);
  });
});
