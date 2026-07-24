import { zip, unzip, strToU8, strFromU8 } from "fflate";
import type { AsyncZippable, Unzipped } from "fflate";

/**
 * Fast quiz archive helpers built on fflate.
 *
 * Archives are standard ZIP files, but entries are written with STORE
 * (no compression) because quiz media (images/audio/video) is already
 * compressed. Skipping DEFLATE makes export and import dramatically
 * faster while staying fully backwards compatible: reading still
 * supports older, DEFLATE-compressed exports.
 */

export interface QuizArchive {
  /** Raw entries keyed by their path inside the archive. */
  files: Unzipped;
}

const MEDIA_PREFIX = "media/";

/** Read a ZIP file into memory. Supports both STORE and DEFLATE entries. */
export const readQuizArchive = async (file: Blob): Promise<QuizArchive> => {
  const data = new Uint8Array(await file.arrayBuffer());
  const files = await new Promise<Unzipped>((resolve, reject) => {
    unzip(data, (err, unzipped) => {
      if (err) reject(err);
      else resolve(unzipped);
    });
  });
  return { files };
};

/** Get the text content of an entry, or null if it does not exist. */
export const getArchiveText = (archive: QuizArchive, name: string): string | null => {
  const entry = archive.files[name];
  if (!entry) return null;
  return strFromU8(entry);
};

/** List the media entries (files under media/) of an archive. */
export const listArchiveMedia = (
  archive: QuizArchive,
): { name: string; data: Uint8Array }[] => {
  const entries: { name: string; data: Uint8Array }[] = [];
  for (const [path, data] of Object.entries(archive.files)) {
    if (path.startsWith(MEDIA_PREFIX) && path.length > MEDIA_PREFIX.length) {
      const name = path.slice(MEDIA_PREFIX.length);
      if (!name.includes("/") && data.length > 0) {
        entries.push({ name, data });
      }
    }
  }
  return entries;
};

/**
 * Build a quiz archive Blob from a JSON payload and media blobs.
 * All entries are stored uncompressed for speed.
 */
export const buildQuizArchive = async (
  jsonFileName: string,
  jsonData: object,
  media: Map<string, Blob>,
): Promise<Blob> => {
  const zippable: AsyncZippable = {
    [jsonFileName]: [strToU8(JSON.stringify(jsonData, null, 2)), { level: 0 }],
  };
  for (const [name, blob] of media) {
    zippable[`${MEDIA_PREFIX}${name}`] = [
      new Uint8Array(await blob.arrayBuffer()),
      { level: 0 },
    ];
  }
  const data = await new Promise<Uint8Array>((resolve, reject) => {
    zip(zippable, { level: 0 }, (err, zipped) => {
      if (err) reject(err);
      else resolve(zipped);
    });
  });
  return new Blob([data as BlobPart], { type: "application/zip" });
};
