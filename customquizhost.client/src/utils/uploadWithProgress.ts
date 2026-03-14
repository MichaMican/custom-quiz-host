/**
 * Upload a file via XMLHttpRequest with progress reporting.
 *
 * @param url        Target URL (e.g. "/api/upload")
 * @param formData   FormData containing the file
 * @param onProgress Callback receiving a value 0–100
 * @returns          Parsed JSON response body
 */
export function uploadWithProgress<T = unknown>(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error("Failed to parse upload response"));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.open("POST", url);
    xhr.send(formData);
  });
}
