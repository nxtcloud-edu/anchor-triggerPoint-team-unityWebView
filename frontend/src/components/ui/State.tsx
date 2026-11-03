export const Loading = () => <div className="py-16 text-center text-text-muted">불러오는 중…</div>;

export const ErrorBox = ({ message }: { message: string }) => (
  <div className="rounded-[14px] border border-border-default bg-bg-crit-wash px-4 py-3 text-crit">
    {message}
  </div>
);
