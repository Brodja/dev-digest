/* ConventionsView — the Conventions page (server/specs/003-conventions.md,
   redesigned in client/specs/004 after screen_conv_conf.jsx): "Conventions in
   <repo>" with Re-scan, one list of candidate cards in server order, Select all /
   Deselect all with "N of M accepted", and "Accept as Skill" for the accepted
   set (P3: change the accepted set, build another skill). Empty state until the
   first scan; a clear banner when a scan failed. */
"use client";

import React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { ConventionCandidate, ConventionScan, ConventionStatus } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { ApiError } from "@/lib/api";
import {
  useConventions,
  useExtractConventions,
  useSetConventionStatuses,
  useUpdateConvention,
} from "@/lib/hooks/conventions";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { useToast } from "@/lib/toast";
import { ConventionCard } from "../ConventionCard";
import { CreateConventionSkillModal } from "../CreateConventionSkillModal";
import { bulkAction, isKnownScanError } from "./helpers";
import { s } from "./styles";

export function ConventionsView({ repoId }: { repoId: string }) {
  const t = useTranslations("conventions");
  const format = useFormatter();
  const toast = useToast();
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const { data, isLoading, isError, refetch } = useConventions(repoId, { enabled: !repoNotFound });
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);
  const bulk = useSetConventionStatuses(repoId);
  const [creating, setCreating] = React.useState(false);

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
  const accepted = candidates.filter((c) => c.status === "accepted");
  const toggleAll = bulkAction(candidates);
  const scanning = extract.isPending;
  const busy = scanning || bulk.isPending;
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
  const applyToggleAll = () => {
    if (!toggleAll) return;
    bulk.mutate(
      { ids: toggleAll.ids, status: toggleAll.status },
      {
        onSuccess: ({ failed, total }) => {
          if (failed > 0) toast.error(t("page.bulkFailed", { failed, total }));
        },
        onError: () => toast.error(t("page.bulkFailed", { failed: toggleAll.ids.length, total: toggleAll.ids.length })),
      },
    );
  };

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
            <Button kind="secondary" size="sm" icon="RefreshCw" loading={scanning} disabled={busy} onClick={run}>
              {scanning ? t("page.scanning") : t("page.rescan")}
            </Button>
          )}
        </div>

        {candidates.length > 0 && (
          <div style={s.toolbar}>
            {toggleAll && (
              <Button
                kind="ghost"
                size="sm"
                icon={toggleAll.kind === "select" ? "Check" : "X"}
                loading={bulk.isPending}
                disabled={busy}
                onClick={applyToggleAll}
              >
                {toggleAll.kind === "select" ? t("page.selectAll") : t("page.deselectAll")}
              </Button>
            )}
            <span style={s.counter}>{t("page.acceptedCount", { count: accepted.length, total: candidates.length })}</span>
            <div style={s.toolbarEnd}>
              <Button
                kind="primary"
                size="sm"
                icon="Sparkles"
                disabled={accepted.length === 0 || busy}
                onClick={() => setCreating(true)}
              >
                {t("card.acceptAsSkill")}
              </Button>
            </div>
          </div>
        )}

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
            <Skeleton height={120} />
            <Skeleton height={120} />
            <Skeleton height={120} />
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

        {scan && scanning && (
          <div role="status" style={s.scanningRow}>
            {t("page.scanningRepo")}
          </div>
        )}

        {scan?.status === "succeeded" && candidates.length === 0 && <p style={s.note}>{t("page.nothingGrounded")}</p>}

        {candidates.length > 0 && (
          <div role="list" aria-label={t("page.listLabel")}>
            {candidates.map((c) => (
              <div role="listitem" key={c.id}>
                <ConventionCard
                  candidate={c}
                  repo={activeRepo}
                  onSetStatus={(next) => setStatus(c, next)}
                  onSaveRule={(rule) => saveRule(c, rule)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <CreateConventionSkillModal
          repoId={repoId}
          repoName={repoName}
          conventions={accepted}
          onClose={() => setCreating(false)}
        />
      )}
    </AppShell>
  );
}
