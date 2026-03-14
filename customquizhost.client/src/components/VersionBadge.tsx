import "./VersionBadge.css";

const appVersion = import.meta.env.VITE_APP_VERSION || "dev";

function VersionBadge() {
  return <span className="version-badge">v{appVersion}</span>;
}

export default VersionBadge;
