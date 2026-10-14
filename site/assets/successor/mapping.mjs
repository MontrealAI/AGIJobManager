import {fail, keys, text, LIMITS, publicOnly, parseStrict, canonical, sha256} from './safe.mjs';
import {csvRows, dataRows} from './missions.mjs';

export function inputColumns(raw) {
  publicOnly(raw); text(raw, LIMITS.input);
  if (raw.trimStart().startsWith('[')) {
    const records = parseStrict(raw, LIMITS.input); fail(Array.isArray(records) && records.length > 0 && records.length <= LIMITS.rows, 'DATA_LIMIT');
    const columns = Object.keys(records[0]); fail(columns.length >= 3 && columns.length <= 32, 'MAPPING_COLUMNS');
    fail(records.every(row => canonical(Object.keys(row).sort()) === canonical([...columns].sort())), 'MAPPING_COLUMNS');
    return {columns, records};
  }
  const [columns,...rows] = csvRows(raw,32);
  fail(columns.length >= 3 && columns.length <= 32 && new Set(columns).size === columns.length && columns.every(c=>c.length>0&&c.length<=80), 'MAPPING_COLUMNS');
  fail(rows.every(row=>row.length === columns.length), 'CSV_COLUMNS');
  return {columns, records:rows.map(row=>Object.fromEntries(columns.map((name,i)=>[name,row[i]])))};
}
export async function previewMapping(raw, mapping) {
  keys(mapping,['id','category','value'],'MAPPING_FIELDS');
  const {columns,records} = inputColumns(raw);
  fail(new Set(Object.values(mapping)).size === 3 && Object.values(mapping).every(c=>columns.includes(c)), 'MAPPING_COLUMNS');
  const normalized = JSON.stringify(records.map((row,index) => {
    const mapped = Object.fromEntries(Object.entries(mapping).map(([key,column])=>[key,row[column]]));
    try {dataRows(JSON.stringify([mapped]));} catch(error) {error.row=index+1;error.column=mapping.value;throw error;}
    return mapped;
  }),null,2);
  dataRows(normalized);
  const receipt = {originalSha256:await sha256(raw),normalizedSha256:await sha256(normalized),mapping,decimalFormat:'dot-decimal-text'};
  return {normalized,receipt,rows:records.length,preview:parseStrict(normalized).slice(0,5)};
}
