/* =============================================
   ADMIN SHARED — TYPE DEFINITIONS
   ============================================= */

/** Column definition for AdminTable */
export interface TableColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'date' | 'image' | 'status' | 'badge';
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

/** Row action definition */
export interface RowAction {
  key: string;
  label: string;
  variant?: 'default' | 'danger' | 'warning' | 'primary';
  disabled?: boolean;
  /** Optional predicate: receives the row and returns true if action should show */
  showWhen?: (row: any) => boolean;
}

/** Emitted when a row action is clicked */
export interface ActionEvent {
  action: string;
  row: any;
}

/** Pagination config */
export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
}

/** Filter option item */
export interface FilterOption {
  value: string | number;
  label: string;
}

/** A single filter field definition */
export interface FilterField {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date-range';
  options?: FilterOption[];
  placeholder?: string;
}

/** StatusBadge variant */
export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

/** ConfirmDialog config */
export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
}
