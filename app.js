
// Utils
const $ = (id)=>document.getElementById(id);
const show = (el, on)=> el.classList.toggle('hidden', !on);
function n(v){ v=+v; return isFinite(v)?v:NaN; }
function fmt(x,unit=''){ return isFinite(x)? (unit? `${x} ${unit}`: String(x)) : 'n.d.'; }
function valSafe(v, suffix){ v=+v; return isFinite(v)? (suffix? (v+' '+suffix): v): 'n.d.'; }

// State
let exam = null; // 'watt' | 'cpet'

// SPLINE-FREE LMS (race-neutral) — equazioni fornite
function lms_rn_predict(age, sex, h_cm){
  const H = Math.max(0.9, h_cm/100);
  const lnH = Math.log(H);
  const lnA = Math.log(Math.max(3, age));
  const Ms=0, Ss=0; // baseline compatta
  const o={};
  if(sex==='F'){
    o.FEV1_pred = Math.exp(-10.901689 + 2.385928*lnH - 0.076386*lnA + Ms);
    o.FVC_pred  = Math.exp(-12.055901 + 2.621579*lnH - 0.035975*lnA + Ms);
    o.RAT_pred  = Math.exp(  0.9189568 - 0.1840671*lnH - 0.0461306*lnA + Ms); // frazione
    o.L_FEV1 = 1.21388;
    o.S_FEV1 = Math.exp(-2.364047 + 0.129402*lnA + Ss);
    o.L_FVC  = 0.899;
    o.S_FVC  = Math.exp(-2.310148 + 0.120428*lnA + Ss);
    o.L_RAT  = (6.6490 - 0.9920*lnA);
    o.S_RAT  = Math.exp(-3.171582 + 0.144358*lnA + Ss);
  } else {
    o.FEV1_pred = Math.exp(-11.399108 + 2.462664*lnH - 0.011394*lnA + Ms);
    o.FVC_pred  = Math.exp(-12.629131 + 2.727421*lnH + 0.009174*lnA + Ms);
    o.RAT_pred  = Math.exp(  1.022608  - 0.218592*lnH - 0.027586*lnA + Ms);
    o.L_FEV1 = 1.22703;
    o.S_FEV1 = Math.exp(-2.256278 + 0.080729*lnA + Ss);
    o.L_FVC  = 0.9346;
    o.S_FVC  = Math.exp(-2.195595 + 0.068466*lnA + Ss);
    o.L_RAT  = (3.8243 - 0.3328*lnA);
    o.S_RAT  = Math.exp(-2.882025 + 0.068889*lnA + Ss);
  }
  return o;
}
function z_from_LMS(meas, L, M, S){
  if(!(isFinite(meas)&&isFinite(L)&&isFinite(M)&&isFinite(S)&&M>0&&S>0)) return NaN;
  if(Math.abs(L)<1e-6){ return Math.log(meas/M)/S; }
  return (Math.pow(meas/M, L) - 1) / (L*S);
}
function lln_from_LMS(L,M,S){
  if(!(isFinite(L)&&isFinite(M)&&isFinite(S)&&M>0&&S>0)) return NaN;
  const z=-1.645;
  if(Math.abs(L)<1e-6){ return M*Math.exp(z*S); }
  return M*Math.pow(1+L*S*z, 1/L);
}

// Predetti rapidi fallback
function quickPred(age,sex,h_cm){
  let FEV1 = (sex==='M'? 4.30:3.50) - 0.03*(age-25)*0.8;
  let FVC  = (sex==='M'? 5.30:4.20) - 0.02*(age-25)*0.8;
  return {fev1:FEV1, fvc:FVC};
}

// WIZARD
$('sel_watt').addEventListener('click',()=>{ setExam('watt'); });
$('sel_cpet').addEventListener('click',()=>{ setExam('cpet'); });
$('switch_exam').addEventListener('click',()=>{
  setExam(null);
});
function setExam(kind){
  exam = kind;
  show($('start'), kind===null);
  const commonOn = (kind==='watt'||kind==='cpet');
  show($('common'), commonOn);
  show($('proto_card'), commonOn);
  show($('watt_block'), kind==='watt');
  show($('spiro_block'), kind==='cpet');
  show($('cpet_block'), kind==='cpet');
  show($('report_card'), commonOn);
  if(commonOn){ suggestProtocol(); renderSpiroPred(); renderSpiroLMS(); }
}

// PROTOCOLLO SUGGERITO (indipendente dal tipo di esame)
function suggestProtocol(){
  const erg=$('ergotype').value;
  const pa=n($('pa_hours').value);
  const dx=($('dx').value||'').toLowerCase();
  let ramp = (erg==='tm')? 1.0: 15;
  let start = (erg==='tm')? 20: 25;
  let dur = 8;
  if(pa>=5) { ramp = (erg==='tm')? 1.2: 20; start=(erg==='tm')? 30: 40; }
  if(dx.includes('ischemi')||dx.includes('scomp')) { ramp = (erg==='tm')? 0.6: 10; start=(erg==='tm')? 15: 20; }
  $('proto_text').innerHTML = `Suggerimento: rampa <b>${ramp} ${erg==='tm'?'km/h eq.':'W/min'}</b>, carico iniziale <b>${start} ${erg==='tm'?'%': 'W'}</b>, durata target <b>${dur}–12 min</b>.`;
  return {ramp,start,dur};
}
$('apply_proto').addEventListener('click',()=>{
  const p=suggestProtocol();
  if(exam==='watt'){ $('w_ramp').value=p.ramp; $('w_start').value=p.start; $('w_dur').value=p.dur; }
});

// SPIROMETRIA — PRED/LMS/FLAG
function renderSpiroPred(){
  if(exam!=='cpet'){ $('sp_pred_box').innerHTML=''; return; }
  const age=n($('age').value), sex=$('sex').value, h=n($('height').value);
  const m=$('sp_method').value;
  const box=$('sp_pred_box');
  if(m==='lms_rn'){
    if(!isFinite(age)||!isFinite(h)){ box.innerHTML='<span class="hint">Inserisci età e altezza per i predetti LMS.</span>'; return; }
    const p = lms_rn_predict(age,sex,h);
    box.innerHTML = `Predetti (LMS): FEV₁ <b>${p.FEV1_pred.toFixed(2)} L</b>, FVC <b>${p.FVC_pred.toFixed(2)} L</b>, rapporto <b>${(p.RAT_pred*100).toFixed(1)}%</b>`;
  } else {
    const q=quickPred(age,sex,h);
    box.innerHTML = `Stima rapida: FEV₁ ~ <b>${isFinite(q.fev1)?q.fev1.toFixed(2):'n.d.'} L</b>, FVC ~ <b>${isFinite(q.fvc)?q.fvc.toFixed(2):'n.d.'} L</b>`;
  }
}
function renderSpiroLMS(){
  const txt=$('sp_lms_text'); const flag=$('sp_flag_box');
  if(exam!=='cpet'){ if(txt) txt.textContent=''; if(flag) flag.innerHTML=''; return; }
  if($('sp_method').value!=='lms_rn'){ txt.textContent='—'; flag.innerHTML=''; return; }
  const age=n($('age').value), sex=$('sex').value, h=n($('height').value);
  if(!isFinite(age)||!isFinite(h)){ txt.textContent='Inserisci età e altezza…'; flag.innerHTML=''; return; }
  const p=lms_rn_predict(age,sex,h);
  const FEV1m=n($('sp_fev1').value), FVCm=n($('sp_fvc').value);
  let ratio=n($('sp_ratio').value);
  if(!isFinite(ratio)&&isFinite(FEV1m)&&isFinite(FVCm)&&FVCm>0) ratio=100*FEV1m/FVCm;
  const pR=p.RAT_pred*100;
  const z1 = z_from_LMS(FEV1m,p.L_FEV1,p.FEV1_pred,p.S_FEV1);
  const z2 = z_from_LMS(FVCm ,p.L_FVC ,p.FVC_pred ,p.S_FVC );
  const zR = z_from_LMS(ratio ,p.L_RAT ,pR        ,p.S_RAT );
  const lln1 = lln_from_LMS(p.L_FEV1,p.FEV1_pred,p.S_FEV1);
  const lln2 = lln_from_LMS(p.L_FVC ,p.FVC_pred ,p.S_FVC );
  const llnR = lln_from_LMS(p.L_RAT ,pR         ,p.S_RAT );
  const pct1 = isFinite(FEV1m)? Math.round(100*FEV1m/p.FEV1_pred):NaN;
  const pct2 = isFinite(FVCm)?  Math.round(100*FVCm /p.FVC_pred ):NaN;
  const pctR = isFinite(ratio)? Math.round(100*ratio/pR):NaN;

  txt.innerHTML = 
    `FEV₁ pred: <b>${p.FEV1_pred.toFixed(2)} L</b>${isFinite(pct1)?' — '+pct1+'%':''}${isFinite(z1)?' — z '+z1.toFixed(2):''}${isFinite(lln1)?' — LLN '+lln1.toFixed(2)+' L':''}`+
    ` &nbsp;•&nbsp; FVC pred: <b>${p.FVC_pred.toFixed(2)} L</b>${isFinite(pct2)?' — '+pct2+'%':''}${isFinite(z2)?' — z '+z2.toFixed(2):''}${isFinite(lln2)?' — LLN '+lln2.toFixed(2)+' L':''}`+
    ` &nbsp;•&nbsp; Rapporto pred: <b>${pR.toFixed(1)}%</b>${isFinite(pctR)?' — '+pctR+'%':''}${isFinite(zR)?' — z '+zR.toFixed(2):''}${isFinite(llnR)?' — LLN '+llnR.toFixed(1)+'%':''}`;

  // Flags interpretativi basici (neutri)
  let msgs=[];
  if(isFinite(ratio)&&isFinite(llnR) && ratio < llnR) msgs.push(`<span class="bad">Compatibile con ostruzione (rapporto sotto LLN)</span>`);
  if(isFinite(FVCm) && isFinite(lln2) && FVCm < lln2 && !(isFinite(ratio)&&isFinite(llnR)&&ratio<llnR)) msgs.push(`<span class="warn">Compatibile con riduzione di FVC (possibile restrizione)</span>`);
  if(msgs.length===0) msgs.push(`<span class="ok">Valori spirometrici nei limiti rispetto ai predetti</span>`);
  flag.innerHTML = msgs.join('<br>');
}

// WATT — analisi
function analyzeWatt(){
  const wmax=n($('r_wmax').value), dur=n($('r_dur').value), kg=n($('weight').value);
  const wkg = isFinite(wmax)&&isFinite(kg)&&kg>0? (wmax/kg):NaN;
  const hrrest=n($('r_hrrest').value), hrmax=n($('r_hrmax').value);
  const pas=n($('r_pas').value), pad=n($('r_pad').value);
  const mets = isFinite(wmax)? (wmax/70):NaN; // stima uso ciclo
  $('watt_results').innerHTML = `Carico massimo: <b>${fmt(wmax,'W')}</b> (${isFinite(wkg)?wkg.toFixed(2)+' W/kg':'n.d.'}), durata <b>${fmt(dur,'min')}</b>.<br>`+
    `FC: riposo ${fmt(hrrest,'bpm')}, picco ${fmt(hrmax,'bpm')}. Pressione: ${fmt(pas,'mmHg')}/${fmt(pad,'mmHg')}.<br>`+
    `METs stimati: <b>${isFinite(mets)?mets.toFixed(1):'n.d.'}</b>.`;
}
$('analyze_watt').addEventListener('click', analyzeWatt);

// CPET — analisi + indici
function HRmax_pred(age){
  if(!isFinite(age)) return NaN;
  return 208 - 0.7*age; // Tanaka
}
function chronotropicReserve(age, HRrest, HRpeak){
  const Hmax = HRmax_pred(age);
  if(![age,HRrest,HRpeak,Hmax].every(isFinite)) return NaN;
  const num = HRpeak - HRrest;
  const den = Hmax - HRrest;
  if(den<=0) return NaN;
  return num/den; // 0..1
}
function classifyCR(cr){
  if(!isFinite(cr)) return 'n.d.';
  if(cr < 0.62) return `${cr.toFixed(2)} — ridotta`;
  if(cr < 0.80) return `${cr.toFixed(2)} — borderline`;
  return `${cr.toFixed(2)} — nei limiti`;
}
$('analyze_cpet').addEventListener('click', ()=>{
  const age=n($('age').value);
  const cr = chronotropicReserve(age, n($('r_hrrest').value), n($('r_hrmax').value));
  const vevco2 = n($('r_vevco2').value);
  let veClass = isFinite(vevco2)? (vevco2>34? 'elevata': 'nei limiti') : 'n.d.'; // soglia indicativa
  $('cpet_results').innerHTML = `Riserva cronotropa: <b>${classifyCR(cr)}</b>. VE/VCO₂ slope: <b>${isFinite(vevco2)?vevco2.toFixed(1):'n.d.'}</b> (${veClass}).`;
});

// Referti
function spiroSummaryShort(){
  const age=n($('age').value), sex=$('sex').value, h=n($('height').value);
  const FEV1=n($('sp_fev1').value), FVC=n($('sp_fvc').value);
  let ratio=n($('sp_ratio').value); if(!isFinite(ratio)&&isFinite(FEV1)&&isFinite(FVC)&&FVC>0) ratio=100*FEV1/FVC;
  if(![age,sex,h].every(x=>x!=='')) return 'Spirometria: dati incompleti.';
  const p=lms_rn_predict(age,sex,h); const pR=p.RAT_pred*100;
  const z1=z_from_LMS(FEV1,p.L_FEV1,p.FEV1_pred,p.S_FEV1);
  const z2=z_from_LMS(FVC ,p.L_FVC ,p.FVC_pred ,p.S_FVC );
  const zR=z_from_LMS(ratio,p.L_RAT ,pR        ,p.S_RAT );
  return `Spirometria: FEV₁ ${isFinite(FEV1)?FEV1.toFixed(2)+' L':'n.d.'} (z ${isFinite(z1)?z1.toFixed(2):'n.d.'}), FVC ${isFinite(FVC)?FVC.toFixed(2)+' L':'n.d.'} (z ${isFinite(z2)?z2.toFixed(2):'n.d.'}), rapporto ${isFinite(ratio)?ratio.toFixed(1)+'%':'n.d.'} (z ${isFinite(zR)?zR.toFixed(2):'n.d.'}).`;
}

function wattShortReport(){
  const wmax=n($('r_wmax').value), dur=n($('r_dur').value), kg=n($('weight').value);
  const wkg=isFinite(wmax)&&isFinite(kg)&&kg>0? (wmax/kg):NaN;
  const hrrest=n($('r_hrrest').value), hrmax=n($('r_hrmax').value);
  const mets = isFinite(wmax)? (wmax/70):NaN;
  const cr = chronotropicReserve(n($('age').value), hrrest, hrmax);
  return `Watt test: carico massimo ${fmt(wmax,'W')} (${isFinite(wkg)?wkg.toFixed(2)+' W/kg':'n.d.'}), durata ${fmt(dur,'min')}. `+
         `Riserva cronotropa: ${classifyCR(cr)}. METs stimati: ${isFinite(mets)?mets.toFixed(1):'n.d.'}.`;
}
function wattLongReport(){
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
  const cr = chronotropicReserve(n($('age').value), n($('r_hrrest').value), n($('r_hrmax').value));
  return `Il test da sforzo al ${ergo} è stato eseguito con protocollo a rampa di ${ramp} W/min, carico iniziale ${w0} W.
Condizioni basali: FC ${hrrest} bpm, PA ${pas}/${pad} mmHg.

Carico massimo ${wmax} W (≈ ${isFinite(mets)?mets.toFixed(1):'n.d.'} METs) dopo ${dur} minuti. FC picco ${hrmax} bpm. Riserva cronotropa ${classifyCR(cr)}.
Interpretazione descrittiva contestualizzata ai predetti e al profilo clinico.`;
}

function cpetShortReport(){
  const age=n($('age').value);
  const cr = chronotropicReserve(age, n($('r_hrrest').value), n($('r_hrmax').value));
  const vo2=n($('r_vo2').value), rer=n($('r_rer').value), slope=n($('r_vevco2').value);
  const slopeTxt = isFinite(slope)? `${slope.toFixed(1)} (${slope>34?'elevata':'nei limiti'})` : 'n.d.';
  return `CPET: VO₂ picco ${valSafe(vo2,'ml/min/kg')}, RER ${valSafe(rer,'')}, VE/VCO₂ ${slopeTxt}. `+
         `Riserva cronotropa: ${classifyCR(cr)}. `+
         spiroSummaryShort();
}
function cpetLongReport(){
  let dur = n($('r_dur_c').value);
  const ergo = $('ergotype').value==='tm'?'treadmill':'cicloergometro';
  const sexT = $('sex').value==='M'?'maschile':'femminile';
  return `Il test cardiopolmonare è stato eseguito su ${ergo}.

Parametri basali: età ${$('age').value||'n.d.'} anni, sesso ${sexT}, altezza ${$('height').value||'n.d.'} cm, peso ${$('weight').value||'n.d.'} kg.

VO₂ picco ${valSafe($('r_vo2').value,'ml/min/kg')}, RER ${valSafe($('r_rer').value,'')}, durata ${isFinite(dur)?dur+' min':'n.d.'}.
Riserva cronotropa ${classifyCR(chronotropicReserve(n($('age').value), n($('r_hrrest').value), n($('r_hrmax').value)))}.
VE/VCO₂ slope ${valSafe($('r_vevco2').value,'')} (valutazione clinica). O₂ pulse ${valSafe($('r_o2pulse').value,'ml/batt')} se disponibile.

Spirometria pre-test: ${spiroSummaryShort()}
Interpretazione descrittiva: contestualizzazione rispetto ai predetti LMS e quadro clinico; nessuna inferenza diagnostica automatica.`;
}

// Buttons
$('short_rep').addEventListener('click', ()=>{
  $('report').value = (exam==='watt')? wattShortReport() : cpetShortReport();
});
$('long_rep').addEventListener('click', ()=>{
  $('report').value = (exam==='watt')? wattLongReport() : cpetLongReport();
});

// Bind
['age','sex','height','weight','ergotype','pa_hours','dx','sp_fev1','sp_fvc','sp_ratio','sp_method'].forEach(id=>{
  const el=$(id); if(el){ el.addEventListener('input', ()=>{ suggestProtocol(); renderSpiroPred(); renderSpiroLMS(); }); }
});

// Default — mostra selezione esame
setExam(null);
