import "./ExportProgressModal.css";

interface ExportProgressModalProps {
  visible: boolean;
  progress: number;
  message?: string;
}

function ExportProgressModal({ visible, progress, message }: ExportProgressModalProps) {
  if (!visible) return null;

  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="export-progress-overlay">
      <div className="export-progress-modal">
        <h2>Exporting…</h2>
        {message && <p className="export-progress-message">{message}</p>}
        <div className="export-progress-bar-container">
          <div
            className="export-progress-bar-fill"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
        <p className="export-progress-percent">{clampedProgress}%</p>
      </div>
    </div>
  );
}

export default ExportProgressModal;
