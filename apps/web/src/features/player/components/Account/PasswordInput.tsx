import { type ComponentProps, useEffect, useId, useState } from 'react';
import { t } from '../../../../shared/i18n';

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type' | 'id'> & {
  label: string;
  hint?: string;
};

export function PasswordInput({
  label,
  hint,
  value,
  disabled,
  autoComplete,
  ...props
}: PasswordInputProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!value || disabled) setVisible(false);
  }, [value, disabled]);

  return (
    <div className="password-control">
      <label htmlFor={id}>{label}</label>
      <span className="password-field">
        <input
          {...props}
          id={id}
          value={value}
          disabled={disabled}
          autoComplete={autoComplete}
          type={visible ? 'text' : 'password'}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={t(visible ? 'Ocultar senha: {0}' : 'Mostrar senha: {0}', [label])}
          aria-pressed={visible}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
        >
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M2 12 7 6h10l5 6-5 6H7Z" />
            <path d="M10 10h4v4h-4Z" />
            {visible && <path d="m3 3 18 18" />}
          </svg>
        </button>
      </span>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
