import exifr from "exifr";

export type PhotoSource = "camera" | "gallery" | "unknown";

export type PhotoMeta = {
  takenAt: string | null; // ISO string
  source: PhotoSource;
};

/**
 * Reads EXIF metadata from an image File.
 * `hintSource` marks whether the user picked the file via the camera flow
 * or via a gallery/file picker. We can't fully trust the browser (many
 * mobiles route camera into gallery), but combined with EXIF timestamps
 * it's enough to flag suspicious cases.
 */
export async function readPhotoMeta(
  file: File,
  hintSource: PhotoSource = "unknown",
): Promise<PhotoMeta> {
  let takenAt: string | null = null;
  try {
    const parsed: any = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate", "DateTime"],
    });
    const raw =
      parsed?.DateTimeOriginal ??
      parsed?.CreateDate ??
      parsed?.DateTime ??
      null;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      takenAt = raw.toISOString();
    } else if (typeof raw === "string" && raw.length > 0) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) takenAt = d.toISOString();
    }
  } catch {
    takenAt = null;
  }

  // If no EXIF at all and user picked from gallery, still "gallery".
  // Camera-captured pics on iOS/Android almost always have EXIF.
  return { takenAt, source: hintSource };
}
