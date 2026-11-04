/**
 * Small inline icons (no icon library). All are decorative: aria-hidden, and
 * whatever they sit next to carries the accessible name.
 */

type Props = { className?: string };

const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export const ArrowRight = ({ className = "size-4" }: Props) => (
  <svg {...svg} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const Sparkle = ({ className = "size-4" }: Props) => (
  <svg {...svg} className={className}>
    <path d="M10 4l1.6 4.4L16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6z" />
    <path d="M18 15v4M16 17h4" />
  </svg>
);

export const Doc = ({ className = "size-4" }: Props) => (
  <svg {...svg} className={className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

export const Check = ({ className = "size-4" }: Props) => (
  <svg {...svg} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export const Send = ({ className = "size-4" }: Props) => (
  <svg {...svg} className={className}>
    <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />
  </svg>
);

export const Plus = ({ className = "size-4" }: Props) => (
  <svg {...svg} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Close = ({ className = "size-4" }: Props) => (
  <svg {...svg} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const Dots = ({ className = "size-4" }: Props) => (
  <svg {...svg} strokeWidth={3} className={className}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" />
  </svg>
);

export const ChevronDown = ({ className = "size-4" }: Props) => (
  <svg {...svg} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const ExternalLink = ({ className = "size-4" }: Props) => (
  <svg {...svg} className={className}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);

export const Download = ({ className = "size-4" }: Props) => (
  <svg {...svg} className={className}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
