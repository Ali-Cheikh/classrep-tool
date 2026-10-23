export function csvCell(value: string) {
  // Quoting handles delimiters; a leading apostrophe neutralizes spreadsheet formulas.
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function votesCsv(rows: { name: string; email: string; vote: string; comment: string; updatedAt: Date }[]) {
  return '\uFEFF' + [
    ['Name', 'Email', 'Vote', 'Comment', 'Updated at (UTC)'].map(csvCell).join(','),
    ...rows.map(row => [row.name, row.email, row.vote, row.comment, row.updatedAt.toISOString()].map(csvCell).join(',')),
  ].join('\r\n') + '\r\n';
}
