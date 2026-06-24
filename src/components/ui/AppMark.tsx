export function AppMark({
  className = "",
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="16" cy="16" r="16" fill="#1e3a5f" />
      <circle
        cx="16"
        cy="16"
        r="13.25"
        fill="none"
        stroke="#d4a853"
        strokeWidth="0.65"
        opacity="0.9"
      />
      <circle
        cx="16"
        cy="16"
        r="11.5"
        fill="none"
        stroke="#d4a853"
        strokeWidth="0.35"
        opacity="0.45"
      />
      <text
        x="16"
        y="21.5"
        textAnchor="middle"
        fill="#e8cc7a"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="15"
        fontWeight="400"
        letterSpacing="-0.5"
      >
        &amp;
      </text>
    </svg>
  );
}
