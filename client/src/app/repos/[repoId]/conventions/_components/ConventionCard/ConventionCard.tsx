/* ConventionCard — one candidate: the rule (editable), its evidence (file:lines
   linking to GitHub at the commit the evidence was checked against, plus the
   real snippet), confidence, and Accept / Reject (a second click moves the
   candidate back to review). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, IconBtn, MonoLink, ProgressBar, Textarea } from "@devdigest/ui";
import type { ConventionCandidate, ConventionStatus } from "@devdigest/shared";
import { githubBlobUrl } from "@/lib/github-urls";
import { lineRef } from "./helpers";
import { s } from "./styles";

export interface ConventionRepo {
  full_name: string;
  default_branch: string;
}

export function ConventionCard({
  candidate: c,
  repo,
  onSetStatus,
  onSaveRule,
}: {
  candidate: ConventionCandidate;
  /** Null until the repos list has loaded: the evidence is shown without a link. */
  repo: ConventionRepo | null;
  onSetStatus: (status: ConventionStatus) => void;
  /** Resolves when saved; the card leaves edit mode only then. */
  onSaveRule: (rule: string) => Promise<unknown>;
}) {
  const t = useTranslations("conventions");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(c.rule);
  const [saving, setSaving] = React.useState(false);

  const label = `${c.evidence_path}:${lineRef(c)}`;
  const href = repo
    ? githubBlobUrl(repo.full_name, c.commit_sha ?? repo.default_branch, c.evidence_path, c.evidence_start_line, c.evidence_end_line)
    : undefined;
  const pct = Math.round(c.confidence * 100);

  const startEdit = () => {
    setDraft(c.rule);
    setEditing(true);
  };
  const save = async () => {
    const rule = draft.trim();
    if (!rule) return;
    setSaving(true);
    try {
      await onSaveRule(rule);
      setEditing(false);
    } catch {
      // The error is toasted globally; stay in edit mode so nothing typed is lost.
    } finally {
      setSaving(false);
    }
  };

  return (
    <article aria-label={c.rule} style={s.card(c.status)}>
      <div style={s.main}>
        {editing ? (
          <div>
            <Textarea rows={3} value={draft} onChange={setDraft} aria-label={t("card.editLabel")} autoFocus />
            <div style={s.editActions}>
              <Button kind="primary" size="sm" icon="Check" onClick={save} disabled={!draft.trim() || saving} loading={saving}>
                {t("card.save")}
              </Button>
              <Button kind="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                {t("card.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div style={s.ruleRow}>
            <p style={s.rule}>{c.rule}</p>
            <IconBtn icon="Edit" label={t("card.edit")} size={26} onClick={startEdit} />
          </div>
        )}

        <div style={s.evidence}>
          <div style={s.evidenceHead}>
            {href ? (
              <span title={t("card.evidenceLink", { file: c.evidence_path })}>
                <MonoLink href={href}>{label}</MonoLink>
              </span>
            ) : (
              <span className="mono">{label}</span>
            )}
          </div>
          <pre className="mono" style={s.snippet}>
            {c.evidence_snippet}
          </pre>
        </div>

        <div style={s.confRow}>
          <span style={s.confLabel}>{t("card.confidence")}</span>
          <div style={s.confBar}>
            <ProgressBar value={pct} height={5} color={c.confidence >= 0.85 ? "var(--ok)" : "var(--warn)"} />
          </div>
          <span className="mono tnum" style={s.confValue}>
            {pct}%
          </span>
        </div>
      </div>

      <div style={s.actions}>
        {c.status === "accepted" ? (
          <Button
            kind="primary"
            size="sm"
            icon="Check"
            full
            aria-pressed
            title={t("card.undoAccepted")}
            onClick={() => onSetStatus("pending")}
          >
            {t("card.accepted")}
          </Button>
        ) : (
          <Button kind="secondary" size="sm" icon="Plus" full onClick={() => onSetStatus("accepted")}>
            {t("card.accept")}
          </Button>
        )}
        {c.status === "rejected" ? (
          <Button
            kind="ghost"
            size="sm"
            icon="X"
            full
            aria-pressed
            title={t("card.undoRejected")}
            onClick={() => onSetStatus("pending")}
          >
            {t("card.rejected")}
          </Button>
        ) : (
          <Button kind="ghost" size="sm" icon="X" full onClick={() => onSetStatus("rejected")}>
            {t("card.reject")}
          </Button>
        )}
      </div>
    </article>
  );
}
