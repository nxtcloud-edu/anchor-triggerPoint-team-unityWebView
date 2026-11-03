import { IconTheme } from '@/components/header/icons';
import { useThemeStore } from '@/stores/themeStore';

export const ThemeToggle = () => {
  const toggleTheme = useThemeStore(s => s.toggleTheme);
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex w-auto cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-left hover:bg-bg-sidebar-hover md:w-full"
    >
      <IconTheme />
      라이트 / 다크 전환
    </button>
  );
};
