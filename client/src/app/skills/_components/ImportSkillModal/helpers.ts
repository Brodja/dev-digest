import { ApiError } from "@/lib/api";

/** Reasons the server gives in `error.details.reason` for a refused upload. */
export const IMPORT_FAILURES = [
  "unsupported_file",
  "no_skill_md",
  "multiple_skill_md",
  "too_large",
  "too_many_entries",
  "not_utf8",
] as const;
export type ImportFailure = (typeof IMPORT_FAILURES)[number];

/** The import failure reason of an API error, if it is one. */
export function importFailureOf(err: unknown): ImportFailure | null {
  if (!(err instanceof ApiError) || err.code !== "import_invalid") return null;
  const reason = (err.details as { reason?: unknown } | undefined)?.reason;
  return (IMPORT_FAILURES as readonly unknown[]).includes(reason) ? (reason as ImportFailure) : null;
}

/**
 * A file's bytes as base64 (no "data:…;base64," prefix). FileReader, not
 * Blob.arrayBuffer — jsdom (the test environment) has no arrayBuffer().
 */
export function readFileAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      const comma = url.indexOf(",");
      resolve(comma >= 0 ? url.slice(comma + 1) : "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
