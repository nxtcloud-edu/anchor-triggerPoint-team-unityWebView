interface SegmentedProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: NoInfer<T>) => void;
}

export const Segmented = <T extends string | number>({
  options,
  value,
  onChange,
}: SegmentedProps<T>) => (
  <div className="inline-flex overflow-hidden rounded-lg border border-border-default bg-bg-surface">
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`cursor-pointer px-3 py-[7px] ${
          o.value === value ? 'bg-bg-accent-wash font-semibold text-accent' : 'text-text-secondary'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);
