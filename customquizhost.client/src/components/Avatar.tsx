import "./Avatar.css";

interface AvatarProps {
  fileName: string | null | undefined;
  alt?: string;
  className?: string;
  /** When true, the image is rendered desaturated (greyscale). */
  grayscale?: boolean;
}

/**
 * Circular avatar that "zooms to fit" (object-fit: cover) so the image is
 * cropped — never stretched/distorted. Falls back to a generic person SVG
 * placeholder when no file name is provided.
 */
function Avatar({ fileName, alt = "", className = "", grayscale = false }: AvatarProps) {
  const classes = [
    "avatar",
    grayscale ? "avatar-grayscale" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!fileName) {
    return (
      <div className={`${classes} avatar-placeholder`} role="img" aria-label={alt || "No avatar"}>
        <svg
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="32" cy="24" r="12" fill="currentColor" opacity="0.85" />
          <path
            d="M10 58c0-12 10-20 22-20s22 8 22 20"
            fill="currentColor"
            opacity="0.85"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={classes}>
      <img src={`/uploads/${fileName}`} alt={alt} draggable={false} />
    </div>
  );
}

export default Avatar;
