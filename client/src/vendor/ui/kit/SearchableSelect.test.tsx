import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SearchableSelect } from "./SearchableSelect";
import { MENU_CHROME_PX, placeMenu } from "./placeMenu";

afterEach(cleanup);

const OPTIONS = [
  { value: "a", label: "alpha" },
  { value: "b", label: "beta" },
];

/** The select inside a clipping, scrolling pane — like the agent editor body. */
function renderInScrollPane(onChange = vi.fn()) {
  render(
    <div data-testid="pane" style={{ height: 120, overflow: "auto" }}>
      <SearchableSelect value="" placeholder="Link a skill…" options={OPTIONS} onChange={onChange} />
    </div>,
  );
  return { onChange, pane: screen.getByTestId("pane") };
}

describe("SearchableSelect", () => {
  it("opens its menu in a fixed layer on <body>, outside a clipping ancestor", () => {
    const { pane } = renderInScrollPane();
    fireEvent.click(screen.getByText("Link a skill…"));
    const listbox = screen.getByRole("listbox");
    const menu = listbox.parentElement!;
    expect(pane.contains(menu)).toBe(false);
    expect(menu.parentElement).toBe(document.body);
    expect(menu.style.position).toBe("fixed");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["alpha", "beta"]);
  });

  it("picks an option and closes", () => {
    const { onChange } = renderInScrollPane();
    fireEvent.click(screen.getByText("Link a skill…"));
    fireEvent.click(screen.getByRole("option", { name: "beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("stays open while typing in its search box, closes on an outside click", () => {
    renderInScrollPane();
    fireEvent.click(screen.getByText("Link a skill…"));
    const search = screen.getByPlaceholderText("Link a skill…");
    fireEvent.mouseDown(search);
    fireEvent.change(search, { target: { value: "alp" } });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["alpha"]);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("placeMenu", () => {
  const trigger = (top: number) => ({ top, bottom: top + 40, left: 100, width: 300 });

  it("opens below with the full list when there is room", () => {
    expect(placeMenu(trigger(100), 900, 280)).toEqual({ left: 100, width: 300, top: 146, listMaxHeight: 280 });
  });

  it("opens above near the bottom of the viewport", () => {
    const p = placeMenu(trigger(760), 900, 280);
    expect(p.top).toBeUndefined();
    expect(p.bottom).toBe(900 - 760 + 6);
    expect(p.listMaxHeight).toBe(280);
  });

  it("shrinks the list to the room left, never below a usable minimum", () => {
    // 200 px below, 50 px above → stays below, list = 200 - 6 - 8 - chrome.
    expect(placeMenu(trigger(50), 50 + 40 + 200, 280).listMaxHeight).toBe(200 - 6 - 8 - MENU_CHROME_PX);
    expect(placeMenu(trigger(10), 100, 280).listMaxHeight).toBe(120);
  });
});
