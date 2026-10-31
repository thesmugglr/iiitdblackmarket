import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentBatches, extractCodes, toSql } from '../scripts/student-codes.mjs';

// Synthetic markup shaped like the institute's table; none of this is real student data.
const html = `<table><tr><th>S. No.</th><th>Roll No.</th><th>Student Name</th><th>Program</th></tr>
  <tr><td>1</td><td>2025001</td><td>Test Person One</td><td>CSE</td></tr>
  <tr><td>2</td><td>2025002</td><td>Test Person Two</td><td>CSAM</td></tr>
  <tr><td>3</td><td>2024003</td><td>Test Person Three</td><td>ECE</td></tr>
  <tr><td>4</td><td>2019004</td><td>Old Batch Person</td><td>CSD</td></tr>
  <tr><td>5</td><td>2025001</td><td>Duplicate Row</td><td>CSE</td></tr>
  <tr><td>6</td><td>2026777</td><td>Test Person Four</td><td>CS&amp;B</td></tr></table>
  <p>Call 2025999 for help</p>`;

test('extracts only five-digit codes for the requested batches, once each', () => {
  const { codes, perBatch } = extractCodes(html, 2024, 2026);
  assert.deepEqual(codes, ['24003', '25001', '25002', '26777']);
  assert.deepEqual(perBatch, { 2024: 1, 2025: 2, 2026: 1 });
});

test('stray numbers outside table rows are ignored', () => {
  assert.ok(!extractCodes(html, 2024, 2026).codes.includes('25999'));
});

test('the generated SQL contains codes only, never names', () => {
  const sql = toSql(extractCodes(html, 2024, 2026).codes, 'https://example.test/page', new Date('2026-10-31T00:00:00Z'));
  assert.ok(sql.includes("('25001')") && sql.includes('approve_listed_students'));
  assert.doesNotMatch(sql, /Test Person|Duplicate|Old Batch/);
  assert.match(sql, /4 five-digit codes/);
});

test('refuses anything that is not a five-digit code', () => {
  assert.throws(() => toSql(['25001', 'abc12'], 'x'), /five-digit/);
});

test('current batches cover the four enrolled years', () => {
  assert.deepEqual(currentBatches(new Date('2026-10-31')), { first: 2023, last: 2026 });
  assert.deepEqual(currentBatches(new Date('2027-03-15')), { first: 2023, last: 2026 });
  assert.deepEqual(currentBatches(new Date('2027-08-01')), { first: 2024, last: 2027 });
});
