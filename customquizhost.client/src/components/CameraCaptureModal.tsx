import { useEffect, useRef, useState, useCallback } from "react";
import "./CameraCaptureModal.css";

export interface CapturedImage {
  blob: Blob;
  fileName: string;
}

interface CameraCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onCaptured: (image: CapturedImage) => void;
}

type FacingMode = "user" | "environment";

/**
 * Crops an image source to a centered square and returns it as a JPEG Blob.
 * The square is sized to the smaller dimension so the image is never
 * stretched/distorted — it is only cropped (the avatar component then renders
 * it inside a circle).
 */
async function cropToSquareBlob(
  source: HTMLVideoElement | HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  mirror: boolean,
): Promise<Blob> {
  const size = Math.min(sourceWidth, sourceHeight);
  const sx = (sourceWidth - size) / 2;
  const sy = (sourceHeight - size) / 2;

  // Cap the output resolution to keep uploads small while staying sharp.
  const outputSize = Math.min(size, 720);

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }

  if (mirror) {
    ctx.translate(outputSize, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(source, sx, sy, size, size, 0, 0, outputSize, outputSize);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode image"));
      },
      "image/jpeg",
      0.9,
    );
  });
}

function CameraCaptureModal({ visible, onClose, onCaptured }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Detect available camera count once we have permission so we know whether
  // to show the "switch camera" button.
  useEffect(() => {
    if (!visible) return;
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const cams = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(cams.length > 1);
      })
      .catch(() => {
        // ignore — leave the toggle hidden
      });
  }, [visible]);

  // Start (or restart) the camera stream when the modal becomes visible or
  // when the user toggles between front/back camera.
  useEffect(() => {
    if (!visible) {
      stopStream();
      return;
    }

    let cancelled = false;
    stopStream();

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };

    const start = async () => {
      setError(null);
      setStarting(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            // play() can reject when interrupted by another load — that's fine
          }
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Could not access the camera.";
        setError(message);
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
    };
  }, [visible, facingMode, stopStream]);

  // Make sure the camera is released when the component unmounts.
  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    try {
      const mirror = facingMode === "user";
      const blob = await cropToSquareBlob(
        video,
        video.videoWidth,
        video.videoHeight,
        mirror,
      );
      onCaptured({ blob, fileName: `avatar-${Date.now()}.jpg` });
    } catch (err) {
      console.error("Capture failed:", err);
      setError("Could not capture image.");
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // reset so selecting the same file again still triggers onChange
    event.target.value = "";
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.decoding = "async";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not load image"));
        img.src = url;
      });
      const blob = await cropToSquareBlob(
        img,
        img.naturalWidth,
        img.naturalHeight,
        false,
      );
      URL.revokeObjectURL(url);
      const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
      onCaptured({ blob, fileName: `${baseName}-${Date.now()}.jpg` });
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Could not load that image.");
    }
  };

  if (!visible) return null;

  return (
    <div
      className="camera-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Take avatar picture"
    >
      <div className="camera-modal">
        <div className="camera-modal-header">
          <h2>Take a picture</h2>
          <button
            type="button"
            className="camera-close-btn"
            aria-label="Close camera"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="camera-stage">
          <video
            ref={videoRef}
            className={`camera-video ${facingMode === "user" ? "mirrored" : ""}`}
            playsInline
            muted
          />
          <div className="camera-crop-overlay" aria-hidden="true">
            <div className="camera-crop-circle" />
            <div className="camera-crop-hint">This area will become your avatar</div>
          </div>

          {starting && !error && (
            <div className="camera-status">Starting camera…</div>
          )}
          {error && (
            <div className="camera-status camera-status-error">
              <p>{error}</p>
              <p className="camera-status-hint">
                You can still upload a custom image.
              </p>
            </div>
          )}
        </div>

        <div className="camera-controls">
          {hasMultipleCameras && (
            <button
              type="button"
              className="camera-control-btn camera-switch-btn"
              onClick={handleSwitchCamera}
              aria-label="Switch camera"
              title="Switch camera"
              disabled={starting}
            >
              ⇄
            </button>
          )}

          <button
            type="button"
            className="camera-shutter-btn"
            onClick={handleCapture}
            aria-label="Take picture"
            disabled={!!error || starting}
          >
            <span className="camera-shutter-inner" />
          </button>

          <button
            type="button"
            className="camera-control-btn camera-upload-btn"
            onClick={handleUploadClick}
            aria-label="Upload custom image"
            title="Upload custom image"
          >
            ⬆
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelected}
            style={{ display: "none" }}
          />
        </div>
      </div>
    </div>
  );
}

export default CameraCaptureModal;
