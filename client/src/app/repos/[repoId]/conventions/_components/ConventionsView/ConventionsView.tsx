/* ConventionsView — the Conventions page (server/specs/003-conventions.md):
   empty state until the first scan, Run extraction / Re-scan, the candidates
   grouped by status, a clear banner when the last scan failed, and
   "Accept as Skill" for the accepted ones. */
"use client";

import React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { ConventionCandidate, ConventionScan, ConventionStatus } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { ApiError } from "@/lib/api";
import { useConventions, useExtractConventions, useUpdateConvention } from "@/lib/hooks/conventions";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { ConventionCard } from "../ConventionCard";
import { CreateConventionSkillModal } from "../CreateConventionSkillModal";
import { groupByStatus, isKnownScanError } from "./helpers";
import { s } from "./styles";

const SECTIONS: ConventionStatus[] = ["pending", "accepted", "rejected"];

export function ConventionsView({ repoId }: { repoId: string }) {
  const t = useTranslations("conventions");
  const format = useFormatter();
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const { data, isLoading, isError, refetch } = useConventions(repoId, { enabled: !repoNotFound });
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);
  const [creating, setCreating] = React.useState(false);
  // Accepted conventions left OUT of the next skill. Empty = all accepted go in, so
  // not touching the checkboxes keeps the main flow: everything → repo-conventions.
  const [excluded, setExcluded] = React.useState<ReadonlySet<string>>(() => new Set());
  const include = (id: string, checked: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(id);
      else next.add(id);
      return next;
    });

  const repoName = activeRepo?.full_name ?? t("page.repoFallback");
  const crumb = [{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }];

  if (repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  const scan = data?.scan ?? null;
  const candidates = data?.candidates ?? [];
  const groups = groupByStatus(candidates);
  const accepted = groups.accepted;
  const selected = accepted.filter((c) => !excluded.has(c.id));
  const scanning = extract.isPending;
  const run = () => extract.mutate();

  // The failure to explain: this session's request first, else the stored last scan.
  // Known codes get the page's wording; any other (llm_failed, config_error, …) the server's message.
  const errorText = (code: string | null | undefined, message: string | null | undefined): string =>
    isKnownScanError(code) ? t(`page.errors.${code}`) : (message ?? "");
  const failure = extract.isError
    ? errorText(extract.error instanceof ApiError ? extract.error.code : undefined, extract.error?.message)
    : scan?.status === "failed"
      ? errorText(scan.error_code, scan.error_message)
      : null;

  const setStatus = (c: ConventionCandidate, status: ConventionStatus) => update.mutate({ id: c.id, patch: { status } });
  const saveRule = (c: ConventionCandidate, rule: string) => update.mutateAsync({ id: c.id, patch: { rule } });

  /** "N candidates · grounded … · M sampled files · last scan 5 min ago · K proposals dropped without evidence". */
  const summary = (last: ConventionScan | null, count: number): string => {
    if (!last || last.status === "failed") return t("page.subtitle");
    const parts = [
      t("page.candidateCount", { count }),
      t("page.scanSummary", {
        files: last.files.length,
        when: format.relativeTime(new Date(last.finished_at), new Date()),
      }),
    ];
    if (last.dropped_ungrounded > 0) parts.push(t("page.droppedSummary", { count: last.dropped_ungrounded }));
    return parts.join(" · ");
  };

  return (
    <AppShell crumb={crumb}>
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>
              {t("page.headingPrefix")}
              <span className="mono" style={s.repo}>
                {repoName}
              </span>
            </h1>
            <p style={s.subtitle}>{summary(scan, candidates.length)}</p>
          </div>
          {scan && (
            <div style={s.actions}>
              {accepted.length > 0 && (
                <span style={s.selected}>
                  {t("page.selected", { selected: selected.length, accepted: accepted.length })}
                </span>
              )}
              <Button kind="secondary" size="sm" icon="RefreshCw" loading={scanning} disabled={scanning} onClick={run}>
                {scanning ? t("page.scanning") : t("page.rescan")}
              </Button>
              <Button
                kind="primary"
                size="sm"
                icon="Sparkles"
                disabled={selected.length === 0 || scanning}
                onClick={() => setCreating(true)}
              >
                {t("card.acceptAsSkill")}
              </Button>
            </div>
          )}
        </div>

        {failure && (
          <div role="alert" style={s.banner}>
            <Icon.AlertTriangle size={15} style={s.bannerIcon} />
            <div>
              <div style={s.bannerTitle}>{t("page.extractionFailed")}</div>
              <div>{failure}</div>
            </div>
          </div>
        )}

        {isLoading && (
          <div style={s.skeletons}>
            <Skeleton height={140} />
            <Skeleton height={140} />
          </div>
        )}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}

        {data && !scan && (
          <EmptyState
            icon="ListChecks"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={scanning ? t("page.scanning") : t("page.empty.cta")}
            onCta={run}
            ctaLoading={scanning}
          />
        )}

        {scan?.status === "succeeded" && candidates.length === 0 && <p style={s.note}>{t("page.nothingGrounded")}</p>}

        {SECTIONS.map((status) =>
          groups[status].length > 0 ? (
            <section key={status} aria-label={t(`page.sections.${status}`)} style={s.section}>
              <h2 style={s.sectionTitle}>
                {t(`page.sections.${status}`)} · {groups[status].length}
              </h2>
              {groups[status].map((c) => (
                <ConventionCard
                  key={c.id}
                  candidate={c}
                  repo={activeRepo}
                  onSetStatus={(next) => setStatus(c, next)}
                  onSaveRule={(rule) => saveRule(c, rule)}
                  selection={
                    c.status === "accepted"
                      ? { checked: !excluded.has(c.id), onChange: (checked) => include(c.id, checked) }
                      : undefined
                  }
                />
              ))}
            </section>
          ) : null,
        )}
      </div>

      {creating && (
        <CreateConventionSkillModal
          repoId={repoId}
          repoName={repoName}
          conventions={selected}
          onClose={() => setCreating(false)}
        />
      )}
    </AppShell>
  );
}
