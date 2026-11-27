/* VersionsTab — the skill's body history (screen_skills.jsx SkillVersionsTab):
   one row per version, newest first, with Current, a line Diff against the
   version before it and Restore (the old body becomes the next version). */
"use client";

import React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill, SkillVersion } from "@devdigest/shared";
import { estimateTokens } from "@/components/SkillForm";
import { useRestoreSkillVersion, useSkillVersions } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { foldContext, lineDiff } from "./helpers";
import { s } from "./styles";

export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const format = useFormatter();
  const toast = useToast();
  const { data: versions, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const restore = useRestoreSkillVersion();
  const [openDiff, setOpenDiff] = React.useState<number | null>(null);

  const restoreVersion = (v: SkillVersion) => {
    const next = skill.version + 1;
    if (!window.confirm(t("versions.restoreConfirm", { version: v.version, next }))) return;
    restore.mutate(
      { id: skill.id, version: v.version },
      {
        onSuccess: (saved) => toast.success(t("versions.restored", { version: v.version, next: saved.version })),
        onError: (err) =>
          toast.error(t("versions.restoreFailed", { version: v.version, message: (err as Error).message })),
      },
    );
  };

  if (isLoading) return <Skeleton height={180} />;
  if (isError) return <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />;
  const list = versions ?? [];

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("versions.title")}</h2>
        <Badge color="var(--text-secondary)">{t("versions.count", { count: list.length })}</Badge>
      </div>
      <p style={s.subtitle}>{t("versions.subtitle")}</p>
      {list.length === 0 ? (
        <p style={s.empty}>{t("versions.empty")}</p>
      ) : (
        <ol style={s.list} aria-label={t("versions.title")}>
          {list.map((v, i) => {
            const prev = list[i + 1];
            const current = v.version === skill.version;
            const diffOpen = openDiff === v.version && !!prev;
            const created = new Date(v.created_at);
            return (
              <li key={v.version} style={s.row(current)} data-testid={`version-${v.version}`}>
                <div style={s.rowMain}>
                  <span className="mono" style={s.pill(current)}>
                    {t("skill.version", { version: v.version })}
                  </span>
                  <div style={s.meta}>
                    <div style={s.when} title={created.toISOString()}>
                      {format.relativeTime(created, new Date())}
                    </div>
                    <div className="mono" style={s.tokens}>
                      {t("versions.tokens", { count: estimateTokens(v.body) })}
                    </div>
                  </div>
                  <div style={s.actions}>
                    {prev && (
                      <Button
                        kind="ghost"
                        size="sm"
                        icon="Eye"
                        aria-expanded={diffOpen}
                        onClick={() => setOpenDiff(diffOpen ? null : v.version)}
                      >
                        {diffOpen ? t("versions.hideDiff") : t("versions.diff")}
                      </Button>
                    )}
                    {current ? (
                      <Badge color="var(--ok)" bg="var(--ok-bg)" dot>
                        {t("versions.current")}
                      </Badge>
                    ) : (
                      v.body !== skill.body && (
                        <Button
                          kind="secondary"
                          size="sm"
                          icon="History"
                          disabled={restore.isPending}
                          onClick={() => restoreVersion(v)}
                        >
                          {t("versions.restore")}
                        </Button>
                      )
                    )}
                  </div>
                </div>
                {diffOpen && prev && (
                  <div
                    className="mono"
                    style={s.diff}
                    role="region"
                    aria-label={t("versions.diffLabel", { from: prev.version, to: v.version })}
                  >
                    {foldContext(lineDiff(prev.body, v.body)).map((d, k) =>
                      d.kind === "skip" ? (
                        <div key={k} style={s.skip}>
                          ⋯ {d.count}
                        </div>
                      ) : (
                        <div key={k} style={s.line(d.kind)}>
                          {d.kind === "add" ? "+ " : d.kind === "del" ? "- " : "  "}
                          {d.text || " "}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
