/* PWA */
let deferredPrompt; const installBtn=document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;installBtn.hidden=false;});
installBtn?.addEventListener('click',async()=>{installBtn.hidden=true;await deferredPrompt.prompt();deferredPrompt=null;});
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js');}

/* Tabs */
document.querySelectorAll('.tabs button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('main .tab').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active');
  });
});
const $ = (id)=>document.getElementById(id);

/* Helpers */
function linReg(x,y){
  const n=x.length; const sx=x.reduce((a,b)=>a+b,0), sy=y.reduce((a,b)=>a+b,0);
  const sxx=x.reduce((a,b)=>a+b*b,0), sxy=x.reduce((a,b,i)=>a+b*y[i],0);
  const d=n*sxx-sx*sx; if(d===0) return {m:NaN,q:NaN,r2:0,ssres:Infinity};
  const m=(n*sxy-sx*sy)/d, q=(sy-m*sx)/n; const yhat=x.map((xi,i)=>m*xi+q);
  const ssres=y.reduce((a,yi,i)=>a+Math.pow(yi-yhat[i],2),0), sstot=y.reduce((a,yi)=>a+Math.pow(yi-sy/n,2),0);
  return {m,q,r2:1-ssres/sstot,ssres,yhat};
}
/* Validation */
function reqNum(val, name){ if(!isFinite(val)){ throw new Error(`${name}: valore mancante/non numerico`); } return val; }
function reqPos(val, name){ if(!isFinite(val) || val<=0){ throw new Error(`${name}: inserire un valore > 0`); } return val; }
function guard(cond, msg){ if(!cond) throw new Error(msg); }
function showError(elId, err){ const box=document.getElementById(elId); if(!box) return; box.innerHTML = `<p style="color:#ff8a8a">⚠️ ${err.message||err}</p>`; }

/* ===== Watt: suggeritore protocollo ===== */
function suggestProtocol(){
  const mode=$('w_mode').value, prof=$('w_profile').value;
  let t=+$('w_target').value||10, vo2pk=+$('w_vo2pk').value||NaN, start=+$('w_start').value||20, inc=+$('w_inc').value||15;
  const gain=+$('w_gain').value||10;
  if(prof==='HF'){ inc=Math.max(5, Math.round(0.7*inc)); }
  if(prof==='BPCO'){ inc=Math.max(5, Math.round(0.8*inc)); }
  if(prof==='Anziano'){ inc=Math.max(5, Math.round(0.8*inc)); }
  if(prof==='Atleta'){ inc=Math.round(1.2*inc); start+=20; }
  let txt=''; let endW=start;
  if(mode==='ramp'){
    if(!isFinite(vo2pk)) vo2pk = 250 + 10*7 + (t-8)*80;
    const targetW = start + Math.round((vo2pk-250)/gain);
    const steps=Math.max(8,Math.round(t));
    inc = Math.max(5, Math.round((targetW-start)/steps/5)*5);
    endW = start + inc*steps;
    txt = `Rampa: +${inc} W/min da ${start} W → fine stimata ${endW} W (≈ ${vo2pk|0} mL/min)`;
  }else if(mode==='step'){
    const stepMin=+$('w_stepmin').value||2;
    const nSteps=Math.max(3, Math.round(t/stepMin));
    inc = Math.max(5, inc);
    endW = start + inc*(nSteps-1);
    txt = `Step: ${nSteps} × ${stepMin}' — incrementi +${inc} W, start ${start} W → ultimo ${endW} W`;
  }else if(mode==='constant'){
    endW = start;
    txt = `Carico costante: ${start} W per ${t} min (monitorare HR/RPE).`;
  }else if(mode==='monark'){
    txt = `Monark: usa il convertitore sotto per tarare kgf↔W a rpm costante.`;
  }
  $('w_out').innerHTML = `<p>${txt}</p>`;
}
$('w_suggest').addEventListener('click', suggestProtocol);
$('w_adjust').addEventListener('click', ()=>{
  const hr=+prompt('HR attuale (bpm)?')||NaN;
  const rpe=+prompt('RPE Borg 6–20 attuale?')||NaN;
  let inc=+$('w_inc').value||15;
  if(isFinite(hr)&&hr>0){ if(hr<110) inc+=5; if(hr>150) inc=Math.max(5,inc-5); }
  if(isFinite(rpe)&&rpe>0){ if(rpe<11) inc+=5; if(rpe>15) inc=Math.max(5,inc-5); }
  $('w_inc').value=inc;
  suggestProtocol();
});
/* Monark converter */
$('m_from_kgf').addEventListener('click',()=>{
  const rpm=+$('m_rpm').value||60, kgf=+$('m_kgf').value||0;
  const w=6.12*rpm*kgf; $('m_w').value=Math.round(w);
  $('m_out').innerHTML=`<p>W = 6.12 × ${kgf} × ${rpm} ≈ <b>${Math.round(w)} W</b></p>`;
});
$('m_from_w').addEventListener('click',()=>{
  const rpm=+$('m_rpm').value||60, w=+$('m_w').value||0;
  const kgf=w/(6.12*rpm); $('m_kgf').value=kgf.toFixed(2);
  $('m_out').innerHTML=`<p>kgf ≈ <b>${kgf.toFixed(2)}</b> (a ${rpm} rpm)</p>`;
});
/* ΔVO2/ΔWR & efficiency */
$('effBtn').addEventListener('click',()=>{
  try{
    const rows=($('effData').value||'').trim().split(/\r?\n/).map(r=>r.split(',').map(s=>s.trim()));
    const pts=rows.map(r=>({W:+r[0],VO2:+r[1]})).filter(p=>isFinite(p.W)&&isFinite(p.VO2)&&p.W>0&&p.VO2>0);
    guard(pts.length>=2,'Servono almeno 2 coppie W–VO₂ (>0).');
    const xs=pts.map(p=>p.W), ys=pts.map(p=>p.VO2);
    const reg=linReg(xs, ys);
    guard(isFinite(reg.m)&&isFinite(reg.r2),'Regressione non valida.');
    const slope=reg.m, R2=reg.r2;
    const last=pts[pts.length-1];
    const GE_FACTOR = 6000/20.9; // ≈287.0
    const gross = (last.W*GE_FACTOR)/last.VO2; // %
    guard(isFinite(gross),'Dati non idonei per efficiency.');
    $('effOut').innerHTML=`<p>ΔVO₂/ΔWR = <b>${slope.toFixed(1)}</b> mL·min⁻¹·W⁻¹ (R²=${R2.toFixed(2)}) • Gross efficiency ≈ <b>${gross.toFixed(1)}%</b></p>`;
  }catch(e){ showError('effOut',e); }
});
/* CP/W' from 2 TTEs */
$('cp_calc').addEventListener('click',()=>{
  try{
    const W1=+$('cp_w1').value, t1=+$('cp_t1').value, W2=+$('cp_w2').value, t2=+$('cp_t2').value;
    reqPos(W1,'Potenza 1'); reqPos(W2,'Potenza 2'); reqPos(t1,'Tempo 1'); reqPos(t2,'Tempo 2');
    guard(Math.abs(t2-t1)>1e-6,'I tempi non possono essere identici.');
    const Wp = (W1 - W2) * t1 * t2 / (t2 - t1);
    guard(isFinite(Wp)&&Wp>0,'W′ non positivo: controllare dati (W2 deve essere > W1 e t2 < t1).');
    const CP = W1 - Wp/t1;
    guard(isFinite(CP)&&CP>0,'CP non valido: rivedere i dati.');
    $('cp_out').innerHTML = `<p>CP ≈ <b>${CP.toFixed(0)} W</b> • W′ ≈ <b>${Wp.toFixed(0)} J</b></p>
    <p class="hint">Usa CP per definire carichi sostenibili e W′ per intervalli sopra CP.</p>`;
  }catch(e){ showError('cp_out', e); }
});
/* Safety */
$('sf_check').addEventListener('click',()=>{
  const sys=+$('sf_sys').value||NaN, spo=+$('sf_spo2').value||NaN, hr=+$('sf_hr').value||NaN, rpe=+$('sf_rpe').value||NaN;
  const flags=[];
  if(isFinite(sys)&& (sys>220||sys<90)) flags.push(`<span class="badge bad">PA sistolica fuori range</span>`);
  if(isFinite(spo)&& (spo<88)) flags.push(`<span class="badge bad">SpO₂ &lt; 88%</span>`);
  if(isFinite(hr)&& (hr>190)) flags.push(`<span class="badge warn">HR molto alta</span>`);
  if(isFinite(rpe)&& (rpe>=17)) flags.push(`<span class="badge warn">RPE ≥ 17</span>`);
  $('sf_out').innerHTML = flags.length? flags.join(' ') : '<p>OK: nessun flag critico.</p>';
});

/* ===== Spirometria ===== */
function pct(meas, pred){ return (isFinite(meas)&&isFinite(pred)&&pred>0)? 100*meas/pred : NaN; }
function classifySpiro(FEV1, FVC, ratioPct, predF1, predFVC, ratioLLN){
  const fev1pct = pct(FEV1, predF1), fvcpct = pct(FVC, predFVC);
  const ratioAbn = isFinite(ratioLLN) ? (ratioPct < ratioLLN) : (ratioPct < 70);
  let pattern = 'Normale', sev = '';
  if(ratioAbn && isFinite(fev1pct)){
    pattern = 'Ostruttivo';
    if(fev1pct < 50) sev = 'severo'; else if(fev1pct < 80) sev = 'moderato'; else sev = 'lieve';
  } else if(!ratioAbn && isFinite(fvcpct) && fvcpct < 80){
    pattern = 'Restrittivo (sospetto)';
  }
  if(ratioAbn && isFinite(fvcpct) && fvcpct < 80){
    pattern = 'Misto';
  }
  return {fev1pct, fvcpct, ratioAbn, pattern, sev};
}
document.getElementById('sp_calc').addEventListener('click', ()=>{
  try{
    const FVC = +$('sp_fvc').value, FEV1 = +$('sp_fev1').value;
    if(!isFinite(FVC) || !isFinite(FEV1) || FVC<=0 || FEV1<=0) throw new Error('Inserisci FVC e FEV₁.');
    let ratio = +$('sp_ratio').value;
    if(!isFinite(ratio) || ratio<=0) ratio = 100*FEV1/FVC;
    const MVV = +$('sp_mvv').value;
    const F1p = +$('sp_fev1_pred').value, FVCp = +$('sp_fvc_pred').value;
    const LLN = +$('sp_ratio_lln').value || 70;
    const res = classifySpiro(FEV1, FVC, ratio, F1p, FVCp, LLN);
    const MVVest = 40*FEV1;
    const mvvStr = isFinite(MVV)? `${MVV.toFixed(0)} L/min (mis.)` : `${MVVest.toFixed(0)} L/min (stim. 40×FEV₁)`;
    let rows = [];
    rows.push(`<span class="badge ${res.ratioAbn?'bad':'ok'}">FEV₁/FVC: <b>${ratio.toFixed(1)}%</b> (LLN ${LLN}%)</span>`);
    rows.push(`<span class="badge">FEV₁ %pred: <b>${isFinite(res.fev1pct)? res.fev1pct.toFixed(0)+'%':'—'}</b></span>`);
    rows.push(`<span class="badge">FVC %pred: <b>${isFinite(res.fvcpct)? res.fvcpct.toFixed(0)+'%':'—'}</b></span>`);
    rows.push(`<span class="badge">MVV: <b>${mvvStr}</b></span>`);
    const label = res.pattern + (res.sev? ' — ' + res.sev : '');
    rows.push(`<p><b>Pattern:</b> ${label}</p>`);
    $('sp_out').innerHTML = rows.join(' ');
  }catch(e){ showError('sp_out', e); }
});
document.getElementById('sp_to_cpet').addEventListener('click', ()=>{
  const FEV1 = +$('sp_fev1').value;
  if(isFinite(FEV1) && FEV1>0){
    const fevEl = document.getElementById('c_fev1');
    if(fevEl){ fevEl.value = FEV1; alert('FEV₁ inviato al modulo CPET.'); }
  } else {
    alert('Inserisci un FEV₁ valido prima di inviare.');
  }
});

/* ===== CPET quick: BR% & badge ===== */
let VEmax_cache = NaN;
$('c_calc').addEventListener('click',()=>{
  const FEV1=+$('c_fev1').value||NaN, VO2=+$('c_vo2peak').value||NaN, slope=+$('c_slope').value||NaN, oues=+$('c_oues').value||NaN, vo2kg=+$('c_vo2kg').value||NaN, HR=+$('c_hr').value||NaN;
  const MVV = isFinite(FEV1)? 40*FEV1 : NaN;
  const VEmax = isFinite(VEmax_cache)? VEmax_cache : (isFinite(MVV)? 0.8*MVV : NaN);
  const BR = (isFinite(MVV)&&isFinite(VEmax))? 100*(1-VEmax/MVV) : NaN;
  const badges=[];
  if(isFinite(BR)){ const cls=BR<10?'bad':(BR<20?'warn':'ok'); badges.push(`<span class="badge ${cls}">BR%: <b>${BR.toFixed(0)}%</b></span>`); }
  if(isFinite(slope)){ const cls=slope>=40?'bad':(slope>=36?'warn':'ok'); badges.push(`<span class="badge ${cls}">VE/VCO₂ slope: <b>${slope.toFixed(1)}</b></span>`); }
  if(isFinite(oues)){ const cls=oues<1.4?'warn':'ok'; badges.push(`<span class="badge ${cls}">OUES: <b>${oues.toFixed(2)}</b></span>`); }
  if(isFinite(vo2kg)){ const cls=vo2kg<14?'bad':(vo2kg<18?'warn':'ok'); badges.push(`<span class="badge ${cls}">VO₂/kg: <b>${vo2kg.toFixed(1)}</b></span>`); }
  $('c_out').innerHTML = badges.join(' ');
});

/* Prognosi educational */
$('pr_calc').addEventListener('click',()=>{
  const vo2kg= +$('pr_vo2kg').value || NaN, slope= +$('pr_slope').value || NaN, hrr= +$('pr_hrr').value || NaN;
  const parts=[];
  if(isFinite(vo2kg)){ let c='ok', lab='alto'; if(vo2kg<14){c='bad'; lab='basso';} else if(vo2kg<18){c='warn'; lab='intermedio';} parts.push(`<span class="badge ${c}">VO₂/kg: <b>${vo2kg.toFixed(1)}</b> (${lab})</span>`); }
  if(isFinite(slope)){ let c='ok', lab='basso'; if(slope>=36){c='warn'; lab='intermedio';} if(slope>=40){c='bad'; lab='alto';} parts.push(`<span class="badge ${c}">VE/VCO₂ slope: <b>${slope.toFixed(1)}</b> (${lab})</span>`); }
  if(isFinite(hrr)){ let c='ok', lab='buono'; if(hrr<12){c='warn'; lab='ridotto';} if(hrr<6){c='bad'; lab='molto ridotto';} parts.push(`<span class="badge ${c}">HRR 1’: <b>${hrr.toFixed(0)}</b> (${lab})</span>`); }
  const score=( (isFinite(vo2kg)?(vo2kg<14?3:(vo2kg<18?2:0)):0) + (isFinite(slope)?(slope>=40?3:(slope>=36?2:0)):0) + (isFinite(hrr)?(hrr<6?2:(hrr<12?1:0)):0) );
  $('pr_out').innerHTML = parts.join(' ') + `<p style="margin-top:8px">Indice educativo (0–8): <b>${score}</b></p>`;
});

/* BTPS/STPD */
function waterVaporPressure_mmHg(Tc){ const Psat=6.1078*Math.pow(10,(7.5*Tc)/(237.3+Tc)); return Psat*0.750061683; }
function btps_to_stpd_factor(Pb,T,RH){ const Ph2o=waterVaporPressure_mmHg(T)*(RH/100); return ((Pb-Ph2o)/760)*(273.15/(273.15+T)); }
$('toSTPD').addEventListener('click',()=>{
  const f=btps_to_stpd_factor(+$('u_Pb').value||760, +$('u_T').value||22, +$('u_RH').value||50);
  $('u_out').innerHTML=`<p>Fattore BTPS→STPD: <b>${f.toFixed(3)}</b></p>`;
});
$('toBTPS').addEventListener('click',()=>{
  const f=btps_to_stpd_factor(+$('u_Pb').value||760, +$('u_T').value||22, +$('u_RH').value||50);
  $('u_out').innerHTML=`<p>Fattore STPD→BTPS: <b>${(1/f).toFixed(3)}</b></p>`;
});

/* Persistenza JSON locale */
function exportJSON(){
  const payload={ cfg:{}, calib: JSON.parse(localStorage.getItem('sforzu_calib')||'[]') };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='sforzu-backup.json'; a.click();
}
function importJSON(file){
  const r=new FileReader(); r.onload=()=>{
    try{ const obj=JSON.parse(r.result); if(obj.calib) localStorage.setItem('sforzu_calib', JSON.stringify(obj.calib)); $('persist_out').innerHTML='<p>Import completato.</p>'; renderCalib(); }
    catch(e){ $('persist_out').innerHTML='<p>File non valido.</p>'; }
  }; r.readAsText(file);
}
$('exp_json').addEventListener('click', exportJSON);
$('imp_json').addEventListener('change', e=>{ const f=e.target.files[0]; if(f) importJSON(f); });

/* Diario calibrazione */
function renderCalib(){
  const arr=JSON.parse(localStorage.getItem('sforzu_calib')||'[]');
  if(!arr.length){ $('cl_out').innerHTML='<p>Nessuna voce.</p>'; return; }
  let html='<ul>'; arr.forEach(x=>{ html+=`<li>${x.date} — ${x.op||'—'} — ${x.note||''}</li>`; }); html+='</ul>';
  $('cl_out').innerHTML=html;
}
$('cl_add').addEventListener('click',()=>{
  const date=$('cl_date').value || new Date().toISOString().slice(0,10);
  const op=$('cl_op').value||''; const note=$('cl_note').value||'';
  const arr=JSON.parse(localStorage.getItem('sforzu_calib')||'[]'); arr.push({date,op,note});
  localStorage.setItem('sforzu_calib', JSON.stringify(arr)); renderCalib();
});
$('cl_clear').addEventListener('click',()=>{ localStorage.removeItem('sforzu_calib'); renderCalib(); });
renderCalib();

/* ===== Mini wizard predetti (approssimati, non GLI) ===== */
function quickPred(age, sex, h_cm){
  const h = h_cm/100;
  let fev1, fvc;
  if(sex==='M'){
    fev1 = 0.553 * Math.pow(h, 2.6) - 0.013*age;
    fvc  = 0.578 * Math.pow(h, 2.9) - 0.015*age;
  }else{
    fev1 = 0.433 * Math.pow(h, 2.6) - 0.011*age;
    fvc  = 0.489 * Math.pow(h, 2.9) - 0.013*age;
  }
  fev1 = Math.max(0.8, fev1); fvc = Math.max(1.0, fvc);
  return {fev1, fvc};
}
document.getElementById('wiz_calc').addEventListener('click',()=>{
  const age=+$('wiz_age').value||NaN, sex=$('wiz_sex').value||'M', h=+$('wiz_h').value||NaN;
  try{
    reqPos(age,'Età'); reqPos(h,'Altezza');
    const p=quickPred(age, sex, h);
    $('wiz_out').innerHTML = `<p>FEV₁ pred ≈ <b>${p.fev1.toFixed(2)} L</b> • FVC pred ≈ <b>${p.fvc.toFixed(2)} L</b><br/><span class="hint">Stima educativa; inserisci i predetti GLI del tuo centro se disponibili.</span></p>`;
  }catch(e){ showError('wiz_out', e); }
});
document.getElementById('wiz_apply').addEventListener('click',()=>{
  const age=+$('wiz_age').value||NaN, sex=$('wiz_sex').value||'M', h=+$('wiz_h').value||NaN;
  try{
    reqPos(age,'Età'); reqPos(h,'Altezza');
    const p=quickPred(age, sex, h);
    const f1 = document.getElementById('sp_fev1_pred'), fv = document.getElementById('sp_fvc_pred');
    if(f1&&fv){ f1.value=p.fev1.toFixed(2); fv.value=p.fvc.toFixed(2); $('wiz_out').innerHTML='<p>Predetti applicati ai campi.</p>'; }
  }catch(e){ showError('wiz_out', e); }
});
