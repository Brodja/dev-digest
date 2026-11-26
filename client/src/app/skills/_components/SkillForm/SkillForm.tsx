/* SkillForm — the controlled skill fields: name, description (with the
   "write it as a directive" hint), type, enabled and the markdown body with a
   token estimate. Used by the create/edit modal (and the import preview). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FormField, SelectInput, TextInput, Textarea, Toggle } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { SKILL_TYPES } from "../../constants";
import { estimateTokens, validateSkill, type SkillField, type SkillFormValues } from "./helpers";
import { s } from "./styles";

export function SkillForm({
  values,
  onChange,
  showRequired,
  nameTaken,
}: {
  values: SkillFormValues;
  onChange: (patch: Partial<SkillFormValues>) => void;
  /** Show "is required" errors (after a save attempt). */
  showRequired?: boolean;
  /** The server answered 409 for this name. */
  nameTaken?: boolean;
}) {
  const t = useTranslations("skills");
  const issues = validateSkill(values);

  const errorOf = (field: SkillField): string | null => {
    if (field === "name" && nameTaken) return t("editor.errors.nameTaken");
    const issue = issues[field];
    if (!issue || (issue.required && !showRequired)) return null;
    return t(`editor.errors.${issue.key}`, issue.values);
  };

  const fieldError = (field: SkillField) => {
    const msg = errorOf(field);
    return msg ? (
      <div role="alert" style={s.error}>
        {msg}
      </div>
    ) : null;
  };

  return (
    <div>
      <FormField label={t("editor.name")} required hint={t("editor.nameHint")}>
        <TextInput
          mono
          value={values.name}
          onChange={(name) => onChange({ name })}
          placeholder={t("editor.namePlaceholder")}
          aria-label={t("editor.name")}
          aria-invalid={!!errorOf("name")}
          autoFocus
        />
        {fieldError("name")}
      </FormField>

      <FormField label={t("editor.description")} required hint={t("editor.descriptionHint")}>
        <TextInput
          value={values.description}
          onChange={(description) => onChange({ description })}
          placeholder={t("editor.descriptionPlaceholder")}
          aria-label={t("editor.description")}
          aria-invalid={!!errorOf("description")}
        />
        {fieldError("description")}
      </FormField>

      <div style={s.row}>
        <div style={s.typeCol}>
          <FormField label={t("editor.type")}>
            <SelectInput
              value={values.type}
              onChange={(type) => onChange({ type: type as SkillType })}
              options={[...SKILL_TYPES]}
            />
          </FormField>
        </div>
        <div style={s.enabledCol}>
          <FormField label={t("editor.enabled")} hint={t("editor.enabledHint")}>
            <Toggle on={values.enabled} onChange={(enabled) => onChange({ enabled })} label={t("editor.enabled")} />
          </FormField>
        </div>
      </div>

      <FormField
        label={t("editor.body")}
        required
        hint={t("editor.bodyHint")}
        right={
          <span className="mono" style={s.tokens}>
            {(values.name || "skill") + ".md"} · {t("editor.tokens", { count: estimateTokens(values.body) })}
          </span>
        }
      >
        <Textarea
          mono
          rows={14}
          value={values.body}
          onChange={(body) => onChange({ body })}
          placeholder={t("editor.bodyPlaceholder")}
          aria-label={t("editor.body")}
          aria-invalid={!!errorOf("body")}
        />
        {fieldError("body")}
      </FormField>
    </div>
  );
}
