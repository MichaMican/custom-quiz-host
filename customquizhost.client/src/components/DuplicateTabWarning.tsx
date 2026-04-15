import "./DuplicateTabWarning.css";

interface DuplicateTabWarningProps {
  visible: boolean;
  onDismiss: () => void;
}

function DuplicateTabWarning({ visible, onDismiss }: DuplicateTabWarningProps) {
  if (!visible) return null;

  return (
    <div className="duplicate-tab-overlay">
      <div className="duplicate-tab-modal">
        <div className="duplicate-tab-header">
          <span className="duplicate-tab-icon">⚠️</span>
          <h2>Multiple Display Tabs Detected</h2>
        </div>
        <p className="duplicate-tab-message">
          The display page is open in another tab on this device. If both tabs
          are unmuted, audio may sound echoed or distorted. Consider muting or
          closing one of the tabs.
        </p>
        <button
          className="duplicate-tab-close-btn"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default DuplicateTabWarning;
