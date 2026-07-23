import axios from "axios";

interface UploadResult {
  fileName: string;
}

export async function uploadFileWithProgress<TResult = UploadResult>(
  file: File | Blob,
  onProgress: (percent: number) => void,
  fileName?: string,
  preserveFileName = false,
  signal?: AbortSignal,
  endpoint?: string,
): Promise<TResult> {
  const formData = new FormData();
  if (fileName) {
    formData.append("file", file, fileName);
  } else {
    formData.append("file", file);
  }

  const url = endpoint ?? (preserveFileName
    ? "/api/upload?preserveFileName=true"
    : "/api/upload");

  const response = await axios.post<TResult>(url, formData, {
    signal,
    onUploadProgress(progressEvent) {
      if (progressEvent.total) {
        const percent = (progressEvent.loaded / progressEvent.total) * 100;
        onProgress(percent);
      }
    },
  });

  return response.data;
}
