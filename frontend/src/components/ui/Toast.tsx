import { useToastStore } from '@/stores/toastStore';

export const Toast = () => {
  const { message, visible } = useToastStore();
  return (
    <div
      className={`pointer-events-none fixed bottom-[22px] right-[22px] z-50 rounded-[10px] bg-bg-tooltip px-4 py-2.5 text-[13px] text-text-tooltip transition duration-200 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      {message}
    </div>
  );
};
