/**
 * Department mark.
 *
 * An abstract field-and-grain motif, not a reproduction of the Telangana
 * state emblem — official insignia should not be approximated by a vendor
 * system. This reads as institutional without claiming to be the seal.
 */
export function SealMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Department of Agriculture mark"
      fill="none"
    >
      <circle cx="24" cy="24" r="23" stroke="var(--seal)" strokeWidth="1.2" opacity="0.45" />
      <circle cx="24" cy="24" r="19.5" stroke="var(--seal)" strokeWidth="0.7" opacity="0.3" />
      {/* Grain ear — centre stalk with paired leaves */}
      <path d="M24 34.5V15" stroke="var(--seal)" strokeWidth="1.5" strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => {
        const y = 17.5 + i * 4.1;
        return (
          <g key={i}>
            <path
              d={`M24 ${y + 2.6} C 20.4 ${y + 2.2}, 18.6 ${y + 0.4}, 18.3 ${y - 1}`}
              stroke="var(--seal)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d={`M24 ${y + 2.6} C 27.6 ${y + 2.2}, 29.4 ${y + 0.4}, 29.7 ${y - 1}`}
              stroke="var(--seal)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        );
      })}
      {/* Ground line — the field the grain stands in */}
      <path d="M14 37h20" stroke="var(--seal)" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
