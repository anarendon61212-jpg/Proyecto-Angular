/**
 * Normalizes status values to match backend expectations (active/inactive)
 * Handles both Spanish (Activo/Activa/Inactivo/Inactiva) and English (active/inactive)
 */
export function normalizeStatus(status: string): string {
  if (!status) {
    return 'inactive';
  }

  const normalized = status.trim().toLowerCase();

  // Active statuses
  if (['activo', 'activa', 'active'].includes(normalized)) {
    return 'active';
  }

  // Inactive statuses
  if (['inactivo', 'inactiva', 'inactive'].includes(normalized)) {
    return 'inactive';
  }

  // Default to inactive for unknown values
  return 'inactive';
}

/**
 * Converts backend status (active/inactive) to display format (Activo/Inactivo)
 */
export function statusToDisplay(status: string): string {
  if (!status) {
    return 'Inactivo';
  }

  const normalized = status.trim().toLowerCase();

  if (['activo', 'activa', 'active'].includes(normalized)) {
    return 'Activo';
  }

  if (['inactivo', 'inactiva', 'inactive'].includes(normalized)) {
    return 'Inactivo';
  }

  return status;
}
