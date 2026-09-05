/**
 * DataTable — the generic table used across the admin console.
 *
 * - real <table> semantics with <caption> for screen readers
 * - column definitions are typed, so row access is checked at compile time
 * - a sticky header keeps long lists usable
 * - empty and loading states are handled here so managers stay small
 */

import type { ReactNode } from 'react';
import { Spinner } from '../ui/Spinner';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  caption: string;
  loading?: boolean;
  emptyMessage?: string;
  footer?: ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  loading = false,
  emptyMessage = 'Nothing here yet.',
  footer,
}: DataTableProps<T>): JSX.Element {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.className} style={{ textAlign: column.align ?? 'left' }}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="data-table__state">
                <Spinner size={18} label="Loading rows…" />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="data-table__state">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.className}
                    style={{ textAlign: column.align ?? 'left' }}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer ? <tfoot><tr><td colSpan={columns.length}>{footer}</td></tr></tfoot> : null}
      </table>
    </div>
  );
}
