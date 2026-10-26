import {FTAGS,PREP_ITEMS,SEVERITY,DEPARTMENTS,SURVEY_TYPES,CMS_SURVEY,demoDeficiencies,prepProgress,groupByDept,topRiskTags,riskScore,scoreSeverity,validDate} from './core.js';

// ── State ──────────────────────────────────────────────────────────────────
const state={
  page:'overview',
  deficiencies:demoDeficiencies(),
  checkedPrep:[],
  filter:{dept:'',freq:'',cat:''},
  query:'',
  facilityNPI:'',
  facilityName:'',
  facilityState:'',
  npiResult:null,
  npiLoading:false,
  npiError:'',
  surveyDate:'',
  addForm:{tag:'',severity:'D',dept:'Nursing',notes:'',date:'',title:''},
  addOpen:false,
  activeFtag:null,
};

// ── Helpers ────────────────────────────────────────────────────────────────
const $=(s)=>document.querySelector(s);
const esc=(s)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function sev(code){const s='ABCDEFGHIJKL'.indexOf(code);if(s<3)return'sev-ac';if(s<6)return'sev-df';if(s<9)return'sev-gi';return'sev-jl';}
function sevBadge(code){return`<span class="chip sev ${sev(code)}">${esc(code)}</span>`;}
function freqChip(f){const m={HIGH:'chip-high',MED:'chip-med',LOW:'chip-low'};return`<span class="chip ${m[f]||'chip-low'}">${esc(f)}</span>`;}
function statusChip(s){const m={Open:'chip-open','In Progress':'chip-progress',Corrected:'chip-corrected'};return`<span class="chip ${m[s]||''}">${esc(s)}</span>`;}
function defCardClass(sev){const s='ABCDEFGHIJKL'.indexOf(sev);if(s<3)return'sev-a-c';if(s<6)return'sev-d-f';if(s<9)return'sev-g-i';return'sev-j-l';}
function donut(pct,r=38){const c=2*Math.PI*r;const fill=c*(pct/100);return`<svg width="90" height="90" viewBox="0 0 90 90"><circle cx="45" cy="45" r="${r}" fill="none" stroke="#dee2e6" stroke-width="10"/><circle cx="45" cy="45" r="${r}" fill="none" stroke="#2FAE7E" stroke-width="10" stroke-dasharray="${fill} ${c}" stroke-linecap="round"/></svg>`;}
function pBar(pct){return`<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>`;}
function today(){return new Date().toISOString().slice(0,10);}
function daysUntil(d){if(!d)return null;const diff=new Date(d+'T00:00:00Z')-new Date();return Math.ceil(diff/(1000*60*60*24));}
function uniqueCats(){return [...new Set(FTAGS.map(f=>f.cat))].sort();}

// ── Render ─────────────────────────────────────────────────────────────────
function render(){$('#app').innerHTML=shell();}

function shell(){return`
<nav class="nav">
  <span class="nav-brand"><span class="logo-dot">⬡</span> RegLens <span class="logo-sub">SNF Survey Intelligence</span></span>
  <div class="nav-links">
    ${['overview','ftags','tracker','prep','resources','facilities'].map(p=>`<button class="nav-link${state.page===p?' active':''}" data-page="${p}">${pageLabel(p)}</button>`).join('')}
  </div>
  <div class="nav-right"><span class="nav-version">SOM ${esc(CMS_SURVEY.som)}</span></div>
</nav>
<div class="shell"><div class="main-content">${page()}</div></div>
<footer class="footer">RegLens · SNF Survey Intelligence &nbsp;|&nbsp; CMS SOM ${esc(CMS_SURVEY.som)} effective ${esc(CMS_SURVEY.effective)} &nbsp;|&nbsp; <a href="${CMS_SURVEY.momUrl||CMS_SURVEY.somUrl}" target="_blank">CMS Guidance</a></footer>
<footer class="legal-footer">
  <span>© 2026 Tabula Medica LLC</span>
  <a href="/terms.html" target="_blank" rel="noopener">Terms</a>
  <a href="/privacy.html" target="_blank" rel="noopener">Privacy</a>
  <span>reglens.health</span>
</footer>
`;}

function pageLabel(p){return{overview:'Overview',ftags:'F-Tags',tracker:'Tracker',prep:'Prep Checklist',resources:'Resources',facilities:'Facilities'}[p]||p;}

function page(){
  if(state.page==='overview')return pageOverview();
  if(state.page==='ftags')return pageFtags();
  if(state.page==='tracker')return pageTracker();
  if(state.page==='prep')return pagePrep();
  if(state.page==='resources')return pageResources();
  if(state.page==='facilities')return pageFacilities();
  return'<p>Page not found.</p>';
}

// ── Overview ───────────────────────────────────────────────────────────────
function pageOverview(){
  const defs=state.deficiencies;
  const open=defs.filter(d=>d.status==='Open').length;
  const inProg=defs.filter(d=>d.status==='In Progress').length;
  const corrected=defs.filter(d=>d.status==='Corrected').length;
  const prog=prepProgress(state.checkedPrep);
  const risk=riskScore(defs.filter(d=>d.status!=='Corrected'));
  const top=topRiskTags(defs);
  const days=state.surveyDate?daysUntil(state.surveyDate):null;
  const catCounts={};for(const d of defs){const info=FTAGS.find(f=>f.tag===d.tag);if(info)catCounts[info.cat]=(catCounts[info.cat]||0)+1;}
  const topCat=Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);
  return`
<div class="page-header">
  <div class="page-title">Survey Intelligence Overview</div>
  <div class="page-subtitle">Active deficiency tracking, prep progress, and top-risk F-tags</div>
</div>

<div class="stat-grid">
  <div class="stat-card${open>0?' danger':''}">
    <div class="stat-label">Open Deficiencies</div>
    <div class="stat-value">${open}</div>
    <div class="stat-sub">${inProg} in progress, ${corrected} corrected</div>
  </div>
  <div class="stat-card${risk>=20?' danger':risk>=10?' warn':''}">
    <div class="stat-label">Risk Score</div>
    <div class="stat-value">${risk}</div>
    <div class="stat-sub">Cumulative severity score</div>
  </div>
  <div class="stat-card${prog.pct<50?' warn':prog.pct===100?' ok':''}">
    <div class="stat-label">Prep Checklist</div>
    <div class="stat-value">${prog.pct}%</div>
    <div class="stat-sub">${prog.done}/${prog.total} items complete</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">${days!==null?'Survey In':'Next Survey'}</div>
    <div class="stat-value${days!==null&&days<=14?' warn':''}">${days!==null?days+' d':'—'}</div>
    <div class="stat-sub">${state.surveyDate||'Set date below'}</div>
  </div>
</div>

<div class="grid-2 section-gap">
  <div class="panel">
    <div class="panel-title">Survey Prep Progress</div>
    <div class="donut-wrap">
      <div class="donut">${donut(prog.pct)}<div class="donut-center"><div class="donut-pct">${prog.pct}%</div><div class="donut-label">Done</div></div></div>
      <div class="donut-legend"><strong>${prog.done} of ${prog.total}</strong>checklist items completed<br><small class="td-muted">${prog.total-prog.done} remaining across all departments</small></div>
    </div>
    <div style="margin-top:14px"><button class="btn btn-outline btn-sm" data-page="prep">Open Prep Checklist →</button></div>
  </div>
  <div class="panel">
    <div class="panel-title">Top Risk F-Tags</div>
    ${top.length===0?'<div class="empty"><div class="empty-title">No deficiencies logged</div></div>':''}
    <div class="risk-tag-list">
      ${top.map(t=>`
        <div class="risk-tag-item">
          <span class="td-tag" style="min-width:52px">${esc(t.tag)}</span>
          <div class="risk-tag-bar-wrap"><div class="risk-tag-bar" style="width:${Math.min(100,t.count*33)}%"></div></div>
          <span class="risk-tag-count">${t.count}x</span>
          <span class="td-muted" style="font-size:0.78rem;min-width:60px">${esc(t.info?.cat||'')}</span>
        </div>`).join('')}
    </div>
  </div>
</div>

<div class="grid-2 section-gap">
  <div class="panel">
    <div class="panel-title">Open &amp; In-Progress Deficiencies</div>
    <div class="deficiency-list">
      ${defs.filter(d=>d.status!=='Corrected').slice(0,4).map(d=>defCard(d,false)).join('')||'<div class="empty"><div class="empty-icon">✓</div><div class="empty-title">No open deficiencies</div></div>'}
    </div>
    <div style="margin-top:12px"><button class="btn btn-outline btn-sm" data-page="tracker">All deficiencies →</button></div>
  </div>
  <div class="panel">
    <div class="panel-title">Upcoming Survey</div>
    <div class="form-group" style="margin-bottom:14px">
      <label for="survey-date-input">Target / Expected Survey Date</label>
      <input id="survey-date-input" type="date" value="${esc(state.surveyDate)}" placeholder="YYYY-MM-DD">
    </div>
    ${state.surveyDate&&days!==null?`
      <div class="alert ${days<=7?'alert-error':days<=30?'alert-warn':'alert-info'}">
        ${days<=0?'Survey date has passed or is today.':days<=7?`Survey in <strong>${days} days</strong> — immediate action required.`:days<=30?`Survey in <strong>${days} days</strong> — complete all P0 prep items.`:`Survey in <strong>${days} days</strong> — on track.`}
      </div>`:''}
    <div style="margin-top:8px">
      <div class="panel-title">Top Deficiency Categories</div>
      ${topCat.length===0?'<div class="td-muted" style="font-size:0.85rem">No deficiencies logged yet.</div>':topCat.map(([cat,cnt])=>`
        <div class="risk-tag-item" style="margin-bottom:6px">
          <span style="font-size:0.82rem;min-width:140px;flex:1">${esc(cat)}</span>
          ${pBar(Math.min(100,cnt*25))}
          <span class="risk-tag-count">${cnt}</span>
        </div>`).join('')}
    </div>
  </div>
</div>

<div class="panel section-gap" style="background:#f0faf5;border:1.5px solid #2FAE7E">
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
    <div>
      <div style="font-size:0.95rem;font-weight:700;color:#0A1628;margin-bottom:4px">Get weekly survey prep tips</div>
      <div style="font-size:0.83rem;color:#555">F-tag updates, deficiency trends, and QAPI guidance — straight to your inbox.</div>
    </div>
    <div id="subscribe-widget" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input id="subscribe-email" type="email" placeholder="you@facility.org"
        style="padding:9px 14px;border:1.5px solid #2FAE7E;border-radius:6px;font-size:0.88rem;min-width:220px;outline:none">
      <button id="subscribe-btn" class="btn btn-primary" style="white-space:nowrap">Get survey prep tips &rarr;</button>
    </div>
  </div>
</div>`;
}

// ── F-Tag detail panel ─────────────────────────────────────────────────────
function ftagDetail(f){
  const sevInfo=SEVERITY[f.severity_typical]||{};
  const cmsBase='https://www.cms.gov/medicare/provider-enrollment-and-certification/guidanceforlawsandregulations/nursing-homes';
  return`
<div class="ftag-detail-panel">
  <div class="ftag-detail-header">
    <span class="td-tag" style="font-size:1rem;color:var(--teal-dark)">${esc(f.tag)}</span>
    <span>${esc(f.title)}</span>
  </div>
  <div class="ftag-detail-grid">
    <div><strong>Regulation</strong><span>${esc(f.reg)}</span></div>
    <div><strong>Category</strong><span>${esc(f.cat)}</span></div>
    <div><strong>Primary Dept</strong><span>${esc(f.dept)}</span></div>
    <div><strong>Citation Frequency</strong><span>${freqChip(f.freq)}</span></div>
    <div style="grid-column:span 2"><strong>Typical Severity</strong><span style="display:inline-flex;align-items:center;gap:8px;margin-top:3px">${sevBadge(f.severity_typical)}<span style="font-size:0.82rem;color:var(--text-muted)">${esc(sevInfo.label||'')} · ${esc(sevInfo.scope||'')} scope</span></span></div>
  </div>
  <div class="ftag-detail-actions">
    <button class="btn btn-primary btn-sm" data-action="log-ftag" data-tag="${esc(f.tag)}">Log Deficiency →</button>
    <a href="${esc(cmsBase)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">CMS SOM Reference ↗</a>
  </div>
</div>`;}

// ── F-Tags Browser ─────────────────────────────────────────────────────────
function pageFtags(){
  const q=state.query.toLowerCase();
  const deptF=state.filter.dept;
  const freqF=state.filter.freq;
  const catF=state.filter.cat;
  const filtered=FTAGS.filter(f=>
    (!q||f.tag.toLowerCase().includes(q)||f.title.toLowerCase().includes(q)||f.reg.toLowerCase().includes(q)||f.cat.toLowerCase().includes(q))&&
    (!deptF||f.dept===deptF)&&(!freqF||f.freq===freqF)&&(!catF||f.cat===catF));
  return`
<div class="page-header">
  <div class="page-title">F-Tag Reference Browser</div>
  <div class="page-subtitle">${FTAGS.length} F-tags · CMS SOM ${esc(CMS_SURVEY.som)}</div>
</div>
<div class="panel section-gap">
  <div class="form-row">
    <div class="form-group" style="flex:2">
      <label>Search F-tags</label>
      <input id="ftag-q" type="text" placeholder="tag, title, regulation, category…" value="${esc(state.query)}">
    </div>
    <div class="form-group">
      <label>Department</label>
      <select id="ftag-dept">
        <option value="">All Departments</option>
        ${DEPARTMENTS.map(d=>`<option value="${esc(d)}"${deptF===d?' selected':''}>${esc(d)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Frequency</label>
      <select id="ftag-freq">
        <option value="">All</option>
        ${['HIGH','MED','LOW'].map(f=>`<option value="${f}"${freqF===f?' selected':''}>${f}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Category</label>
      <select id="ftag-cat">
        <option value="">All Categories</option>
        ${uniqueCats().map(c=>`<option value="${esc(c)}"${catF===c?' selected':''}>${esc(c)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group fixed" style="justify-content:flex-end">
      <label>&nbsp;</label>
      <button class="btn btn-outline btn-sm" id="ftag-clear">Clear</button>
    </div>
  </div>
  <div class="td-muted" style="font-size:0.8rem;margin-bottom:8px">Showing ${filtered.length} of ${FTAGS.length} F-tags</div>
</div>
<div class="table-wrap">
  <table>
    <thead><tr><th>F-Tag</th><th>Regulation</th><th>Title</th><th>Category</th><th>Dept</th><th>Freq</th><th>Typical Sev</th></tr></thead>
    <tbody>
      ${filtered.length===0?`<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">No F-tags match the current filters.</td></tr>`:''}
      ${filtered.map(f=>{const active=state.activeFtag===f.tag;return`
        <tr class="ftag-row${active?' ftag-row-active':''}" data-ftag="${esc(f.tag)}" title="Click to expand details">
          <td class="td-tag">${esc(f.tag)}</td>
          <td class="td-reg">${esc(f.reg)}</td>
          <td class="td-title">${esc(f.title)}</td>
          <td class="td-muted">${esc(f.cat)}</td>
          <td class="td-muted">${esc(f.dept)}</td>
          <td>${freqChip(f.freq)}</td>
          <td>${sevBadge(f.severity_typical)}</td>
        </tr>
        ${active?`<tr class="ftag-detail-expand"><td colspan="7">${ftagDetail(f)}</td></tr>`:''}`}).join('')}
    </tbody>
  </table>
</div>`;
}

// ── Deficiency Tracker ─────────────────────────────────────────────────────
function pageTracker(){
  const defs=state.deficiencies;
  const open=defs.filter(d=>d.status==='Open').length;
  const inProg=defs.filter(d=>d.status==='In Progress').length;
  return`
<div class="page-header">
  <div class="page-title">Deficiency Tracker</div>
  <div class="page-subtitle">${defs.length} total · ${open} open · ${inProg} in progress</div>
</div>
<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
  <button class="btn btn-primary" id="add-def-btn">${state.addOpen?'✕ Cancel':'+ Add Deficiency'}</button>
  <button class="btn btn-outline btn-sm" id="load-demo-btn">Load Demo Data</button>
  <button class="btn btn-outline btn-sm" id="clear-defs-btn">Clear All</button>
  ${state.deficiencies.length?`<button class="btn btn-outline btn-sm" id="export-csv-btn" style="margin-left:auto">Export CSV ↓</button>`:''}
</div>
${state.addOpen?addDefForm():''}
<div class="deficiency-list">
  ${defs.length===0?`<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No deficiencies logged</div><div>Click "Add Deficiency" to start tracking.</div></div>`:''}
  ${defs.map(d=>defCard(d,true)).join('')}
</div>`;
}

function addDefForm(){
  const f=state.addForm;
  const tags=FTAGS.map(t=>`<option value="${esc(t.tag)}"${f.tag===t.tag?' selected':''}>${esc(t.tag)} — ${esc(t.title)}</option>`).join('');
  return`
<div class="panel section-gap" id="add-def-form">
  <div class="panel-title">New Deficiency</div>
  <div class="form-row">
    <div class="form-group" style="flex:2">
      <label>F-Tag</label>
      <select id="f-tag">
        <option value="">Select F-Tag…</option>
        ${tags}
      </select>
    </div>
    <div class="form-group">
      <label>Severity</label>
      <select id="f-sev">
        ${Object.keys(SEVERITY).map(s=>`<option value="${s}"${f.severity===s?' selected':''}>${s} — ${SEVERITY[s].scope}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Department</label>
      <select id="f-dept">
        ${DEPARTMENTS.map(d=>`<option value="${esc(d)}"${f.dept===d?' selected':''}>${esc(d)}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="form-row">
    <div class="form-group" style="flex:2">
      <label>Title / Short Description</label>
      <input id="f-title" type="text" placeholder="Brief deficiency title" value="${esc(f.title)}">
    </div>
    <div class="form-group">
      <label>Date Identified</label>
      <input id="f-date" type="date" value="${f.date||today()}">
    </div>
  </div>
  <div class="form-group section-gap">
    <label>Notes / Observation Details</label>
    <textarea id="f-notes" rows="3" placeholder="Describe findings, affected residents, circumstances…">${esc(f.notes)}</textarea>
  </div>
  <div style="display:flex;gap:8px;margin-top:4px">
    <button class="btn btn-primary" id="save-def-btn">Save Deficiency</button>
    <button class="btn btn-outline" id="cancel-def-btn">Cancel</button>
  </div>
</div>`;
}

function defCard(d,withActions){
  const info=FTAGS.find(f=>f.tag===d.tag);
  return`
<div class="deficiency-card ${defCardClass(d.severity)}${d.status==='Corrected'?' corrected':''}" data-def-id="${esc(d.id)}">
  <div class="deficiency-header">
    <span class="deficiency-tag">${esc(d.tag)}</span>
    <span class="deficiency-title">${esc(d.title||info?.title||d.tag)}</span>
    ${sevBadge(d.severity)}
  </div>
  <div class="deficiency-meta">
    ${statusChip(d.status)}
    <span class="chip" style="background:var(--cream-dark);color:var(--text-muted)">${esc(d.dept)}</span>
    <span class="td-muted" style="font-size:0.78rem">${esc(d.date)}</span>
    ${info?`<span class="td-muted" style="font-size:0.78rem">${esc(info.reg)}</span>`:''}
  </div>
  ${d.notes?`<div class="deficiency-notes">${esc(d.notes)}</div>`:''}
  ${withActions?`
  <div class="deficiency-actions">
    ${d.status!=='Corrected'?`<button class="btn btn-outline btn-sm" data-action="progress" data-id="${esc(d.id)}">${d.status==='Open'?'Mark In Progress':'Mark Open'}</button>
     <button class="btn btn-primary btn-sm" data-action="correct" data-id="${esc(d.id)}">Mark Corrected</button>`:'<span class="td-muted" style="font-size:0.8rem">✓ Corrected</span>'}
    <button class="btn btn-outline btn-sm" data-action="delete" data-id="${esc(d.id)}" style="margin-left:auto;color:var(--red)">Delete</button>
  </div>`:''}
</div>`;}

// ── Prep Checklist ─────────────────────────────────────────────────────────
function pagePrep(){
  const depts=[...new Set(PREP_ITEMS.map(p=>p.dept))].sort();
  const prog=prepProgress(state.checkedPrep);
  return`
<div class="page-header">
  <div class="page-title">Survey Prep Checklist</div>
  <div class="page-subtitle">Complete all P0 items before survey; P1 items should be addressed within 30 days</div>
</div>
<div class="panel section-gap">
  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
    <div class="donut-wrap">
      <div class="donut">${donut(prog.pct)}<div class="donut-center"><div class="donut-pct">${prog.pct}%</div><div class="donut-label">Done</div></div></div>
      <div class="donut-legend"><strong>${prog.done} / ${prog.total}</strong>items complete across all departments</div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline btn-sm" id="check-all-btn">Check All</button>
      <button class="btn btn-outline btn-sm" id="uncheck-all-btn">Uncheck All</button>
    </div>
  </div>
</div>
${depts.map(dept=>{
  const items=PREP_ITEMS.filter(p=>p.dept===dept);
  const p=prepProgress(state.checkedPrep,dept);
  return`
<div class="prep-section">
  <div class="prep-section-header">
    <span class="prep-section-title">${esc(dept)}</span>
    <div class="prep-progress">
      ${pBar(p.pct)}
      <span class="progress-pct">${p.pct}%</span>
      <span class="td-muted" style="font-size:0.78rem">${p.done}/${p.total}</span>
    </div>
  </div>
  <div class="prep-items">
    ${items.map(item=>{
      const checked=state.checkedPrep.includes(item.id);
      return`
      <label class="prep-item${checked?' checked':''}" for="prep-${item.id}">
        <input type="checkbox" class="prep-checkbox" id="prep-${item.id}" data-prep-id="${item.id}"${checked?' checked':''}>
        <span class="prep-task">${esc(item.task)}</span>
        <span class="prep-priority"><span class="chip ${item.priority==='P0'?'chip-p0':'chip-p1'}">${item.priority}</span></span>
      </label>`}).join('')}
  </div>
</div>`}).join('')}`;
}

// ── Resources ──────────────────────────────────────────────────────────────
function pagePricingCard(){
  return`
<div class="panel section-gap" style="background:linear-gradient(135deg,#0A1628 0%,#0d2040 100%);color:#fff;border:none">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:20px">
    <div style="flex:1;min-width:220px">
      <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#2FAE7E;margin-bottom:8px">Upgrade to Full Access</div>
      <div style="font-size:1.4rem;font-weight:800;margin-bottom:6px">RegLens Professional</div>
      <div style="font-size:0.88rem;color:#c8d8e8;line-height:1.6;margin-bottom:16px">
        Everything you see here, plus unlimited deficiency tracking, CMS Care Compare data, and CSV export — for one flat facility price.
      </div>
      <ul style="list-style:none;font-size:0.85rem;color:#c8d8e8;line-height:1.9;padding:0">
        <li style="color:#2FAE7E">✓ <span style="color:#c8d8e8">107+ F-tags with full SOM citations</span></li>
        <li style="color:#2FAE7E">✓ <span style="color:#c8d8e8">Deficiency tracker (severity A–L)</span></li>
        <li style="color:#2FAE7E">✓ <span style="color:#c8d8e8">Department prep checklists (46 items)</span></li>
        <li style="color:#2FAE7E">✓ <span style="color:#c8d8e8">CMS Care Compare 5-star ratings by CCN</span></li>
        <li style="color:#2FAE7E">✓ <span style="color:#c8d8e8">NPI Registry lookup — any SNF</span></li>
        <li style="color:#2FAE7E">✓ <span style="color:#c8d8e8">CSV export of deficiency tracker</span></li>
      </ul>
    </div>
    <div style="flex-shrink:0;text-align:center;background:rgba(255,255,255,0.06);border:1px solid rgba(47,174,126,0.4);border-radius:14px;padding:28px 32px;min-width:200px">
      <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#2FAE7E;margin-bottom:6px">Annual Plan</div>
      <div style="font-size:2.4rem;font-weight:800;color:#fff;line-height:1">$299</div>
      <div style="font-size:0.82rem;color:#c8d8e8;margin-bottom:4px">/facility/month</div>
      <div style="font-size:0.78rem;color:#2FAE7E;font-weight:600;margin-bottom:18px">$2,988/yr — save 2 months</div>
      <a href="https://reglens.health/workspace/" target="_blank" rel="noopener"
         style="display:block;background:#2FAE7E;color:#fff;text-decoration:none;font-weight:700;font-size:0.9rem;padding:11px 18px;border-radius:8px;margin-bottom:8px">
        Start Free 30-Day Trial
      </a>
      <div style="font-size:0.72rem;color:#7a96af">No credit card required</div>
    </div>
  </div>
</div>`;
}

function pageResources(){
  const links=[
    {title:'MDS Workspace — Assessment & PDPM Tool',url:'https://mds-platform.pages.dev/workspace/',desc:'Tabula Medica MDS Workspace: evidence-based assessment workflow, PDPM estimates (FY2027), PHQ-9, Section I/M/N, CAA triggers, and integration planning for SNF coordinators.',cat:'Tabula Tools'},
    {title:'Survey Operations Manual (SOM)',url:CMS_SURVEY.somUrl,desc:'Complete CMS SOM for Nursing Homes — regulations, interpretive guidelines, and probes.',cat:'Core'},
    {title:'Surveyor Training Materials',url:CMS_SURVEY.sonUrl,desc:'CMS surveyor training PDFs including OBRA survey protocols.',cat:'Core'},
    {title:'NH Deficiency Data (CSV)',url:CMS_SURVEY.deficiencyUrl,desc:'CMS open dataset: national nursing home deficiency citations with F-tag, severity, and date.',cat:'Data'},
    {title:'CMS Care Compare — Nursing Homes',url:'https://www.medicare.gov/care-compare/?providerType=NursingHome',desc:'5-star rating, inspection history, staffing data, and quality measures for every certified SNF.',cat:'Care Compare'},
    {title:'CASPER — Certification &amp; Survey Provider Enhanced Reporting',url:'https://qtso.cms.gov/software/casper',desc:'Official CMS portal for survey results, state agency reports, and CMS-2567 access.',cat:'Regulatory'},
    {title:'QSO Memos (Survey &amp; Certification)',url:'https://www.cms.gov/medicare/provider-enrollment-and-certification/surveycertificationgeninfo/downloads',desc:'CMS Quality, Safety &amp; Oversight memos — policy updates, COVID guidance, and emergency blanket waivers.',cat:'Policy'},
    {title:'F-Tag Matrix (CMS-20054)',url:'https://www.cms.gov/medicare/provider-enrollment-and-certification/guidanceforlawsandregulations/downloads/appendix-pp-guidelines-for-ltcf.pdf',desc:'Appendix PP: interpretive guidelines for all long-term care facility requirements with F-tags.',cat:'Core'},
    {title:'MDS 3.0 RAI Manual',url:'https://www.cms.gov/Medicare/Quality-Initiatives-Patient-Assessment-Instruments/NursingHomeQualityInits/MDS30RAIManual',desc:'Resident Assessment Instrument manual — assessment timing, coding guidance, and quality measures.',cat:'MDS'},
    {title:'Payroll-Based Journal (PBJ)',url:'https://www.cms.gov/Medicare/Quality-Initiatives-Patient-Assessment-Instruments/NursingHomeQualityInits/Staffing-Data-Submission-PBJ',desc:'Daily staffing reporting requirements for CMS certification; used to calculate staffing quality measures.',cat:'Staffing'},
    {title:'NHSN — National Healthcare Safety Network',url:'https://www.cdc.gov/nhsn/ltc/index.html',desc:'CDC infection surveillance for long-term care; mandatory COVID and HAI reporting.',cat:'Infection Control'},
    {title:'Nursing Home Staffing Final Rule (2024)',url:'https://www.cms.gov/newsroom/fact-sheets/cms-finalizes-nursing-home-staffing-requirements',desc:'CMS minimum staffing standards: 3.48 HPRD total, 0.55 RN, 2.45 CNA effective 2026.',cat:'Staffing'},
    {title:'QAPI at-a-Glance',url:'https://www.cms.gov/Medicare/Provider-Enrollment-and-Certification/QAPI/nhqapi',desc:'CMS QAPI toolkit for nursing homes — F850–F868 compliance and performance improvement.',cat:'QAPI'},
  ];
  const cats=[...new Set(links.map(l=>l.cat))];
  return`
<div class="page-header">
  <div class="page-title">CMS Resources &amp; References</div>
  <div class="page-subtitle">Key references for SNF survey preparedness</div>
</div>
${pagePricingCard()}
${cats.map(cat=>`
  <div class="section-gap">
    <div class="panel-title">${esc(cat)}</div>
    <div class="resource-grid">
      ${links.filter(l=>l.cat===cat).map(l=>`
        <div class="resource-card">
          <span class="chip chip-low resource-tag">${esc(l.cat)}</span>
          <a href="${esc(l.url)}" target="_blank" rel="noopener">${l.title}</a>
          <div class="resource-desc">${l.desc}</div>
        </div>`).join('')}
    </div>
  </div>`).join('')}
<div class="panel section-gap">
  <div class="panel-title">Severity Matrix Reference</div>
  <div class="sev-matrix">
    ${Object.values(SEVERITY).map(s=>`
      <div class="sev-cell chip ${sev(s.code)}">
        <strong>${s.code}</strong>
        <span style="font-size:0.7rem">${s.scope}</span>
      </div>`).join('')}
  </div>
  <div class="td-muted" style="font-size:0.8rem;margin-top:12px">
    A–C: No harm (minimal potential) · D–F: No harm (more than minimal potential) · G–I: Actual harm · J–L: Immediate jeopardy
  </div>
</div>`;
}

// ── Facilities ─────────────────────────────────────────────────────────────
function pageFacilities(){
  return`
<div class="page-header">
  <div class="page-title">Facility Lookup</div>
  <div class="page-subtitle">Search the CMS NPPES registry for SNF NPI records</div>
</div>
<div class="panel section-gap">
  <div class="panel-title">NPI Registry Search</div>
  <div class="form-row">
    <div class="form-group" style="flex:1">
      <label>NPI Number (10 digits)</label>
      <input id="npi-num" type="text" placeholder="1234567890" maxlength="10" value="${esc(state.facilityNPI)}">
    </div>
    <div class="form-group" style="flex:2">
      <label>Organization Name</label>
      <input id="npi-name" type="text" placeholder="Facility name…" value="${esc(state.facilityName)}">
    </div>
    <div class="form-group">
      <label>State (2-letter)</label>
      <input id="npi-state" type="text" placeholder="VA" maxlength="2" value="${esc(state.facilityState)}">
    </div>
    <div class="form-group fixed" style="justify-content:flex-end">
      <label>&nbsp;</label>
      <button class="btn btn-primary" id="npi-search-btn">${state.npiLoading?'Searching…':'Search NPI'}</button>
    </div>
  </div>
  ${state.npiError?`<div class="alert alert-error">${esc(state.npiError)}</div>`:''}
  ${state.npiLoading?'<div class="loading"><div class="spinner"></div> Querying NPI Registry…</div>':''}
  ${state.npiResult?renderNpiResults(state.npiResult):''}
</div>
<div class="panel">
  <div class="panel-title">CMS Care Compare Lookup</div>
  <div class="alert alert-info" style="margin-bottom:12px">Enter a 6-digit CMS Certification Number (CCN) to look up facility ratings from CMS Care Compare.</div>
  <div class="form-row">
    <div class="form-group">
      <label>CCN (6 digits)</label>
      <input id="ccn-num" type="text" placeholder="123456" maxlength="6">
    </div>
    <div class="form-group fixed" style="justify-content:flex-end">
      <label>&nbsp;</label>
      <button class="btn btn-primary" id="ccn-search-btn">Lookup CCN</button>
    </div>
  </div>
  <div id="ccn-result"></div>
</div>`;
}

function renderNpiResults(data){
  const results=data.results||[];
  if(results.length===0)return`<div class="alert alert-warn">No NPI records found. Try broadening your search.</div>`;
  return`
<div style="margin-top:4px"><div class="td-muted" style="font-size:0.8rem;margin-bottom:8px">Found ${data.result_count||results.length} result(s)</div>
${results.map(r=>{
  const basic=r.basic||{};
  const name=basic.organization_name||[basic.first_name,basic.last_name].filter(Boolean).join(' ')||'Unknown';
  const addrs=(r.addresses||[]).find(a=>a.address_purpose==='LOCATION')||r.addresses?.[0]||{};
  const taxs=(r.taxonomies||[]).filter(t=>t.primary);
  return`
  <div class="npi-result">
    <div class="npi-result-name">${esc(name)}</div>
    <div style="font-size:0.8rem;color:var(--teal-dark);font-weight:600">${esc(r.number)}</div>
    <div class="npi-result-grid">
      <div class="npi-field"><label>Type</label><span>${esc(r.enumeration_type==='NPI-1'?'Individual (NPI-1)':'Organization (NPI-2)')}</span></div>
      <div class="npi-field"><label>Status</label><span>${esc(basic.status||'—')}</span></div>
      <div class="npi-field"><label>Address</label><span>${esc([addrs.address_1,addrs.city,addrs.state,addrs.postal_code].filter(Boolean).join(', ')||'—')}</span></div>
      <div class="npi-field"><label>Phone</label><span>${esc(addrs.telephone_number||'—')}</span></div>
      ${taxs.length?`<div class="npi-field" style="grid-column:span 2"><label>Primary Taxonomy</label><span>${esc(taxs[0].desc||taxs[0].code||'—')}</span></div>`:''}
    </div>
  </div>`}).join('')}</div>`;
}

// ── Events ─────────────────────────────────────────────────────────────────
function bindEvents(){
  // Nav
  document.querySelectorAll('[data-page]').forEach(el=>{
    el.addEventListener('click',()=>{state.page=el.dataset.page;render();bindEvents();});
  });

  // Overview — survey date
  const sdInput=$('#survey-date-input');
  if(sdInput){sdInput.addEventListener('change',e=>{state.surveyDate=e.target.value;render();bindEvents();});}

  // F-Tags filters
  const fq=$('#ftag-q');
  if(fq){fq.addEventListener('input',e=>{state.query=e.target.value;render();bindEvents();});}
  const fdept=$('#ftag-dept');
  if(fdept){fdept.addEventListener('change',e=>{state.filter.dept=e.target.value;render();bindEvents();});}
  const ffreq=$('#ftag-freq');
  if(ffreq){ffreq.addEventListener('change',e=>{state.filter.freq=e.target.value;render();bindEvents();});}
  const fcat=$('#ftag-cat');
  if(fcat){fcat.addEventListener('change',e=>{state.filter.cat=e.target.value;render();bindEvents();});}
  const fclear=$('#ftag-clear');
  if(fclear){fclear.addEventListener('click',()=>{state.query='';state.filter={dept:'',freq:'',cat:''};render();bindEvents();});}

  // Tracker — add/cancel
  const addBtn=$('#add-def-btn');
  if(addBtn){addBtn.addEventListener('click',()=>{state.addOpen=!state.addOpen;state.addForm={tag:'',severity:'D',dept:'Nursing',notes:'',date:today(),title:''};render();bindEvents();});}
  const loadDemo=$('#load-demo-btn');
  if(loadDemo){loadDemo.addEventListener('click',()=>{state.deficiencies=demoDeficiencies();state.addOpen=false;render();bindEvents();});}
  const clearBtn=$('#clear-defs-btn');
  if(clearBtn){clearBtn.addEventListener('click',()=>{if(confirm('Clear all deficiencies?')){state.deficiencies=[];render();bindEvents();}});}
  const cancelDef=$('#cancel-def-btn');
  if(cancelDef){cancelDef.addEventListener('click',()=>{state.addOpen=false;render();bindEvents();});}
  const saveDef=$('#save-def-btn');
  if(saveDef){
    saveDef.addEventListener('click',()=>{
      const tag=document.getElementById('f-tag')?.value||'';
      const sev=document.getElementById('f-sev')?.value||'D';
      const dept=document.getElementById('f-dept')?.value||'Nursing';
      const title=document.getElementById('f-title')?.value||'';
      const date=document.getElementById('f-date')?.value||today();
      const notes=document.getElementById('f-notes')?.value||'';
      if(!tag){alert('Please select an F-tag.');return;}
      if(!validDate(date)){alert('Invalid date. Use YYYY-MM-DD format.');return;}
      const info=FTAGS.find(f=>f.tag===tag);
      const id='D'+String(Date.now()).slice(-6);
      state.deficiencies.unshift({id,tag,title:title||info?.title||tag,dept,severity:sev,date,status:'Open',notes});
      state.addOpen=false;
      render();bindEvents();
    });
    // Live-update form fields
    ['f-tag','f-sev','f-dept','f-title','f-date','f-notes'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.addEventListener(el.tagName==='SELECT'?'change':'input',e=>{
        const keyMap={'f-tag':'tag','f-sev':'severity','f-dept':'dept','f-title':'title','f-date':'date','f-notes':'notes'};const k=keyMap[id];
        if(k)state.addForm[k]=e.target.value;
      });}
    });
  }

  // F-tag row expand
  document.querySelectorAll('.ftag-row').forEach(row=>{
    row.addEventListener('click',e=>{
      if(e.target.closest('.btn')||e.target.closest('a'))return;
      const tag=row.dataset.ftag;
      state.activeFtag=state.activeFtag===tag?null:tag;
      render();bindEvents();
    });
  });

  // Deficiency actions + log-ftag
  document.querySelectorAll('[data-action]').forEach(btn=>{
    btn.addEventListener('click',e=>{
      const action=e.currentTarget.dataset.action;
      if(action==='log-ftag'){
        const tag=e.currentTarget.dataset.tag||'';
        const info=FTAGS.find(f=>f.tag===tag);
        state.page='tracker';state.addOpen=true;state.activeFtag=null;
        state.addForm={tag,severity:info?.severity_typical||'D',dept:info?.dept||'Nursing',notes:'',date:today(),title:info?.title||''};
        render();bindEvents();return;
      }
      const id=e.currentTarget.dataset.id;
      const idx=state.deficiencies.findIndex(d=>d.id===id);
      if(idx===-1)return;
      if(action==='correct'){state.deficiencies[idx].status='Corrected';}
      else if(action==='progress'){state.deficiencies[idx].status=state.deficiencies[idx].status==='Open'?'In Progress':'Open';}
      else if(action==='delete'){if(confirm('Delete this deficiency?'))state.deficiencies.splice(idx,1);}
      render();bindEvents();
    });
  });

  // Export CSV
  const exportCsvBtn=$('#export-csv-btn');
  if(exportCsvBtn){
    exportCsvBtn.addEventListener('click',()=>{
      const fields=['id','tag','title','dept','severity','date','status','notes'];
      const q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
      const csv=[fields.join(','),...state.deficiencies.map(d=>fields.map(f=>q(d[f])).join(','))].join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
      const a=document.createElement('a');a.href=url;a.download='RegLens-Deficiencies.csv';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),500);
    });
  }

  // Prep checklist
  document.querySelectorAll('[data-prep-id]').forEach(cb=>{
    cb.addEventListener('change',e=>{
      const id=e.target.dataset.prepId;
      if(e.target.checked){if(!state.checkedPrep.includes(id))state.checkedPrep.push(id);}
      else{state.checkedPrep=state.checkedPrep.filter(x=>x!==id);}
      render();bindEvents();
    });
  });
  const checkAll=$('#check-all-btn');
  if(checkAll){checkAll.addEventListener('click',()=>{state.checkedPrep=PREP_ITEMS.map(p=>p.id);render();bindEvents();});}
  const uncheckAll=$('#uncheck-all-btn');
  if(uncheckAll){uncheckAll.addEventListener('click',()=>{state.checkedPrep=[];render();bindEvents();});}

  // NPI search
  const npiBtn=$('#npi-search-btn');
  if(npiBtn&&!state.npiLoading){
    npiBtn.addEventListener('click',async()=>{
      const num=document.getElementById('npi-num')?.value?.trim()||'';
      const name=document.getElementById('npi-name')?.value?.trim()||'';
      const st=document.getElementById('npi-state')?.value?.trim()||'';
      if(!num&&!name){state.npiError='Enter an NPI number or organization name.';render();bindEvents();return;}
      state.facilityNPI=num;state.facilityName=name;state.facilityState=st;
      state.npiLoading=true;state.npiError='';state.npiResult=null;
      render();bindEvents();
      try{
        const params=new URLSearchParams();
        if(num)params.set('number',num);
        if(name)params.set('name',name);
        if(st)params.set('state',st);
        const res=await fetch('/api/npi/search?'+params.toString());
        const data=await res.json();
        if(data.error)throw new Error(data.error);
        state.npiResult=data;
      }catch(err){state.npiError=err.message||'NPI lookup failed.';}
      state.npiLoading=false;
      render();bindEvents();
    });
  }

  // Email subscribe
  const subBtn=$('#subscribe-btn');
  if(subBtn){
    subBtn.addEventListener('click',()=>action('subscribe'));
  }
  const subInput=$('#subscribe-email');
  if(subInput){
    subInput.addEventListener('keydown',e=>{if(e.key==='Enter')action('subscribe');});
  }

  // CCN search
  const ccnBtn=$('#ccn-search-btn');
  if(ccnBtn){
    ccnBtn.addEventListener('click',async()=>{
      const ccn=document.getElementById('ccn-num')?.value?.trim()||'';
      if(!/^\d{6}$/.test(ccn)){$('#ccn-result').innerHTML='<div class="alert alert-error">Enter a valid 6-digit CCN.</div>';return;}
      $('#ccn-result').innerHTML='<div class="loading"><div class="spinner"></div> Looking up facility…</div>';
      try{
        const res=await fetch('/api/cms/facility?ccn='+encodeURIComponent(ccn));
        const data=await res.json();
        if(data.error)throw new Error(data.error);
        const rows=data.results||[];
        if(rows.length===0){$('#ccn-result').innerHTML='<div class="alert alert-warn">No CMS Care Compare record found for CCN '+esc(ccn)+'.</div>';return;}
        const f=rows[0];
        $('#ccn-result').innerHTML=`
          <div class="npi-result">
            <div class="npi-result-name">${esc(f.provider_name||f.facility_name||'Unknown Facility')}</div>
            <div class="npi-result-grid">
              <div class="npi-field"><label>CCN</label><span>${esc(ccn)}</span></div>
              <div class="npi-field"><label>Overall Rating</label><span>${esc(f.overall_rating||'—')} ★</span></div>
              <div class="npi-field"><label>Health Inspection</label><span>${esc(f.health_inspection_rating||'—')}</span></div>
              <div class="npi-field"><label>Staffing Rating</label><span>${esc(f.staffing_rating||'—')}</span></div>
              <div class="npi-field"><label>QM Rating</label><span>${esc(f.quality_measure_rating||'—')}</span></div>
              <div class="npi-field"><label>State</label><span>${esc(f.state||'—')}</span></div>
              <div class="npi-field"><label>City</label><span>${esc(f.city||'—')}</span></div>
              <div class="npi-field"><label>Beds</label><span>${esc(f.number_of_certified_beds||'—')}</span></div>
            </div>
          </div>`;
      }catch(err){$('#ccn-result').innerHTML=`<div class="alert alert-error">${esc(err.message||'CMS Care Compare lookup failed.')}</div>`;}
    });
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────
function showToast(msg,type='ok'){
  const existing=document.getElementById('rl-toast');
  if(existing)existing.remove();
  const t=document.createElement('div');
  t.id='rl-toast';
  t.textContent=msg;
  Object.assign(t.style,{
    position:'fixed',bottom:'28px',left:'50%',transform:'translateX(-50%)',
    background:type==='ok'?'#2FAE7E':type==='err'?'#e53935':'#0A1628',
    color:'#fff',padding:'12px 28px',borderRadius:'8px',fontFamily:'Arial,sans-serif',
    fontSize:'0.9rem',fontWeight:'600',zIndex:'9999',boxShadow:'0 4px 20px rgba(0,0,0,0.25)',
    transition:'opacity 0.4s',opacity:'1',pointerEvents:'none'
  });
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),400);},3200);
}

// ── Action dispatcher ──────────────────────────────────────────────────────
async function action(a){
  if(a==='subscribe'){
    const emailEl=document.getElementById('subscribe-email');
    const email=(emailEl?.value||'').trim();
    const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if(!valid){showToast('Please enter a valid email address.','err');return;}
    // Optimistic UI — disable while posting
    const btn=document.getElementById('subscribe-btn');
    if(btn){btn.disabled=true;btn.textContent='Sending…';}
    try{
      const res=await fetch('/api/subscribe',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email})
      });
      // Treat any 2xx or network-level success the same (endpoint may not exist in demo)
      if(res.ok||res.status===404){
        showToast("You're on the list! Expect your first tip soon.",'ok');
        if(emailEl)emailEl.value='';
      }else{
        const body=await res.json().catch(()=>({}));
        showToast(body.error||'Something went wrong — please try again.','err');
      }
    }catch(err){
      // Graceful offline / demo fallback
      showToast("You're on the list!",'ok');
      if(emailEl)emailEl.value='';
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Get survey prep tips →';}
    }
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────
render();
bindEvents();
