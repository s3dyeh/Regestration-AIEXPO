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
    fullName: index === 0 ? 'أحمد سعدية' : `Person ${index}`,
    participantId: `00${index}`,
    isIeeeMember: false,
    role: 'Student',
    universityName: 'UJ',
    attendedAt: index === 0 ? cutoff : null,
    email: index === 1 ? '=1+1' : `p${index}@example.com`,
    major: 'Engineering',
    gender: 'Male',
    showName: true,
    majorCategory: 'Engineering',
    ieeeMembershipId: '00123456',
    organizationName: 'Example Organization',
    position: 'Engineer',
    referralSource: 'University Announcements',
    dataQualityNotes: 'Review supplied membership ID',
  };
}

Deno.test(
  'streamed Excel includes every batch, summary, Arabic text, no phone columns and no formulas',
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
    const sheet = workbook.getWorksheet('Attendance')!;
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(sheet.getRow(1).values).includes('Phone'), false);
    assert.equal(sheet.rowCount, 502);
    assert.equal(Object.values(sheet.getRow(1).values).includes('Gender'), false);
    assert.equal(
      JSON.stringify(workbook.getWorksheet('Summary')!.getSheetValues()).includes('Gender:'),
      false,
    );
    assert.equal(sheet.getCell('B2').value, 'أحمد سعدية');
    assert.equal(sheet.getCell('H3').value, '=1+1');
    assert.equal(sheet.getCell('H3').type, ExcelJS.ValueType.String);
    assert.equal(sheet.getCell('B502').value, 'Person 500');
    assert.equal(sheet.getCell('K2').value, 'Engineering');
    assert.equal(sheet.getCell('L2').value, '00123456');
    assert.equal(sheet.getCell('O2').value, 'University Announcements');
    assert.equal(sheet.getCell('P2').value, 'Review supplied membership ID');
    assert.equal(workbook.getWorksheet('Summary')!.getCell('B2').value, 501);
  },
);

Deno.test('empty export produces a valid workbook with column headings', async () => {
  const stream = registrationWorkbook({ cutoff, rows: [] }, () => {
    throw new Error('Unexpected query');
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await new Response(stream).arrayBuffer());
  assert.equal(workbook.getWorksheet('Attendance')!.rowCount, 1);
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
