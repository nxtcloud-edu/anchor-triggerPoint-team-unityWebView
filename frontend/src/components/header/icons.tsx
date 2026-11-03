const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  className: 'size-[17px] flex-none',
};

export const IconCompany = () => (
  <svg {...base}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const IconPlatoon = () => (
  <svg {...base}>
    <circle cx="8" cy="8" r="3" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M2.5 20c1-3.5 3.2-5.5 5.5-5.5s4.5 2 5.5 5.5M14 15.5c.9-.6 1.9-1 3-1 2 0 3.6 1.5 4.5 4.5" />
  </svg>
);

export const IconUser = () => (
  <svg {...base}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);

export const IconTheme = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" />
  </svg>
);

export const IconLogout = () => (
  <svg {...base}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
  </svg>
);

export const BrandMark = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="flex-none">
    <circle cx="14" cy="14" r="12" stroke="var(--color-chart-1)" strokeWidth="2" />
    <circle cx="14" cy="14" r="6" stroke="var(--color-chart-1)" strokeWidth="2" />
    <circle cx="14" cy="14" r="1.8" fill="var(--color-chart-2)" />
    <path d="M14 0v6M14 22v6M0 14h6M22 14h6" stroke="var(--color-chart-1)" strokeWidth="2" />
  </svg>
);
