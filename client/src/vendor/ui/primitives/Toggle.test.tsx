import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Toggle } from "./Toggle";

afterEach(cleanup);

describe("Toggle", () => {
  it("is a named switch that reports the next value", () => {
    const onChange = vi.fn();
    render(<Toggle on={false} onChange={onChange} label="Enable skill" />);
    const sw = screen.getByRole("switch", { name: "Enable skill" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("never submits a surrounding form (type=button)", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Toggle on onChange={() => {}} label="Enabled" />
      </form>,
    );
    const sw = screen.getByRole("switch", { name: "Enabled" });
    expect(sw).toHaveAttribute("type", "button");
    fireEvent.click(sw);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
