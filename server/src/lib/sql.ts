/** Builds `col = $n` fragments from a camelCase patch object. */
export function buildUpdate(
  patch: Record<string, unknown>,
  columns: Record<string, string>,
): { assignments: string[]; values: unknown[] } {
  const assignments: string[] = []
  const values: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const column = columns[key]
    if (!column) continue
    values.push(value)
    assignments.push(`${column} = $${values.length}`)
  }
  return { assignments, values }
}

export function camelize<T extends Record<string, any>>(row: T): T {
  return row
}
