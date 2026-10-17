import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`app-button btn-${variant} btn-${size} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="animate-spin-slow">⏳</span>
      ) : (
        icon && <span className="btn-icon">{icon}</span>
      )}
      {children && <span className="btn-text">{children}</span>}
    </button>
  );
};
