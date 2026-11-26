/* SkillEditorModal — create or edit a skill in a modal. Validates on the
   client (same rules as the server), shows a taken name inline (409), and on
   edit sends only the fields that changed. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import { useCreateSkill, useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SkillForm, validateSkill, type SkillFormValues } from "@/components/SkillForm";
import { changedFields, initialValues } from "./helpers";
import { s } from "./styles";

export function SkillEditorModal({ skill, onClose }: { skill?: Skill; onClose: () => void }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const create = useCreateSkill();
  const update = useUpdateSkill();
  const [values, setValues] = React.useState<SkillFormValues>(() => initialValues(skill));
  const [submitted, setSubmitted] = React.useState(false);
  const [nameTaken, setNameTaken] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const pending = create.isPending || update.isPending;

  const onChange = (patch: Partial<SkillFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    if (patch.name !== undefined) setNameTaken(false);
    setFailed(false);
  };

  const onError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 409) setNameTaken(true);
    else setFailed(true);
  };

  const save = () => {
    setSubmitted(true);
    if (Object.keys(validateSkill(values)).length > 0) return;
    if (!skill) {
      create.mutate(
        { ...values, description: values.description.trim() },
        {
          onSuccess: (created) => {
            toast.success(t("editor.created", { name: created.name }));
            onClose();
          },
          onError,
        },
      );
      return;
    }
    const patch = changedFields(skill, values);
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { id: skill.id, patch },
      {
        onSuccess: (saved) => {
          toast.success(t("editor.saved", { version: saved.version }));
          onClose();
        },
        onError,
      },
    );
  };

  return (
    <Modal
      width={760}
      title={skill ? t("editor.editTitle") : t("editor.createTitle")}
      subtitle={skill ? <span className="mono">{skill.name}</span> : undefined}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          {failed && (
            <span role="alert" style={s.failed}>
              {t("editor.saveFailed")}
            </span>
          )}
          <Button kind="ghost" onClick={onClose}>
            {t("editor.cancel")}
          </Button>
          <Button kind="primary" icon="Check" loading={pending} disabled={pending} onClick={save}>
            {pending ? t("editor.saving") : t("editor.save")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <SkillForm values={values} onChange={onChange} showRequired={submitted} nameTaken={nameTaken} />
      </div>
    </Modal>
  );
}
