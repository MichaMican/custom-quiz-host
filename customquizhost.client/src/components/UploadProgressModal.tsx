import "./UploadProgressModal.css";

interface UploadProgressModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Progress value from 0 to 100 */
  progress: number;
  /** Label shown above the progress bar (e.g. "Uploading file..." or "Importing game...") */
  label?: string;
}

function UploadProgressModal({
  visible,
  progress,
  label = "Uploading…",
}: UploadProgressModalProps) {
  if (!visible) return null;

  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="upload-progress-overlay">
      <div className="upload-progress-modal">
        <h2>{label}</h2>
        <div className="upload-progress-bar-track">
          <div
            className="upload-progress-bar-fill"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
        <span className="upload-progress-text">{clampedProgress}%</span>
      </div>
    </div>
  );
}

export default UploadProgressModal;
