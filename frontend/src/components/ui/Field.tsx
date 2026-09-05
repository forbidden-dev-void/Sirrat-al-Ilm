/**
 * Form field primitives
 * =====================
 *
 * Every input is wired for accessibility:
 *   - a real <label htmlFor>
 *   - aria-invalid + aria-describedby pointing at the error/help text
 *   - optional hint text that stays associated with the control
 *
 * They are uncontrolled-friendly: pass `value` + `onChange` from form state.
 */

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface BaseFieldProps {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  className?: string;
}

function fieldMessage(id: string, error?: string | null, hint?: string): ReactNode {
  if (error) {
    return (
      <p className="field__error" id={id} role="alert">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p className="field__hint" id={id}>
        {hint}
      </p>
    );
  }
  return null;
}

/* ------------------------------------------------------------------ text */
export interface TextFieldProps extends BaseFieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  leadingIcon?: ReactNode;
}

export function TextField({
  label,
  error,
  hint,
  required,
  leadingIcon,
  id,
  ...rest
}: TextFieldProps): JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const messageId = `${fieldId}-message`;

  return (
    <div className="field">
      <label className="field__label" htmlFor={fieldId}>
        {label}
        {required ? <span className="field__required" aria-hidden="true"> *</span> : null}
      </label>
      <div className={`field__control${leadingIcon ? ' field__control--icon' : ''}`}>
        {leadingIcon ? <span className="field__icon" aria-hidden="true">{leadingIcon}</span> : null}
        <input
          id={fieldId}
          className={`input${error ? ' input--error' : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          required={required}
          {...rest}
        />
      </div>
      {fieldMessage(messageId, error, hint)}
    </div>
  );
}

/* -------------------------------------------------------------- textarea */
export interface TextAreaFieldProps
  extends BaseFieldProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {}

export function TextAreaField({
  label,
  error,
  hint,
  required,
  id,
  rows = 5,
  ...rest
}: TextAreaFieldProps): JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const messageId = `${fieldId}-message`;

  return (
    <div className="field">
      <label className="field__label" htmlFor={fieldId}>
        {label}
        {required ? <span className="field__required" aria-hidden="true"> *</span> : null}
      </label>
      <textarea
        id={fieldId}
        rows={rows}
        className={`input input--area${error ? ' input--error' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        required={required}
        {...rest}
      />
      {fieldMessage(messageId, error, hint)}
    </div>
  );
}

/* ---------------------------------------------------------------- select */
export interface SelectFieldProps
  extends BaseFieldProps,
    Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  options: { value: string; label: string }[];
}

export function SelectField({
  label,
  error,
  hint,
  required,
  options,
  id,
  ...rest
}: SelectFieldProps): JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const messageId = `${fieldId}-message`;

  return (
    <div className="field">
      <label className="field__label" htmlFor={fieldId}>
        {label}
        {required ? <span className="field__required" aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={fieldId}
        className={`input input--select${error ? ' input--error' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        required={required}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {fieldMessage(messageId, error, hint)}
    </div>
  );
}

/* -------------------------------------------------------------- checkbox */
export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export function CheckboxField({ label, description, id, ...rest }: CheckboxFieldProps): JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="checkbox">
      <input id={fieldId} type="checkbox" {...rest} />
      <label htmlFor={fieldId}>
        <span className="checkbox__label">{label}</span>
        {description ? <span className="checkbox__description">{description}</span> : null}
      </label>
    </div>
  );
}
