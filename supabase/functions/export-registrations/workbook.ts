import ExcelJS from 'exceljs';
import { PassThrough, Readable } from 'node:stream';
import { exportColumns, exportValues } from '../_shared/export-columns.ts';
import type { ExportRegistration } from '../_shared/export-columns.ts';

export interface ExportPage {
  cutoff: string;
  rows: ExportRegistration[];
}
export type LoadPage = (cutoff: string, last: ExportRegistration) => Promise<ExportPage>;
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function registrationWorkbook(
  first: ExportPage,
  loadPage: LoadPage,
): ReadableStream<Uint8Array> {
  const output = new PassThrough({ highWaterMark: 64 * 1024 });
  const body = Readable.toWeb(output) as ReadableStream<Uint8Array>;
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: output,
    useStyles: true,
    useSharedStrings: false,
  });
  workbook.creator = 'AI EXPO';
  workbook.created = new Date(first.cutoff);
  const rows = workbook.addWorksheet('Registrations', { views: [{ state: 'frozen', ySplit: 1 }] });
  rows.columns = exportColumns;
  rows.getColumn('localPhone').numFmt = '@';
  rows.getColumn('phone').numFmt = '@';
  rows.getColumn('registeredAt').numFmt = 'yyyy-mm-dd hh:mm:ss';
  const header = rows.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF59339B' } };
  header.height = 28;
  header.commit();

  void (async () => {
    let count = 0;
    let page = first;
    const majors = new Map<string, number>();
    const genders = new Map<string, number>();
    while (page.rows.length) {
      if (output.destroyed) throw new Error('Download cancelled');
      for (const row of page.rows) {
        // Plain string cells (never formulas) preserve user-entered text safely.
        rows.addRow(exportValues(row)).commit();
        count++;
        if (count >= 1_048_575) throw new Error('Excel worksheet row limit reached');
        majors.set(row.major, (majors.get(row.major) ?? 0) + 1);
        genders.set(row.gender, (genders.get(row.gender) ?? 0) + 1);
      }
      if (page.rows.length < 500) break;
      const last = page.rows[page.rows.length - 1];
      page = await loadPage(first.cutoff, last);
    }
    rows.autoFilter = { from: 'A1', to: `M${Math.max(1, count + 1)}` };
    rows.commit();
    const summary = workbook.addWorksheet('Summary');
    summary.columns = [
      { header: 'Metric', key: 'metric', width: 38 },
      { header: 'Value', key: 'value', width: 42 },
    ];
    summary.getRow(1).font = { bold: true };
    summary.getRow(1).commit();
    summary.addRow(['Total registrations exported', count]).commit();
    summary.addRow(['Export cutoff (UTC)', first.cutoff]).commit();
    summary.addRow(['Scope', 'All registrations; not limited to the visible page']).commit();
    summary.addRow(['Names', 'Separate first and last names; full name is derived']).commit();
    for (const [name, total] of [...majors].sort())
      summary.addRow([`Major: ${name}`, total]).commit();
    for (const [name, total] of [...genders].sort())
      summary.addRow([`Gender: ${name}`, total]).commit();
    summary.commit();
    await workbook.commit();
  })().catch((error: unknown) =>
    output.destroy(error instanceof Error ? error : new Error('Export failed')),
  );
  return body;
}
