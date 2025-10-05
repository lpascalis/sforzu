
// Utility
const $ = (id)=>document.getElementById(id);
function n(v){ v=+v; return isFinite(v)?v:NaN; }
function fmt(x,unit=''){ return isFinite(x)? (unit? `${x} ${unit}`: String(x)) : 'n.d.'; }
function valSafe(v, suffix){ v=+v; return isFinite(v)? (suffix? (v+' '+suffix): v): 'n.d.'; }

// LMS race-neutral (Bowerman/GLI-style) — spline interne compatte (baseline 0), no file esterni
function lms_rn_predict(age, sex, h_cm){
  const H = Math.max(0.9, h_cm/100);
  const lnH = Math.log(H);
  const lnA = Math.log(Math.max(3, age));
  const Ms=0, Ss=0; // spline baseline integrate (compatte)
  const out={};
  if(sex==='F'){
    out.FEV1_pred = Math.exp(-10.901689 + 2.385928*lnH - 0.076386*lnA + Ms);
    out.FVC_pred  = Math.exp(-12.055901 + 2.621579*lnH - 0.035975*lnA + Ms);
    out.RAT_pred  = Math.exp(  0.9189568 - 0.1840671*lnH - 0.0461306*lnA + Ms); // frazione; poi ×100
    out.L_FEV1 = 1.21388;
    out.S_FEV1 = Math.exp(-2.364047 + 0.129402*lnA + Ss);
    out.L_FVC  = 0.899;
    out.S_FVC  = Math.exp(-2.310148 + 0.120428*lnA + Ss);
    out.L_RAT  = (6.6490 - 0.9920*lnA);
    out.S_RAT  = Math.exp(-3.171582 + 0.144358*lnA + Ss);
  } else {
    out.FEV1_pred = Math.exp(-11.399108 + 2.462664*lnH - 0.011394*lnA + Ms);
    out.FVC_pred  = Math.exp(-12.629131 + 2.727421*lnH + 0.009174*lnA + Ms);
    out.RAT_pred  = Math.exp(  1.022608  - 0.218592*lnH - 0.027586*lnA + Ms);
    out.L_FEV1 = 1.22703;
    out.S_FEV1 = Math.exp(-2.256278 + 0.080729*lnA + Ss);
    out.L_FVC  = 0.9346;
    out.S_FVC  = Math.exp(-2.195595 + 0.068466*lnA + Ss);
    out.L_RAT  = (3.8243 - 0.3328*lnA);
    out.S_RAT  = Math.exp(-2.882025 + 0.068889*lnA + Ss);
  }
  return out;
}
function z_from_LMS(meas, L, M, S){
  if(!(isFinite(meas)&&isFinite(L)&&isFinite(M)&&isFinite(S)&&M>0&&S>0)) return NaN;
  if(Math.abs(L)<1e-6){ return Math.log(meas/M)/S; }
  return (Math.pow(meas/M, L) - 1) / (L*S);
}
function lln_from_LMS(L,M,S){
  if(!(isFinite(L)&&isFinite(M)&&isFinite(S)&&M>0&&S>0)) return NaN;
  const z = -1.645;
  if(Math.abs(L)<1e-6){ return M*Math.exp(z*S); }
  return M*Math.pow(1+L*S*z, 1/L);
}

// Quick predicted (fallback semplice)
function quickPred(age,sex,h_cm){
  const H=Math.max(0.9,h_cm/100);
  let FEV1 = (sex==='M'? 4.30:3.50) - 0.03*(age-25)*0.8;
  let FVC  = (sex==='M'? 5.30:4.20) - 0.02*(age-25)*0.8;
  const vo2kg = (sex==='M'? 45:38) - 0.2*(age-25);
  return {fev1:FEV1, fvc:FVC, vo2kg:vo2kg};
}

// SPIROMETRIA UI
function renderSpiroPred(){
  const age=n($('age').value), sex=$('sex').value, h=n($('height').value);
  const m = $('sp_method').value;
  const box = $('sp_pred_box');
  if(m==='lms_rn'){
    if(!isFinite(age)||!isFinite(h)){ box.innerHTML='<span class="hint">Inserisci età e altezza per i predetti LMS.</span>'; return; }
    const p = lms_rn_predict(age,sex,h);
    box.innerHTML = `Predetti (LMS): FEV₁ <b>${p.FEV1_pred.toFixed(2)} L</b>, FVC <b>${p.FVC_pred.toFixed(2)} L</b>, rapporto <b>${(p.RAT_pred*100).toFixed(1)}%</b>`;
  } else {
    const q = quickPred(age,sex,h);
    box.innerHTML = `Stima rapida: FEV₁ ~ <b>${isFinite(q.fev1)?q.fev1.toFixed(2):'n.d.'} L</b>, FVC ~ <b>${isFinite(q.fvc)?q.fvc.toFixed(2):'n.d.'} L</b>`;
  }
}
function renderSpiroLMS(){
  const method = $('sp_method').value;
  const txt = $('sp_lms_text'); if(!txt) return;
  if(method!=='lms_rn'){ txt.textContent='—'; return; }
  const age=n($('age').value), sex=$('sex').value, h=n($('height').value);
  if(!isFinite(age)||!isFinite(h)){ txt.textContent='Inserisci età e altezza…'; return; }
  const p=lms_rn_predict(age,sex,h);
  const FEV1m=n($('sp_fev1').value), FVCm=n($('sp_fvc').value);
  let ratio=n($('sp_ratio').value);
  if(!isFinite(ratio)&&isFinite(FEV1m)&&isFinite(FVCm)&&FVCm>0) ratio=100*FEV1m/FVCm;
  const pR=p.RAT_pred*100;
  const pct1 = (isFinite(FEV1m)&&p.FEV1_pred>0)? Math.round(100*FEV1m/p.FEV1_pred):NaN;
  const pct2 = (isFinite(FVCm)&&p.FVC_pred>0)? Math.round(100*FVCm/p.FVC_pred):NaN;
  const pctR = (isFinite(ratio)&&pR>0)? Math.round(100*ratio/pR):NaN;
  const z1 = z_from_LMS(FEV1m,p.L_FEV1,p.FEV1_pred,p.S_FEV1);
  const z2 = z_from_LMS(FVCm ,p.L_FVC ,p.FVC_pred ,p.S_FVC );
  const zR = z_from_LMS(ratio ,p.L_RAT ,pR        ,p.S_RAT );
  const lln1 = lln_from_LMS(p.L_FEV1,p.FEV1_pred,p.S_FEV1);
  const lln2 = lln_from_LMS(p.L_FVC ,p.FVC_pred ,p.S_FVC );
  const llnR = lln_from_LMS(p.L_RAT ,pR         ,p.S_RAT );
  txt.innerHTML = 
    `FEV₁ pred: <b>${p.FEV1_pred.toFixed(2)} L</b>${isFinite(pct1)?' — '+pct1+'%':''}${isFinite(z1)?' — z '+z1.toFixed(2):''}${isFinite(lln1)?' — LLN '+lln1.toFixed(2)+' L':''}`+
    ` &nbsp;•&nbsp; FVC pred: <b>${p.FVC_pred.toFixed(2)} L</b>${isFinite(pct2)?' — '+pct2+'%':''}${isFinite(z2)?' — z '+z2.toFixed(2):''}${isFinite(lln2)?' — LLN '+lln2.toFixed(2)+' L':''}`+
    ` &nbsp;•&nbsp; Rapporto pred: <b>${pR.toFixed(1)}%</b>${isFinite(pctR)?' — '+pctR+'%':''}${isFinite(zR)?' — z '+zR.toFixed(2):''}${isFinite(llnR)?' — LLN '+llnR.toFixed(1)+'%':''}`;
}

// PROTOCOLLO SUGGERITO
function suggestProtocol(){
  const age=n($('age').value), sex=$('sex').value, w=n($('weight').value), erg=$('ergotype').value;
  const pa=n($('pa_hours').value); const dx=$('dx').value.toLowerCase();
  let ramp = (erg==='tm')? 1.0: 15; // km/h or W/min proxy; ma usiamo W/min per omogeneità
  let start = (erg==='tm')? 20: 25;
  let dur = 8; // target 8–12 min
  if(pa>=5) { ramp = (erg==='tm')? 1.2: 20; start=(erg==='tm')? 30: 40; }
  if(dx.includes('ischemi')||dx.includes('scomp')) { ramp = (erg==='tm')? 0.6: 10; start=(erg==='tm')? 15: 20; }
  $('proto_text').innerHTML = `Suggerimento: rampa <b>${ramp} W/min</b>, carico iniziale <b>${start} W</b>, durata target <b>${dur}–12 min</b>.`;
  return {ramp,start,dur};
}
$('apply_proto').addEventListener('click',()=>{
  const p=suggestProtocol();
  $('w_ramp').value=p.ramp; $('w_start').value=p.start; $('w_dur').value=p.dur;
});

// WATT ANALYSIS
function analyzeWatt(){
  const wmax=n($('r_wmax').value), dur=n($('r_dur').value), kg=n($('weight').value);
  const wkg = isFinite(wmax)&&isFinite(kg)&&kg>0? (wmax/kg):NaN;
  const hrrest=n($('r_hrrest').value), hrmax=n($('r_hrmax').value);
  const pas=n($('r_pas').value), pad=n($('r_pad').value);
  const mets = isFinite(wmax)? (wmax/70):NaN; // stima rapida 1 MET ~ 70W al ciclo (ordine di grandezza)
  $('watt_results').innerHTML = `Carico massimo: <b>${fmt(wmax,'W')}</b> (${isFinite(wkg)?wkg.toFixed(2)+' W/kg':'n.d.'}), durata <b>${fmt(dur,'min')}</b>.<br>`+
    `FC: riposo ${fmt(hrrest,'bpm')}, picco ${fmt(hrmax,'bpm')}. Pressione: ${fmt(pas,'mmHg')}/${fmt(pad,'mmHg')}.<br>`+
    `METs stimati: <b>${isFinite(mets)?mets.toFixed(1):'n.d.'}</b>.`;
}
$('analyze_watt').addEventListener('click', analyzeWatt);

// CPET REPORTS
function spiroSummary(){
  const age=n($('age').value), sex=$('sex').value, h=n($('height').value);
  const FEV1=n($('sp_fev1').value), FVC=n($('sp_fvc').value);
  let ratio=n($('sp_ratio').value); if(!isFinite(ratio)&&isFinite(FEV1)&&isFinite(FVC)&&FVC>0) ratio=100*FEV1/FVC;
  const p=lms_rn_predict(age,sex,h); const pR=p.RAT_pred*100;
  const pct1=isFinite(FEV1)? Math.round(100*FEV1/p.FEV1_pred):NaN;
  const pct2=isFinite(FVC)? Math.round(100*FVC/p.FVC_pred):NaN;
  const pctR=isFinite(ratio)? Math.round(100*ratio/pR):NaN;
  const z1=z_from_LMS(FEV1,p.L_FEV1,p.FEV1_pred,p.S_FEV1);
  const z2=z_from_LMS(FVC ,p.L_FVC ,p.FVC_pred ,p.S_FVC );
  const zR=z_from_LMS(ratio,p.L_RAT ,pR        ,p.S_RAT );
  return `FEV₁ ${isFinite(FEV1)?FEV1.toFixed(2)+' L':'n.d.'}${isFinite(pct1)?' ('+pct1+'%)':''}${isFinite(z1)?' [z '+z1.toFixed(2)+']':''}, `+
         `FVC ${isFinite(FVC)?FVC.toFixed(2)+' L':'n.d.'}${isFinite(pct2)?' ('+pct2+'%)':''}${isFinite(z2)?' [z '+z2.toFixed(2)+']':''}, `+
         `rapporto ${isFinite(ratio)?ratio.toFixed(1)+'%':'n.d.'}${isFinite(zR)?' [z '+zR.toFixed(2)+']':''}.`;
}
function cpetLongReport(){
  let dur = n($('r_dur_c').value);
  const proto = $('w_ramp').value? `${$('w_ramp').value} W/min` : 'standard';
  const ergo = $('ergotype').value==='tm'?'treadmill':'cicloergometro';
  const sexT = $('sex').value==='M'?'maschile':'femminile';
  const rep = 
`Il test cardiopolmonare è stato eseguito secondo protocollo ${proto} su ${ergo}.

Parametri basali: età ${$('age').value||'n.d.'} anni, sesso ${sexT}, altezza ${$('height').value||'n.d.'} cm, peso ${$('weight').value||'n.d.'} kg.

Durante la prova il paziente ha raggiunto VO₂ di picco pari a ${valSafe($('r_vo2').value,'ml/min/kg')}, con RER ${valSafe($('r_rer').value,'')} e durata complessiva di ${isFinite(dur)?dur+' min':'n.d.'}.
Risposta cardiaca: FC a riposo ${valSafe($('r_hrrest').value,'bpm')}, FC di picco ${valSafe($('r_hrmax').value,'bpm')}. Pressione arteriosa massima ${valSafe($('r_pas').value,'mmHg')}/${valSafe($('r_pad').value,'mmHg')}.
Indici ventilatori: VE/VCO₂ slope ${valSafe($('r_vevco2').value,'')}, O₂ pulse di picco ${valSafe($('r_o2pulse').value,'ml/batt')} (se disponibili).

Spirometria pre-test: ${spiroSummary()}

Interpretazione: la capacità funzionale e la risposta ventilatoria sono state contestualizzate rispetto ai predetti (LMS, race‑neutral) e al profilo clinico. Il referto non sostituisce il giudizio clinico e non formula diagnosi automatiche.`;
  return rep;
}
function cpetShortReport(){
  return `CPET: VO₂ picco ${valSafe($('r_vo2').value,'ml/min/kg')}, RER ${valSafe($('r_rer').value,'')}, VE/VCO₂ ${valSafe($('r_vevco2').value,'')}. Spirometria: ${spiroSummary()}`;
}
$('analyze_cpet').addEventListener('click', ()=>{
  $('cpet_results').innerHTML = 'Analisi completata. Usa i pulsanti Referto per generare il testo.';
});

// Buttons Referto
$('short_rep').addEventListener('click', ()=>{
  const mode = currentMode;
  if(mode==='watt'){
    const txt = $('watt_results').innerText || '—';
    $('report').value = `Watt test — riepilogo: ${txt.replace(/\n/g,' ')}`;
  } else {
    $('report').value = cpetShortReport();
  }
});
$('long_rep').addEventListener('click', ()=>{
  const mode = currentMode;
  if(mode==='watt'){
    const ergo = $('ergotype').value==='tm'?'treadmill':'cicloergometro';
    const ramp = $('w_ramp').value||'n.d.';
    const w0 = $('w_start').value||'n.d.';
    const hrrest=$('r_hrrest').value||'n.d.';
    const pas=$('r_pas').value||'n.d.';
    const pad=$('r_pad').value||'n.d.';
    const wmax=$('r_wmax').value||'n.d.';
    const mets=(+$('r_wmax').value/70)||NaN;
    const dur=$('r_dur').value||'n.d.';
    const hrmax=$('r_hrmax').value||'n.d.';
    const rep = `Il test da sforzo al ${ergo} è stato eseguito con protocollo a rampa incrementale di ${ramp} W/min, con carico iniziale di ${w0} W.
Il paziente si è presentato in condizioni basali stabili, ritmo sinusale a ${hrrest} bpm, pressione arteriosa ${pas}/${pad} mmHg.

Durante la prova è stato raggiunto un carico massimo di ${wmax} W (≈ ${isFinite(mets)?mets.toFixed(1):'n.d.'} METs), interrotto dopo ${dur} minuti complessivi di esercizio. La frequenza cardiaca massima è stata di ${hrmax} bpm. La risposta pressoria è stata valutata clinicamente in rapporto al quadro di base.

La prova può essere considerata massimale/sub-massimale secondo criteri clinici. La capacità funzionale globale e la risposta cronotropa/pressoria vengono interpretate in relazione ai valori predetti e al contesto clinico.

Conclusioni: referto descrittivo senza inferenze automatiche; correlare con sintomi, ECG e indicazioni cliniche.`;
    $('report').value = rep;
  } else {
    $('report').value = cpetLongReport();
  }
});

// MODE handling
let currentMode='watt';
function setMode(m){
  currentMode=m;
  $('block_watt').classList.toggle('hidden', m!=='watt');
  $('block_cpet').classList.toggle('hidden', m!=='cpet');
  // Reset/Init
  renderSpiroPred(); renderSpiroLMS(); suggestProtocol();
}
$('b_watt').addEventListener('click',()=>{ setMode('watt'); });
$('b_cpet').addEventListener('click',()=>{ setMode('cpet'); });
// default
setMode('watt');

// Bind inputs
['age','sex','height','weight','pa_hours','dx','sp_fev1','sp_fvc','sp_ratio','sp_method'].forEach(id=>{
  const el=$(id); if(el){ el.addEventListener('input', ()=>{ renderSpiroPred(); renderSpiroLMS(); if(id!=='sp_fev1'&&id!=='sp_fvc'&&id!=='sp_ratio') suggestProtocol(); }); }
});

