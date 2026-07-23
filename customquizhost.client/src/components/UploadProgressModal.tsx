import "./UploadProgressModal.css";

interface UploadProgressModalProps {
  visible: boolean;
  progress: number;
  message?: string;
  onCancel?: () => void;
}

function UploadProgressModal({ visible, progress, message, onCancel }: UploadProgressModalProps) {
  if (!visible) return null;

  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="upload-progress-overlay">
      <div className="upload-progress-modal">
        <h2>Uploading…</h2>
        {message && <p className="upload-progress-message">{message}</p>}
        <div className="upload-progress-bar-container">
          <div
            className="upload-progress-bar-fill"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
        <p className="upload-progress-percent">{clampedProgress}%</p>
        {onCancel && (
          <div className="upload-progress-actions">
            <button
              type="button"
              className="upload-progress-cancel"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadProgressModal;
