import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import conventions from "../../../../../../../messages/en/conventions.json";
import { ConventionCard, type ConventionRepo } from "./ConventionCard";

afterEach(cleanup);

const REPO: ConventionRepo = { full_name: "acme/api", default_branch: "main" };

const candidate = (over: Partial<ConventionCandidate> = {}): ConventionCandidate => ({
  id: "c1",
  rule: "Throw NotFoundError from services when an entity is missing.",
  evidence_path: "server/src/users/service.ts",
  evidence_snippet: "    const user = await this.repo.findById(id);\n    if (!user) throw new NotFoundError('User not found');",
  confidence: 0.9,
  accepted: false,
  status: "pending",
  evidence_start_line: 12,
  evidence_end_line: 14,
  commit_sha: "c0ffee12",
  created_at: "2026-11-26T10:00:00.000Z",
  ...over,
});

function renderCard(c: ConventionCandidate, repo: ConventionRepo | null = REPO) {
  const onSetStatus = vi.fn();
  const onSaveRule = vi.fn(async () => ({}));
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions }}>
      <ConventionCard candidate={c} repo={repo} onSetStatus={onSetStatus} onSaveRule={onSaveRule} />
    </NextIntlClientProvider>,
  );
  return { onSetStatus, onSaveRule };
}

describe("ConventionCard", () => {
  it("shows the rule, the evidence (file:lines + real snippet) and the confidence", () => {
    renderCard(candidate());
    expect(screen.getByText("Throw NotFoundError from services when an entity is missing.")).toBeInTheDocument();
    expect(screen.getByText(/if \(!user\) throw new NotFoundError/)).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("links the evidence to GitHub at the checked commit and lines", () => {
    renderCard(candidate());
    const link = screen.getByRole("link", { name: "server/src/users/service.ts:L12-L14" });
    expect(link).toHaveAttribute("href", "https://github.com/acme/api/blob/c0ffee12/server/src/users/service.ts#L12-L14");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("falls back to the default branch without a sha, and to plain text before the repo loads", () => {
    renderCard(candidate({ commit_sha: null, evidence_end_line: 12 }));
    expect(screen.getByRole("link", { name: "server/src/users/service.ts:L12" })).toHaveAttribute(
      "href",
      "https://github.com/acme/api/blob/main/server/src/users/service.ts#L12",
    );
    cleanup();
    renderCard(candidate(), null);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("server/src/users/service.ts:L12-L14")).toBeInTheDocument();
  });

  it("Accept / Reject send the status; a decided card moves back to review on a second click", () => {
    const { onSetStatus } = renderCard(candidate());
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onSetStatus.mock.calls).toEqual([["accepted"], ["rejected"]]);
    cleanup();

    const accepted = renderCard(candidate({ status: "accepted", accepted: true }));
    const badge = screen.getByRole("button", { name: "Accepted" });
    expect(badge).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(badge);
    expect(accepted.onSetStatus).toHaveBeenCalledWith("pending");
    cleanup();

    const rejected = renderCard(candidate({ status: "rejected" }));
    fireEvent.click(screen.getByRole("button", { name: "Rejected" }));
    expect(rejected.onSetStatus).toHaveBeenCalledWith("pending");
  });

  it("edits the rule: Save sends the trimmed text, blank is blocked, Cancel restores", async () => {
    const { onSaveRule } = renderCard(candidate());
    fireEvent.click(screen.getByRole("button", { name: "Edit rule" }));
    const box = screen.getByRole("textbox", { name: "Rule text" });
    fireEvent.change(box, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(box, { target: { value: "  Services throw NotFoundError.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Rule text" })).toBeNull());
    expect(onSaveRule).toHaveBeenCalledWith("Services throw NotFoundError.");

    fireEvent.click(screen.getByRole("button", { name: "Edit rule" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Rule text" }), { target: { value: "changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Throw NotFoundError from services when an entity is missing.")).toBeInTheDocument();
    expect(onSaveRule).toHaveBeenCalledTimes(1);
  });

  it("shows the Include in skill checkbox only when the parent passes a selection", () => {
    renderCard(candidate({ status: "accepted", accepted: true }));
    expect(screen.queryByRole("checkbox")).toBeNull();
    cleanup();

    const onChange = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ conventions }}>
        <ConventionCard
          candidate={candidate({ status: "accepted", accepted: true })}
          repo={REPO}
          onSetStatus={vi.fn()}
          onSaveRule={vi.fn()}
          selection={{ checked: true, onChange }}
        />
      </NextIntlClientProvider>,
    );
    const box = screen.getByRole("checkbox", { name: "Include in skill" });
    expect(box).toHaveAttribute("aria-checked", "true");
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("renders a snippet as text, never as HTML", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{ conventions }}>
        <ConventionCard
          candidate={candidate({ evidence_snippet: '<img src=x onerror="alert(1)">' })}
          repo={REPO}
          onSetStatus={vi.fn()}
          onSaveRule={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
  });
});
