/* ConfigTab — edit a skill (screen_skills.jsx SkillConfigTab): Configuration
   with the version and the Enabled switch (saves at once), the SkillForm with
   the body in a code editor, Save skill / Cancel, and the delete zone. Saving
   sends only the changed fields; a changed body becomes the next version. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import { useDeleteSkill, useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SkillForm, validateSkill, type SkillFormValues } from "@/components/SkillForm";
import { changedFields, formValues } from "./helpers";
import { s } from "./styles";

export function ConfigTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const update = useUpdateSkill();
  const switcher = useUpdateSkill();
  const del = useDeleteSkill();
  const [values, setValues] = React.useState<SkillFormValues>(() => formValues(skill));
  const [submitted, setSubmitted] = React.useState(false);
  const [nameTaken, setNameTaken] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const patch = changedFields(skill, values);
  const dirty = Object.keys(patch).length > 0;
  const bodyDirty = patch.body !== undefined;

  const onChange = (next: Partial<SkillFormValues>) => {
    setValues((v) => ({ ...v, ...next }));
    if (next.name !== undefined) setNameTaken(false);
    setFailed(false);
  };

  const save = () => {
    setSubmitted(true);
    if (Object.keys(validateSkill(values)).length > 0 || !dirty) return;
    update.mutate(
      { id: skill.id, patch },
      {
        onSuccess: (saved) => {
          toast.success(t("config.saved", { version: saved.version }));
          setSubmitted(false);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) setNameTaken(true);
          else setFailed(true);
        },
      },
    );
  };

  const cancel = () => {
    setValues(formValues(skill));
    setSubmitted(false);
    setNameTaken(false);
    setFailed(false);
  };

  const setEnabled = (enabled: boolean) =>
    switcher.mutate(
      { id: skill.id, patch: { enabled } },
      {
        onError: (err) =>
          toast.error(t("config.enableFailed", { name: skill.name, message: (err as Error).message })),
      },
    );

  const remove = () => {
    if (!window.confirm(t("config.deleteConfirm", { name: skill.name }))) return;
    del.mutate(skill.id, {
      onSuccess: () => {
        toast.success(t("config.deleted", { name: skill.name }));
        router.push("/skills");
      },
      onError: (err) => toast.error(t("config.deleteFailed", { name: skill.name, message: (err as Error).message })),
    });
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("config.title")}</h2>
        <Badge color="var(--text-secondary)" icon="GitCommit" mono>
          {t("skill.version", { version: skill.version })}
        </Badge>
        <span style={s.enabled}>
          {t("config.enabled")}
          <Toggle on={skill.enabled} onChange={setEnabled} size={16} label={t("config.enabled")} />
        </span>
      </div>

      <SkillForm
        values={values}
        onChange={onChange}
        showRequired={submitted}
        nameTaken={nameTaken}
        hideEnabled
        bodyDirty={bodyDirty}
        autoFocusName={false}
      />

      <div style={s.actions}>
        <Button kind="primary" icon="Check" loading={update.isPending} disabled={!dirty || update.isPending} onClick={save}>
          {update.isPending ? t("config.saving") : t("config.save")}
        </Button>
        <Button kind="ghost" disabled={!dirty} onClick={cancel}>
          {t("config.cancel")}
        </Button>
        {failed && (
          <span role="alert" style={s.failed}>
            {t("config.saveFailed")}
          </span>
        )}
        <span style={s.snapshot}>
          {bodyDirty ? t("config.snapshotNext", { version: skill.version + 1 }) : t("config.noNewVersion")}
        </span>
      </div>

      <div style={s.danger}>
        <div style={s.dangerText}>
          <div style={s.dangerTitle}>{t("config.deleteTitle")}</div>
          <div style={s.dangerBody}>{t("config.deleteBody")}</div>
        </div>
        <Button kind="danger" size="sm" icon="Trash" loading={del.isPending} disabled={del.isPending} onClick={remove}>
          {t("config.delete")}
        </Button>
      </div>
    </div>
  );
}
