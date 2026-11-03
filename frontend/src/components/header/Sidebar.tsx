import {
  BrandMark,
  IconCompany,
  IconLogout,
  IconPlatoon,
  IconUser,
} from '@/components/header/icons';
import { ThemeToggle } from '@/components/header/ThemeToggle';
import { useAuthStore } from '@/stores/authStore';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/admin', label: '중대 대시보드', icon: <IconCompany />, end: true },
  { to: '/platoons', label: '소대 대시보드', icon: <IconPlatoon /> },
  { to: '/users', label: '사용자 대시보드', icon: <IconUser /> },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex w-auto items-center gap-2.5 rounded-lg px-2.5 py-[9px] md:w-full ${
    isActive ? 'bg-bg-sidebar-active text-text-sidebar-strong' : 'hover:bg-bg-sidebar-hover'
  }`;

export const Sidebar = () => {
  const logout = useAuthStore(s => s.logout);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="bg-bg-sidebar">
      <div className="flex flex-row flex-wrap gap-1.5 bg-bg-sidebar p-3 text-text-sidebar md:sticky md:top-0 md:h-screen md:flex-col md:flex-nowrap md:px-3.5 md:py-[22px]">
        <div className="flex items-center gap-2.5 pr-2 text-[17px] font-bold tracking-wide text-text-sidebar-strong md:px-2 md:pb-[18px]">
          <BrandMark />
          <div className="flex flex-col">
            <div>Trigger_Point</div>
            <div className="text-[11px] font-medium tracking-normal text-text-sidebar-muted">
              영점사격 훈련 분석 플랫폼
            </div>
          </div>
        </div>
        <div className="hidden px-2.5 pt-3.5 pb-1.5 text-[11px] tracking-[.06em] text-text-sidebar-muted md:block">
          관리자
        </div>
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
            {n.icon}
            {n.label}
          </NavLink>
        ))}
        <div className="hidden md:mt-auto md:block" />
        <ThemeToggle />
        <button
          type="button"
          onClick={logout}
          className="flex w-auto cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-left hover:bg-bg-sidebar-hover md:w-full"
        >
          <IconLogout />
          로그아웃
        </button>
        <div className="hidden border-t border-border-sidebar p-2.5 text-xs text-text-sidebar-muted md:block">
          <div>Team Trigger_Point</div>
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-good" />
            ap-northeast-2 · 정상 운영
          </div>
          <div>동기화 {clock.toLocaleTimeString('ko-KR')}</div>
        </div>
      </div>
    </div>
  );
};
