/* CreateConventionSkillModal — "Accept as Skill": the draft built from the
   accepted conventions, editable (name, description, markdown body) before it
   is saved as a skill with type convention and source extracted. Nothing is
   stored before "Create skill". */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Modal } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { SkillForm, validateSkill, type SkillFormValues } from "@/components/SkillForm";
import { ApiError } from "@/lib/api";
import { useCreateConventionSkill } from "@/lib/hooks/conventions";
import { useSkills } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { composeSkillDraft, DEFAULT_SKILL_NAME, freeSkillName } from "./helpers";
import { s } from "./styles";

export function CreateConventionSkillModal({
  repoId,
  repoName,
  conventions,
  onClose,
}: {
  repoId: string;
  repoName: string;
  /** The accepted (selected) conventions that go into the skill — read once, when the modal opens. */
  conventions: readonly ConventionCandidate[];
  onClose: () => void;
}) {
  const t = useTranslations("conventions");
  const toast = useToast();
  const create = useCreateConventionSkill(repoId);
  const { data: skills } = useSkills();
  // Frozen when the modal opens, together with the draft built from them: a refetch
  // while it is open must not make the saved ids and the body text disagree.
  const [conventionIds] = React.useState<readonly string[]>(() => conventions.map((c) => c.id));
  const [values, setValues] = React.useState<SkillFormValues>(() =>
    composeSkillDraft(repoName, conventions, (skills ?? []).map((sk) => sk.name)),
  );
  const nameEdited = React.useRef(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [nameTaken, setNameTaken] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);

  // The skills list may arrive after the modal opened: keep the default name free.
  React.useEffect(() => {
    if (!skills || nameEdited.current) return;
    const free = freeSkillName(DEFAULT_SKILL_NAME, skills.map((sk) => sk.name));
    setValues((v) => (v.name === free ? v : { ...v, name: free, body: v.body.replace(`# ${v.name}`, `# ${free}`) }));
  }, [skills]);

  const onChange = (patch: Partial<SkillFormValues>) => {
    if (patch.name !== undefined) {
      nameEdited.current = true;
      setNameTaken(false);
    }
    setValues((v) => ({ ...v, ...patch }));
    setFailed(null);
  };

  const save = () => {
    setSubmitted(true);
    if (Object.keys(validateSkill(values)).length > 0) return;
    create.mutate(
      {
        name: values.name,
        description: values.description.trim(),
        body: values.body,
        convention_ids: [...conventionIds],
      },
      {
        onSuccess: (skill) => {
          toast.success(t("modal.created", { name: skill.name }));
          onClose();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) setNameTaken(true);
          else if (err instanceof ApiError && err.code === "conventions_not_accepted") setFailed(t("modal.notAccepted"));
          else setFailed(t("modal.failed"));
        },
      },
    );
  };

  return (
    <Modal
      width={760}
      title={t("modal.title")}
      subtitle={<span className="mono">{values.name}</span>}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          {failed && (
            <span role="alert" style={s.failed}>
              {failed}
            </span>
          )}
          <Button kind="ghost" onClick={onClose}>
            {t("modal.cancel")}
          </Button>
          <Button kind="primary" icon="Sparkles" loading={create.isPending} disabled={create.isPending} onClick={save}>
            {create.isPending ? t("modal.creating") : t("modal.create")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <div style={s.merged}>
          <Icon.Wrench size={15} style={s.mergedIcon} />
          <span>{t("modal.merged", { count: conventionIds.length, repo: repoName })}</span>
        </div>
        <SkillForm
          values={values}
          onChange={onChange}
          showRequired={submitted}
          nameTaken={nameTaken}
          hideEnabled
          lockedType="convention"
        />
      </div>
    </Modal>
  );
}
