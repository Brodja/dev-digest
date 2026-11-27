/* CreateSkillModal — Add Skill → Create from scratch. Validates on the client
   (same rules as the server) and shows a taken name inline (409). Editing an
   existing skill happens on its page (/skills/:id, Config tab). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import { useCreateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { EMPTY_SKILL, SkillForm, validateSkill, type SkillFormValues } from "@/components/SkillForm";
import { s } from "./styles";

export function CreateSkillModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  /** The new skill (the list opens its page). */
  onCreated?: (skill: Skill) => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const create = useCreateSkill();
  const [values, setValues] = React.useState<SkillFormValues>(EMPTY_SKILL);
  const [submitted, setSubmitted] = React.useState(false);
  const [nameTaken, setNameTaken] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const onChange = (patch: Partial<SkillFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    if (patch.name !== undefined) setNameTaken(false);
    setFailed(false);
  };

  const save = () => {
    setSubmitted(true);
    if (Object.keys(validateSkill(values)).length > 0) return;
    create.mutate(
      { ...values, description: values.description.trim() },
      {
        onSuccess: (created) => {
          toast.success(t("editor.created", { name: created.name }));
          onClose();
          onCreated?.(created);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) setNameTaken(true);
          else setFailed(true);
        },
      },
    );
  };

  return (
    <Modal
      width={760}
      title={t("editor.createTitle")}
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
          <Button kind="primary" icon="Check" loading={create.isPending} disabled={create.isPending} onClick={save}>
            {create.isPending ? t("editor.saving") : t("editor.save")}
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
