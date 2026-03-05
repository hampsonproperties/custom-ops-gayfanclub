/**
 * Shared CSV export utility.
 * Generates RFC-4180 CSV with UTF-8 BOM for Excel compatibility.
 */

export interface CSVColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

function escapeCSV(raw: unknown): string {
  if (raw == null) return ''
  const str = String(raw)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function generateCSV<T>(rows: T[], columns: CSVColumn<T>[]): string {
  const header = columns.map((c) => escapeCSV(c.header)).join(',')
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCSV(col.value(row))).join(',')
  )
  return [header, ...dataRows].join('\r\n')
}

export function downloadCSV(csv: string, filename: string): void {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportFilename(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return `${prefix}-export-${date}.csv`
}
