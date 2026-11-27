import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { CodeEditor } from "./CodeEditor";

afterEach(cleanup);

describe("CodeEditor", () => {
  it("numbers every line and shows the file header", () => {
    const { container } = render(
      <CodeEditor value={"# title\n\n- rule"} filename="skill.md" status="unsaved" meta="~3 tokens" aria-label="Body" />,
    );
    const gutter = container.querySelector('[aria-hidden="true"]')!;
    expect(Array.from(gutter.children).map((n) => n.textContent)).toEqual(["1", "2", "3"]);
    expect(screen.getByText("skill.md")).toBeTruthy();
    expect(screen.getByText("unsaved")).toBeTruthy();
    expect(screen.getByText("~3 tokens")).toBeTruthy();
  });

  it("is a real textarea: forwards props and reports edits", () => {
    const onChange = vi.fn();
    render(<CodeEditor value="a" onChange={onChange} aria-label="Body" aria-invalid />);
    const box = screen.getByRole("textbox", { name: "Body" }) as HTMLTextAreaElement;
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(box.getAttribute("wrap")).toBe("off");
    fireEvent.change(box, { target: { value: "a\nb" } });
    expect(onChange).toHaveBeenCalledWith("a\nb");
  });

  it("leaves the header out when there is nothing to show in it", () => {
    render(<CodeEditor value="x" aria-label="Body" />);
    expect(screen.queryByText(/tokens/)).toBeNull();
  });
});
