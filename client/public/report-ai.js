/*!
 * report-ai.js — a tiny, dependency-free "Report AI content" control.
 *
 * Satisfies Google Play's July 2026 User-Data / generative-AI clarification:
 * users must be able to report/flag AI-generated content. Drop this on any page
 * that surfaces AI features (PHR, EHR, SAWD, Uninsurance, Underinsured, Cognita,
 * Attentiva, Healonda). No framework, no backend required — on submit it opens a
 * prefilled email to your support address (swap to a POST endpoint later if you
 * want server capture).
 *
 * USAGE (one line, before </body>):
 *   <script src="/report-ai.js" data-support-email="support@uninsurance.care"
 *           data-app="Uninsurance"></script>
 *
 * Or set window.REPORT_AI_CONFIG = { supportEmail, appName, endpoint } before load.
 */
(function () {
  "use strict";
  var s = document.currentScript;
  var cfg = window.REPORT_AI_CONFIG || {};
  var EMAIL = cfg.supportEmail || (s && s.getAttribute("data-support-email")) || "support@tabulamedica.com";
  var APP = cfg.appName || (s && s.getAttribute("data-app")) || document.title || "App";
  var ENDPOINT = cfg.endpoint || (s && s.getAttribute("data-endpoint")) || ""; // optional POST url

  var css = ""
    + "#raiBtn{position:fixed;left:12px;bottom:12px;z-index:2147483000;font:600 12px/1 -apple-system,Segoe UI,Roboto,sans-serif;"
    + "background:#fff;color:#334155;border:1px solid #cbd5e1;border-radius:999px;padding:8px 12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12)}"
    + "#raiBtn:hover{background:#f8fafc}"
    + "#raiOv{position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.5);display:none;align-items:center;justify-content:center;padding:16px}"
    + "#raiBox{background:#fff;max-width:440px;width:100%;border-radius:14px;padding:18px;font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a2230}"
    + "#raiBox h2{font-size:16px;margin:0 0 6px}#raiBox p{color:#64748b;margin:0 0 12px}"
    + "#raiBox textarea{width:100%;min-height:90px;border:1px solid #cbd5e1;border-radius:8px;padding:10px;font:inherit}"
    + "#raiBox .raiRow{display:flex;gap:8px;margin-top:12px}#raiBox button{flex:1;min-height:40px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;cursor:pointer}"
    + "#raiBox .raiGo{background:#0f766e;color:#fff;border-color:#0f766e}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function el(html){ var d=document.createElement("div"); d.innerHTML=html; return d.firstElementChild; }
  var btn = el('<button id="raiBtn" type="button" aria-label="Report AI-generated content">⚠ Report AI content</button>');
  var ov = el('<div id="raiOv" role="dialog" aria-modal="true"><div id="raiBox">'
    + '<h2>Report AI-generated content</h2>'
    + '<p>Tell us what was wrong, offensive, or inaccurate about the AI response. This helps us improve and keep it safe.</p>'
    + '<textarea id="raiTxt" placeholder="Describe the problem…"></textarea>'
    + '<div class="raiRow"><button type="button" id="raiCancel">Cancel</button>'
    + '<button type="button" id="raiSend" class="raiGo">Send report</button></div></div></div>');
  document.body.appendChild(btn); document.body.appendChild(ov);

  function open(){ ov.style.display="flex"; document.getElementById("raiTxt").focus(); }
  function close(){ ov.style.display="none"; }
  btn.addEventListener("click", open);
  ov.addEventListener("click", function(e){ if(e.target===ov) close(); });
  document.getElementById("raiCancel").addEventListener("click", close);

  document.getElementById("raiSend").addEventListener("click", function(){
    var txt = (document.getElementById("raiTxt").value || "").trim();
    var meta = "App: "+APP+"\nPage: "+location.href+"\nWhen: "+new Date().toISOString();
    if (ENDPOINT) {
      try {
        fetch(ENDPOINT, {method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({app:APP,url:location.href,report:txt,ts:Date.now()})});
      } catch(e){}
    } else {
      var subj = encodeURIComponent("Report AI content — "+APP);
      var body = encodeURIComponent(txt+"\n\n—\n"+meta);
      window.location.href = "mailto:"+EMAIL+"?subject="+subj+"&body="+body;
    }
    close();
    var t = el('<div id="raiBtn" style="left:auto;right:12px">✓ Report sent — thank you</div>');
    document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 3500);
  });
})();
