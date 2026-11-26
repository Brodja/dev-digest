/* SkillPreviewDrawer — side preview of one skill: metadata, the directive
   description, the body rendered as markdown (the design-system Markdown is safe
   for untrusted text), the agents that link it, Edit and Delete. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, Button, Drawer, ErrorState, Icon, Markdown, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge } from "@/components/SkillTypeBadge";
import { useDeleteSkill, useSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SOURCE_ICONS } from "../../constants";
import { s } from "./styles";

export function SkillPreviewDrawer({
  skillId,
  onClose,
  onEdit,
}: {
  skillId: string;
  onClose: () => void;
  onEdit: (skill: Skill) => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data: skill, isLoading, isError, refetch } = useSkill(skillId);
  const del = useDeleteSkill();

  const remove = () => {
    if (!skill || !window.confirm(t("preview.deleteConfirm", { name: skill.name }))) return;
    del.mutate(skill.id, {
      onSuccess: () => {
        toast.success(t("preview.deleted", { name: skill.name }));
        onClose();
      },
    });
  };

  const SourceIcon = skill ? Icon[SOURCE_ICONS[skill.source]] : null;

  return (
    <Drawer
      width={560}
      title={<span className="mono">{skill?.name ?? "…"}</span>}
      onClose={onClose}
      footer={
        skill && (
          <div style={s.footer}>
            <Button kind="danger" icon="Trash" loading={del.isPending} disabled={del.isPending} onClick={remove}>
              {t("preview.delete")}
            </Button>
            <Button kind="primary" icon="Edit" onClick={() => onEdit(skill)}>
              {t("preview.edit")}
            </Button>
          </div>
        )
      }
    >
      {isLoading && (
        <div style={s.loading}>
          <Skeleton height={20} width={240} />
          <Skeleton height={160} />
        </div>
      )}
      {isError && <ErrorState body={t("preview.loadError")} onRetry={() => refetch()} />}
      {skill && (
        <>
          <div style={s.metaRow}>
            <SkillTypeBadge type={skill.type} />
            <span style={s.source}>
              {SourceIcon && <SourceIcon size={12} />}
              {t(`source.${skill.source}`)}
            </span>
            <Badge color="var(--text-secondary)" icon="GitCommit" mono>
              {t("preview.version", { version: skill.version })}
            </Badge>
            {skill.enabled ? (
              <Badge color="var(--ok)" bg="var(--ok-bg)" dot>
                {t("preview.enabled")}
              </Badge>
            ) : (
              <Badge color="var(--text-muted)">{t("preview.disabled")}</Badge>
            )}
          </div>

          {!skill.trusted && (
            <div role="note" style={s.untrusted}>
              <Icon.Shield size={14} style={s.untrustedIcon} />
              <span>{t("preview.untrustedNotice")}</span>
            </div>
          )}

          <div style={s.section}>
            <div style={s.label}>{t("preview.description")}</div>
            <p style={s.description}>{skill.description}</p>
          </div>

          <div style={s.section}>
            <div style={s.label}>{t("preview.body")}</div>
            <div style={s.body}>
              <Markdown>{skill.body}</Markdown>
            </div>
          </div>

          <div style={s.section}>
            <div style={s.label}>{t("preview.usedBy")}</div>
            {skill.used_by.length === 0 ? (
              <span style={s.none}>{t("preview.usedByNone")}</span>
            ) : (
              <ul style={s.agents}>
                {skill.used_by.map((a) => (
                  <li key={a.id}>
                    <Link href={`/agents/${a.id}?tab=skills`} style={s.agentLink}>
                      <Icon.Cpu size={13} />
                      {a.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
