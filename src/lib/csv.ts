import 'server-only';

/** Serializa linhas em CSV RFC-4180 com BOM para Excel. */
export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [headers.map(escape).join(';'), ...rows.map((row) => row.map(escape).join(';'))];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
