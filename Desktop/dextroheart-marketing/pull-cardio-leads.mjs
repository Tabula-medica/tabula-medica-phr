/**
 * Pull cardiologist NPI leads from NPPES for DextroHeart outreach.
 * Targets: Cardiologists (207RC0000X), Electrophysiologists (207RE0101X),
 *          Clinical Cardiac Electrophysiology (207RI0011X), Interventional Cardiology (207RI0200X)
 *
 * Usage: node pull-cardio-leads.mjs [state] [limit]
 *   node pull-cardio-leads.mjs VA 200
 *   node pull-cardio-leads.mjs ""  500   # all states
 *
 * Output: cardio-leads.csv (NPI, name, org, address, phone, fax, email)
 */

import { writeFileSync } from 'fs';
import https from 'https';

const STATE  = process.argv[2] || '';
const LIMIT  = parseInt(process.argv[3] || '200', 10);

const TAXONOMIES = [
  '207RC0000X',  // Cardiovascular Disease (Cardiology)
  '207RE0101X',  // Clinical & Laboratory Cardiac Electrophysiology
  '207RI0011X',  // Clinical Cardiac Electrophysiology
  '207RI0200X',  // Interventional Cardiology
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchNPPES(taxonomy, skip = 0) {
  const params = new URLSearchParams({
    taxonomy_description: '',
    // Use taxonomy code via enumeration_type + limit
    limit: '200',
    skip: String(skip),
    pretty: 'true',
  });
  // Build URL manually to include taxonomy code
  const stateParam = STATE ? `&state=${STATE}` : '';
  const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&taxonomy_description=&limit=200&skip=${skip}&enumeration_type=NPI-1${stateParam}&taxonomy_description_type=${taxonomy}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ results: [] }); }
      });
    }).on('error', reject);
  });
}

async function fetchByTaxonomyCode(taxCode, state, skip = 0) {
  const stateParam = state ? `&addresses.state=${state}` : '';
  const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&taxonomies.code=${taxCode}&enumeration_type=NPI-1&limit=200&skip=${skip}${stateParam}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ results: [], result_count: 0 }); }
      });
    }).on('error', () => resolve({ results: [], result_count: 0 }));
  });
}

function extractRow(r) {
  const basic = r.basic || {};
  const name = [basic.first_name, basic.last_name].filter(Boolean).join(' ')
    || basic.organization_name || '';
  const org = basic.organization_name || basic.authorized_official_organization_name || '';

  const addrs = (r.addresses || []);
  const practice = addrs.find(a => a.address_purpose === 'LOCATION') || addrs[0] || {};

  const phone = practice.telephone_number || '';
  const fax   = practice.fax_number || '';

  // NPPES doesn't expose email — leave blank for manual enrichment
  return {
    npi:     r.number || '',
    name:    name.trim(),
    org:     org.trim(),
    address: [practice.address_1, practice.address_2, practice.city, practice.state, practice.postal_code].filter(Boolean).join(', '),
    city:    practice.city || '',
    state:   practice.state || '',
    zip:     practice.postal_code || '',
    phone:   phone.replace(/[^0-9]/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
    fax:     fax.replace(/[^0-9]/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
    email:   '',
  };
}

function toCsv(rows) {
  const header = 'NPI,Name,Organization,Address,City,State,ZIP,Phone,Fax,Email';
  const lines = rows.map(r =>
    [r.npi, r.name, r.org, r.address, r.city, r.state, r.zip, r.phone, r.fax, r.email]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header, ...lines].join('\n');
}

async function main() {
  console.log(`Pulling cardiologist NPI leads${STATE ? ` in ${STATE}` : ' (all states)'} — target ${LIMIT} records...`);
  const seen = new Set();
  const rows = [];

  for (const tax of TAXONOMIES) {
    if (rows.length >= LIMIT) break;
    let skip = 0;
    while (rows.length < LIMIT) {
      await sleep(300);
      const data = await fetchByTaxonomyCode(tax, STATE, skip);
      const results = data.results || [];
      if (results.length === 0) break;
      for (const r of results) {
        if (seen.has(r.number)) continue;
        seen.add(r.number);
        rows.push(extractRow(r));
        if (rows.length >= LIMIT) break;
      }
      console.log(`  ${tax}: fetched ${results.length} (total so far: ${rows.length})`);
      skip += 200;
      if (results.length < 200) break;
    }
  }

  const csv = toCsv(rows);
  const outPath = 'cardio-leads.csv';
  writeFileSync(outPath, csv, 'utf8');
  console.log(`\nDone. ${rows.length} leads written to ${outPath}`);
  console.log(`Leads with fax: ${rows.filter(r => r.fax).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
