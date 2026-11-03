export const Legend = ({
  items,
}: {
  items: { label: string; color: string; line?: boolean; round?: boolean }[];
}) => (
  <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-text-secondary">
    {items.map(it => (
      <div key={it.label} className="flex items-center gap-[5px]">
        <div
          className={
            it.line
              ? 'h-0.5 w-3.5 rounded-sm'
              : `size-2.5 ${it.round ? 'rounded-full' : 'rounded-[3px]'}`
          }
          style={{ background: it.color }}
        />
        {it.label}
      </div>
    ))}
  </div>
);
