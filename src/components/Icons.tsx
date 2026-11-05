interface IconProps {
  size?: number;
}

export function IconPlay({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 2.8v10.4L13 8 4.5 2.8z" fill="currentColor" />
    </svg>
  );
}

export function IconPause({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="4" y="2.8" width="2.8" height="10.4" fill="currentColor" />
      <rect x="9.2" y="2.8" width="2.8" height="10.4" fill="currentColor" />
    </svg>
  );
}

export function IconCheck({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.2 8.4l3.1 3.1 6.5-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconLock({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect
        x="3.5"
        y="7"
        width="9"
        height="6.5"
        rx="1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M5.6 7V5.3a2.4 2.4 0 0 1 4.8 0V7" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function IconBook({ size = 22 }: IconProps) {  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 5.2c2.6-1.1 5.3-1.1 8 0 2.7-1.1 5.4-1.1 8 0v13.6c-2.6-1.1-5.3-1.1-8 0-2.7-1.1-5.4-1.1-8 0V5.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M12 5.4v13.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function IconUsers({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <circle cx="7" cy="6" r="2.4" />
      <path d="M2.8 14.2c0-2.3 1.9-3.7 4.2-3.7s4.2 1.4 4.2 3.7" />
      <path d="M12.6 4.2a2.2 2.2 0 0 1 0 4.2" />
      <path d="M14 10.8c1.3.4 2.2 1.5 2.2 3.2" />
    </svg>
  );
}
