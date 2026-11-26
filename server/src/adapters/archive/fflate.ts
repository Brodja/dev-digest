/**
 * archive adapter — implements the shared `ArchiveReader` port with fflate
 * (pure JS, no natives). In memory only: the archive is never written to disk.
 *
 * `entries` reads the central directory with a filter that returns false for
 * every file, so nothing is inflated. `read` inflates exactly one entry and
 * only when its declared size fits the budget (zip-bomb guard); the real size
 * is checked again afterwards.
 */
import { unzipSync, type UnzipFileInfo } from 'fflate';
import type { ArchiveEntry, ArchiveReadResult, ArchiveReader } from '@devdigest/shared';

/** Zip paths are "/"-separated; tolerate "\" from Windows tools and a leading "./". */
export function normalizeEntryPath(name: string): string {
  return name.replaceAll('\\', '/').replace(/^(\.\/)+/, '');
}

const isDirectory = (name: string) => name.endsWith('/') || name.endsWith('\\');

export class FflateArchiveReader implements ArchiveReader {
  entries(bytes: Uint8Array): ArchiveEntry[] {
    const out: ArchiveEntry[] = [];
    unzipSync(bytes, {
      filter: (file: UnzipFileInfo) => {
        if (!isDirectory(file.name)) {
          out.push({ path: normalizeEntryPath(file.name), uncompressedSize: file.originalSize });
        }
        return false; // list only — never inflate here
      },
    });
    return out;
  }

  read(bytes: Uint8Array, path: string, maxBytes: number): ArchiveReadResult {
    let found = false;
    let tooLarge = false;
    let key: string | undefined;
    const files = unzipSync(bytes, {
      filter: (file: UnzipFileInfo) => {
        if (isDirectory(file.name) || normalizeEntryPath(file.name) !== path) return false;
        found = true;
        key = file.name;
        if (file.originalSize > maxBytes) {
          tooLarge = true;
          return false; // refuse BEFORE inflating
        }
        return true;
      },
    });
    if (!found) return { ok: false, reason: 'missing' };
    if (tooLarge) return { ok: false, reason: 'too_large' };
    const data = key !== undefined ? files[key] : undefined;
    if (!data) return { ok: false, reason: 'missing' };
    if (data.length > maxBytes) return { ok: false, reason: 'too_large' };
    return { ok: true, bytes: data };
  }
}
