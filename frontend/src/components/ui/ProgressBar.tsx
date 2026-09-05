/**
 * ProgressBar — learning progress indicator.
 *
 * Fully accessible: the wrapper carries role="progressbar" with the standard
 * value attributes, and the visible percentage is repeated as text so screen
 * readers and low-vision users both get it.
 */

import { clampPercent } from '../../lib/format';

export interface ProgressBarProps {
  value: number;
  label?: string;
  size?: 'sm' | 'md';
  showValue?: boolean;
  tone?: 'chocolate' | 'latte';
  id?: string;
}

export function ProgressBar({
  value,
  label,
  size = 'md',
  showValue = false,
  tone = 'chocolate',
  id,
}: ProgressBarProps): JSX.Element {
  const percent = clampPercent(value);
  return (
    <div className={`progress progress--${size}`}>
      {label ? (
        <span className="progress__label" id={id ? `${id}-label` : undefined}>
          {label}
        </span>
      ) : null}
      <div
        className="progress__track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-labelledby={label && id ? `${id}-label` : undefined}
        aria-label={!label ? 'Progress' : undefined}
      >
        <span
          className={`progress__fill progress__fill--${tone}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showValue ? <span className="progress__value">{percent}%</span> : null}
    </div>
  );
}
