import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SelectInput } from "./SelectInput";

afterEach(cleanup);

describe("SelectInput", () => {
  it("gives every option the theme's background and text colour (readable native popup)", () => {
    render(<SelectInput value="rubric" options={["rubric", "convention", { value: "custom", label: "Custom" }]} />);
    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options.map((o) => o.textContent)).toEqual(["rubric", "convention", "Custom"]);
    for (const o of options) {
      expect(o.style.background).toBe("var(--bg-elevated)");
      expect(o.style.color).toBe("var(--text-primary)");
    }
  });

  it("reports the chosen value", () => {
    const onChange = vi.fn();
    render(<SelectInput value="a" options={["a", "b"]} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "b" } });
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
