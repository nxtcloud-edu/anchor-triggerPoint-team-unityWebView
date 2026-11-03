import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary';
}

export const Button = ({ variant = 'default', className = '', ...rest }: ButtonProps) => (
  <button
    type="button"
    className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-[7px] disabled:cursor-default disabled:opacity-45 ${
      variant === 'primary'
        ? 'border-accent bg-accent text-text-on-accent hover:opacity-90'
        : 'border-border-default bg-bg-surface hover:bg-bg-surface-2'
    } ${className}`}
    {...rest}
  />
);
