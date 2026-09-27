import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { registrationWorkbook } from './workbook.ts';
import type { ExportRegistration } from '../_shared/export-columns.ts';

const cutoff = '2026-09-27T10:00:00.000Z';
function record(index: number): ExportRegistration {
  return {
    id: `id-${index}`,
    eventId: 'event',
    requestId: `request-${index}`,
    createdAt: cutoff,
    name: index === 0 ? 'أحمد سعدية' : `Person ${index}`,
    email: index === 1 ? '=1+1' : `p${index}@example.com`,
    phone: '+962790000000',
    major: 'Engineering',
    gender: 'Male',
    showName: true,
  };
}

Deno.test(
  'streamed Excel includes every batch, summary, Arabic text, text phones and no formulas',
  async () => {
    let calls = 0;
    const stream = registrationWorkbook(
      { cutoff, rows: Array.from({ length: 500 }, (_, i) => record(i)) },
      (before, last) => {
        calls++;
        assert.equal(before, cutoff);
        assert.equal(last.id, 'id-499');
        return Promise.resolve({ cutoff, rows: [record(500)] });
      },
    );
    const buffer = await new Response(stream).arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Registrations')!;
    assert.equal(calls, 1);
    assert.equal(sheet.rowCount, 502);
    assert.equal(sheet.getCell('A2').value, 'أحمد سعدية');
    assert.equal(sheet.getCell('B3').value, '=1+1');
    assert.equal(sheet.getCell('B3').type, ExcelJS.ValueType.String);
    assert.equal(sheet.getCell('C2').value, '0790000000');
    assert.equal(sheet.getCell('C2').numFmt, '@');
    assert.equal(sheet.getCell('H502').value, 'id-500');
    assert.equal(workbook.getWorksheet('Summary')!.getCell('B2').value, 501);
  },
);

Deno.test('empty export produces a valid workbook with column headings', async () => {
  const stream = registrationWorkbook({ cutoff, rows: [] }, () => {
    throw new Error('Unexpected query');
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await new Response(stream).arrayBuffer());
  assert.equal(workbook.getWorksheet('Registrations')!.rowCount, 1);
  assert.equal(workbook.getWorksheet('Summary')!.getCell('B2').value, 0);
});

Deno.test(
  'a failed later batch terminates the stream instead of downloading a partial workbook',
  async () => {
    const stream = registrationWorkbook(
      { cutoff, rows: Array.from({ length: 500 }, (_, i) => record(i)) },
      () => Promise.reject(new Error('Database unavailable')),
    );
    await assert.rejects(() => new Response(stream).arrayBuffer(), /Database unavailable/);
  },
);
