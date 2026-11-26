/* ImportSkillModal — import a skill from a .md file or a skill archive
   (server/specs/002-skills.md "Import"): pick a file → the server extracts
   SKILL.md and lists what it ignores → the user reads and edits the draft →
   only "Import skill" stores it (untrusted, disabled). Cancel stores nothing. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon, Markdown, Modal } from "@devdigest/ui";
import type { SkillImportPreview } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import { useImportSkill, useImportSkillPreview } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { IMPORT_ACCEPT, IMPORT_MAX_FILE_BYTES } from "../../constants";
import { SkillForm, EMPTY_SKILL, validateSkill, type SkillFormValues } from "../SkillForm";
import { importFailureOf, readFileAsBase64 } from "./helpers";
import { s } from "./styles";

export function ImportSkillModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const previewImport = useImportSkillPreview();
  const importSkill = useImportSkill();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [preview, setPreview] = React.useState<SkillImportPreview | null>(null);
  const [pickError, setPickError] = React.useState<{ text: string; detail?: string } | null>(null);
  const [reading, setReading] = React.useState(false);
  const [values, setValues] = React.useState<SkillFormValues>(EMPTY_SKILL);
  const [submitted, setSubmitted] = React.useState(false);
  const [nameTaken, setNameTaken] = React.useState(false);
  const [saveFailed, setSaveFailed] = React.useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setPickError(null);
    if (file.size > IMPORT_MAX_FILE_BYTES) {
      setPickError({ text: t("import.errors.too_large") });
      return;
    }
    setReading(true);
    let content: string;
    try {
      content = await readFileAsBase64(file);
    } catch {
      setReading(false);
      setPickError({ text: t("import.readFailed") });
      return;
    }
    previewImport.mutate(
      { filename: file.name, content_base64: content },
      {
        onSuccess: (p) => {
          setPreview(p);
          setValues({ ...p.draft, enabled: false });
          setNameTaken(p.name_taken);
          setSubmitted(false);
          setSaveFailed(false);
        },
        onError: (err) => {
          const reason = importFailureOf(err);
          setPickError(
            reason
              ? { text: t(`import.errors.${reason}`), detail: (err as Error).message }
              : { text: (err as Error).message },
          );
        },
        onSettled: () => setReading(false),
      },
    );
  };

  const onChange = (patch: Partial<SkillFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    if (patch.name !== undefined) setNameTaken(false);
    setSaveFailed(false);
  };

  const save = () => {
    setSubmitted(true);
    if (Object.keys(validateSkill(values)).length > 0) return;
    importSkill.mutate(
      { name: values.name, description: values.description.trim(), type: values.type, body: values.body },
      {
        onSuccess: (skill) => {
          toast.success(t("import.saved", { name: skill.name }));
          onClose();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) setNameTaken(true);
          else setSaveFailed(true);
        },
      },
    );
  };

  const back = () => {
    setPreview(null);
    setPickError(null);
  };

  const footer = preview ? (
    <div style={s.footer}>
      {saveFailed && (
        <span role="alert" style={s.failed}>
          {t("import.saveFailed")}
        </span>
      )}
      <Button kind="ghost" icon="ChevronLeft" onClick={back}>
        {t("import.back")}
      </Button>
      <Button kind="ghost" onClick={onClose}>
        {t("import.cancel")}
      </Button>
      <Button kind="primary" icon="Upload" loading={importSkill.isPending} disabled={importSkill.isPending} onClick={save}>
        {importSkill.isPending ? t("import.saving") : t("import.save")}
      </Button>
    </div>
  ) : (
    <div style={s.footer}>
      <Button kind="ghost" onClick={onClose}>
        {t("import.cancel")}
      </Button>
    </div>
  );

  return (
    <Modal width={780} title={t("import.title")} subtitle={t("import.subtitle")} onClose={onClose} footer={footer}>
      <div style={s.body}>
        {!preview ? (
          <div
            style={s.dropzone}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFile(e.dataTransfer.files[0]);
            }}
          >
            <Icon.Upload size={22} style={s.dropIcon} />
            <div style={s.pickTitle}>{t("import.pickTitle")}</div>
            <p style={s.pickHint}>{t("import.pickHint")}</p>
            <div style={s.pickRow}>
              <Button
                kind="secondary"
                icon="FileText"
                loading={reading}
                disabled={reading}
                onClick={() => inputRef.current?.click()}
              >
                {reading ? t("import.reading") : t("import.choose")}
              </Button>
              <span style={s.dropHere}>{t("import.dropHere")}</span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={IMPORT_ACCEPT}
              aria-label={t("import.fileLabel")}
              style={s.hiddenInput}
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = ""; // the same file can be picked again
              }}
            />
            {pickError && (
              <div role="alert" style={s.pickError}>
                {pickError.text}
                {pickError.detail && pickError.detail !== pickError.text && (
                  <div style={s.pickErrorDetail}>{pickError.detail}</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={s.origin}>
              <Icon.FileText size={14} />
              <span>{t("import.from")}</span>
              <span className="mono">{preview.origin.filename}</span>
              {preview.origin.kind === "archive" && (
                <>
                  <Icon.ChevronRight size={13} />
                  <span className="mono">{preview.origin.skill_path}</span>
                </>
              )}
            </div>

            <div role="note" style={s.untrusted}>
              <Icon.Shield size={14} style={s.untrustedIcon} />
              <span>{t("import.untrustedNotice")}</span>
            </div>

            {preview.warnings.length > 0 && (
              <div style={s.section}>
                <div style={s.label}>{t("import.warnings")}</div>
                <ul style={s.warnings}>
                  {preview.warnings.map((w) => (
                    <li key={w} style={s.warning}>
                      <Icon.AlertTriangle size={13} style={s.warningIcon} />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.ignored.length > 0 && (
              <div style={s.section}>
                <div style={s.label}>{t("import.ignored", { count: preview.ignored.length })}</div>
                <ul style={s.ignored} aria-label={t("import.ignored", { count: preview.ignored.length })}>
                  {preview.ignored.map((f) => (
                    <li key={f.path} style={s.ignoredRow}>
                      <span className="mono" style={s.ignoredPath}>
                        {f.path}
                      </span>
                      <Badge
                        color={f.reason === "script" ? "var(--warn)" : "var(--text-muted)"}
                        bg={f.reason === "script" ? "var(--warn-bg)" : undefined}
                      >
                        {t(`import.reason.${f.reason}`)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={s.section}>
              <div style={s.label}>{t("import.preview")}</div>
              <div style={s.rendered}>
                <Markdown>{values.body}</Markdown>
              </div>
            </div>

            <SkillForm values={values} onChange={onChange} showRequired={submitted} nameTaken={nameTaken} hideEnabled />
          </>
        )}
      </div>
    </Modal>
  );
}
