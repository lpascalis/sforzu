
// Helpers
const $ = (id)=>document.getElementById(id);
const show = (el,on)=>el.classList.toggle('hidden',!on);
const n = (v)=>{v=+v; return isFinite(v)?v:NaN;}
function fmt(x,unit=''){return isFinite(x)? (unit?`${x} ${unit}`:String(x)):'n.d.'}

// State
let exam=null;

// LMS race-neutral (equazioni fornite)
function lms_rn_predict(age,sex,h_cm){
  const H = Math.max(0.9,h_cm/100), lnH=Math.log(H), lnA=Math.log(Math.max(3,age));
  const Ms=0,Ss=0; const o={};
  if(sex==='F'){
    o.FEV1_pred = Math.exp(-10.901689 + 2.385928*lnH - 0.076386*lnA + Ms);
    o.FVC_pred  = Math.exp(-12.055901 + 2.621579*lnH - 0.035975*lnA + Ms);
    o.RAT_pred  = Math.exp(  0.9189568 - 0.1840671*lnH - 0.0461306*lnA + Ms);
    o.L_FEV1=1.21388; o.S_FEV1=Math.exp(-2.364047 + 0.129402*lnA + Ss);
    o.L_FVC =0.899;   o.S_FVC =Math.exp(-2.310148 + 0.120428*lnA + Ss);
    o.L_RAT=(6.6490 - 0.9920*lnA); o.S_RAT=Math.exp(-3.171582 + 0.144358*lnA + Ss);
  } else {
    o.FEV1_pred = Math.exp(-11.399108 + 2.462664*lnH - 0.011394*lnA + Ms);
    o.FVC_pred  = Math.exp(-12.629131 + 2.727421*lnH + 0.009174*lnA + Ms);
    o.RAT_pred  = Math.exp(  1.022608  - 0.218592*lnH - 0.027586*lnA + Ms);
    o.L_FEV1=1.22703; o.S_FEV1=Math.exp(-2.256278 + 0.080729*lnA + Ss);
    o.L_FVC =0.9346;  o.S_FVC =Math.exp(-2.195595 + 0.068466*lnA + Ss);
    o.L_RAT=(3.8243 - 0.3328*lnA); o.S_RAT=Math.exp(-2.882025 + 0.068889*lnA + Ss);
  }
  return o;
}
function z_from_LMS(meas,L,M,S){ if(!(isFinite(meas)&&isFinite(L)&&isFinite(M)&&isFinite(S)&&M>0&&S>0)) return NaN; if(Math.abs(L)<1e-6) return Math.log(meas/M)/S; return (Math.pow(meas/M,L)-1)/(L*S); }
function lln_from_LMS(L,M,S){ if(!(isFinite(L)&&isFinite(M)&&isFinite(S)&&M>0&&S>0)) return NaN; const z=-1.645; if(Math.abs(L)<1e-6) return M*Math.exp(z*S); return M*Math.pow(1+L*S*z,1/L); }

function quickPred(age,sex,h){ let FEV1=(sex==='M'?4.3:3.5)-0.024*(age-25); let FVC=(sex==='M'?5.3:4.2)-0.02*(age-25); return {fev1:FEV1,fvc:FVC}; }

// Wizard
$('sel_watt').addEventListener('click',()=>setExam('watt'));
$('sel_cpet').addEventListener('click',()=>setExam('cpet'));
$('switch_exam').addEventListener('click',()=>setExam(null));

function setExam(kind){
  exam=kind;
  show($('start'), kind===null);
  const on=(kind==='watt'||kind==='cpet');
  show($('common'), on);
  show($('proto_card'), on);
  show($('watt_block'), kind==='watt');
  show($('spiro_block'), kind==='cpet');
  show($('cpet_block'), kind==='cpet');
  show($('report_card'), on);
  if(on){ suggestProtocol(); if(kind==='cpet'){ renderSpiroPred(); renderSpiroLMS(); } }
}

// Protocollo suggerito
function suggestProtocol(){
  const erg=$('ergotype').value, pa=n($('pa_hours').value), dx=($('dx').value||'').toLowerCase();
  let ramp=(erg==='tm')?1.0:15, start=(erg==='tm')?20:25, dur=8;
  if(pa>=5){ ramp=(erg==='tm')?1.2:20; start=(erg==='tm')?30:40; }
  if(dx.includes('ischemi')||dx.includes('scomp')){ ramp=(erg==='tm')?0.6:10; start=(erg==='tm')?15:20; }
  $('proto_text').innerHTML=`Suggerimento: rampa <b>${ramp} ${erg==='tm'?'km/h eq.':'W/min'}</b>, carico iniziale <b>${start} ${erg==='tm'?'%':'W'}</b>, durata target <b>${dur}–12 min</b>.`;
  return {ramp,start,dur};
}
$('apply_proto').addEventListener('click',()=>{
  const p=suggestProtocol(); if(exam==='watt'){ $('w_ramp').value=p.ramp; $('w_start').value=p.start; $('w_dur').value=p.dur; }
});

// Spirometria
function renderSpiroPred(){
  const age=n($('age').value), sex=$('sex').value, h=n($('height').value);
  const m=$('sp_method').value, box=$('sp_pred_box');
  if(!isFinite(age)||!isFinite(h)){ box.innerHTML='<span class="hint">Inserisci età e altezza…</span>'; return; }
  if(m==='lms_rn'){
    const p=lms_rn_predict(age,sex,h);
    box.innerHTML=`Predetti (LMS): FEV₁ <b>${p.FEV1_pred.toFixed(2)} L</b>, FVC <b>${p.FVC_pred.toFixed(2)} L</b>, rapporto <b>${(p.RAT_pred*100).toFixed(1)}%</b>`;
  } else {
    const q=quickPred(age,sex,h); box.innerHTML=`Stima rapida: FEV₁ ~ <b>${q.fev1.toFixed(2)} L</b>, FVC ~ <b>${q.fvc.toFixed(2)} L</b>`;
  }
}
function renderSpiroLMS(){
  const txt=$('sp_lms_text'), flag=$('sp_flag_box');
  if($('sp_method').value!=='lms_rn'){ txt.textContent='—'; flag.innerHTML=''; return; }
  const age=n($('age').value), sex=$('sex').value, h=n($('height').value);
  if(!isFinite(age)||!isFinite(h)){ txt.textContent='Inserisci età e altezza…'; flag.innerHTML=''; return; }
  const p=lms_rn_predict(age,sex,h);
  const FEV1=n($('sp_fev1').value), FVC=n($('sp_fvc').value);
  let ratio=n($('sp_ratio').value); if(!isFinite(ratio)&&isFinite(FEV1)&&isFinite(FVC)&&FVC>0) ratio=100*FEV1/FVC;
  const pR=p.RAT_pred*100;
  const z1=z_from_LMS(FEV1,p.L_FEV1,p.FEV1_pred,p.S_FEV1);
  const z2=z_from_LMS(FVC ,p.L_FVC ,p.FVC_pred ,p.S_FVC );
  const zR=z_from_LMS(ratio,p.L_RAT ,pR        ,p.S_RAT );
  const lln1=lln_from_LMS(p.L_FEV1,p.FEV1_pred,p.S_FEV1);
  const lln2=lln_from_LMS(p.L_FVC ,p.FVC_pred ,p.S_FVC );
  const llnR=lln_from_LMS(p.L_RAT ,pR         ,p.S_RAT );
  const pct1=isFinite(FEV1)?Math.round(100*FEV1/p.FEV1_pred):NaN;
  const pct2=isFinite(FVC)? Math.round(100*FVC /p.FVC_pred ):NaN;
  const pctR=isFinite(ratio)?Math.round(100*ratio/pR):NaN;
  txt.innerHTML = `FEV₁ pred: <b>${p.FEV1_pred.toFixed(2)} L</b>${isFinite(pct1)?' — '+pct1+'%':''}${isFinite(z1)?' — z '+z1.toFixed(2):''}${isFinite(lln1)?' — LLN '+lln1.toFixed(2)+' L':''}`+
                  ` • FVC pred: <b>${p.FVC_pred.toFixed(2)} L</b>${isFinite(pct2)?' — '+pct2+'%':''}${isFinite(z2)?' — z '+z2.toFixed(2):''}${isFinite(lln2)?' — LLN '+lln2.toFixed(2)+' L':''}`+
                  ` • Rapporto pred: <b>${pR.toFixed(1)}%</b>${isFinite(pctR)?' — '+pctR+'%':''}${isFinite(zR)?' — z '+zR.toFixed(2):''}${isFinite(llnR)?' — LLN '+llnR.toFixed(1)+'%':''}`;
  let msgs=[];
  if(isFinite(ratio)&&isFinite(llnR)&&ratio<llnR) msgs.push(`<span class="bad">Compatibile con ostruzione (rapporto sotto LLN)</span>`);
  if(isFinite(FVC)&&isFinite(lln2)&&FVC<lln2 && !(isFinite(ratio)&&isFinite(llnR)&&ratio<llnR)) msgs.push(`<span class="warn">Compatibile con riduzione FVC (possibile restrizione)</span>`);
  if(msgs.length===0) msgs.push(`<span class="ok">Valori spirometrici nei limiti rispetto ai predetti</span>`);
  flag.innerHTML=msgs.join('<br>');
}

// WATT
function HRmax_pred(age){ if(!isFinite(age))return NaN; return 208-0.7*age; }
function chronotropicReserve(age,HRrest,HRpeak){ const Hmax=HRmax_pred(age); if(![age,HRrest,HRpeak,Hmax].every(isFinite))return NaN; const num=HRpeak-HRrest, den=Hmax-HRrest; if(den<=0)return NaN; return num/den; }
function classifyCR(cr){ if(!isFinite(cr))return 'n.d.'; if(cr<0.62)return `${cr.toFixed(2)} — ridotta`; if(cr<0.80)return `${cr.toFixed(2)} — borderline`; return `${cr.toFixed(2)} — nei limiti`; }

function analyzeWatt(){
  const wmax=n($('r_wmax').value), kg=n($('weight').value);
  const wkg = isFinite(n($('r_wkg').value))? n($('r_wkg').value) : (isFinite(wmax)&&isFinite(kg)&&kg>0? wmax/kg : NaN);
  if(!isNaN(wkg)) $('r_wkg').value=wkg.toFixed(2);
  const hrrest=n($('r_hrrest').value), hrmax=n($('r_hrmax').value), pas=n($('r_pas').value);
  const dp = (isFinite(hrmax)&&isFinite(pas))? (hrmax*pas):NaN; if(isFinite(dp)) $('r_dp').value=dp;
  const dur=n($('r_dur').value);
  const mets=isFinite(wmax)?(wmax/70):NaN; if(isFinite(mets)) $('r_mets').value=mets.toFixed(1);
  const cr = chronotropicReserve(n($('age').value), hrrest, hrmax);
  const hrrec1=n($('r_hrrec1').value);
  const pressTrend = (isFinite(pas)&&pas>220)?'risposta ipertensiva possibile':'risposta pressoria nei limiti';
  $('watt_results').innerHTML = `Prestazione: <b>${fmt(wmax,'W')}</b> (${isFinite(wkg)?wkg.toFixed(2)+' W/kg':'n.d.'}), durata <b>${fmt(dur,'min')}</b>, METs ~ <b>${isFinite(mets)?mets.toFixed(1):'n.d.'}</b>.<br>`+
    `FC: riposo ${fmt(hrrest,'bpm')}, picco ${fmt(hrmax,'bpm')} — Riserva cronotropa: <b>${classifyCR(cr)}</b>. HRR 1' ${fmt(hrrec1,'bpm')}.<br>`+
    `Pressione: PAS/PAD picco ${fmt(n($('r_pas').value),'mmHg')}/${fmt(n($('r_pad').value),'mmHg')} — ${pressTrend}.`;
}
$('analyze_watt').addEventListener('click', analyzeWatt);

// CPET
$('analyze_cpet').addEventListener('click', ()=>{
  const age=n($('age').value);
  const [hr0,hrp]= ( $('r_hr_pair').value||'/' ).split('/').map(v=>n(v));
  const hrrest=isFinite(hr0)?hr0:n($('r_hrrest').value);
  const hrmax =isFinite(hrp)?hrp:n($('r_hrmax').value);
  const cr = chronotropicReserve(age, hrrest, hrmax);
  const vo2=n($('r_vo2').value), rer=n($('r_rer').value), slope=n($('r_vevco2').value);
  const slopeTxt = isFinite(slope)? `${slope.toFixed(1)} (${slope>34?'elevata':'nei limiti'})` : 'n.d.';
  const at = n($('r_at').value), br=n($('r_br').value), vemvv=n($('r_vemvv').value);
  const eqo2=n($('r_eqo2').value), eqco2=n($('r_eqco2').value), pet=n($('r_petco2').value), oues=n($('r_oues').value);
  const lines=[
    `VO₂ picco: <b>${fmt(vo2,'ml/min/kg')}</b>, RER: <b>${fmt(rer)}</b>, VE/VCO₂ slope: <b>${slopeTxt}</b>`,
    `Riserva cronotropa: <b>${classifyCR(cr)}</b>. AT: <b>${fmt(at,'ml/min/kg')}</b>, BR al picco: <b>${fmt(br,'%')}</b>, VE/MVV: <b>${fmt(vemvv,'%')}</b>`,
    `EqO₂: <b>${fmt(eqo2)}</b>, EqCO₂: <b>${fmt(eqco2)}</b>, PETCO₂ @AT: <b>${fmt(pet,'mmHg')}</b>, OUES: <b>${fmt(oues)}</b>`
  ];
  $('cpet_results').innerHTML = lines.join('<br>');
});

// Referti
function spiroSummaryShort(){
  const age=n($('age').value), sex=$('sex').value, h=n($('height').value);
  const FEV1=n($('sp_fev1').value), FVC=n($('sp_fvc').value);
  let ratio=n($('sp_ratio').value); if(!isFinite(ratio)&&isFinite(FEV1)&&isFinite(FVC)&&FVC>0) ratio=100*FEV1/FVC;
  const p=lms_rn_predict(age,sex,h); const pR=p.RAT_pred*100;
  const z1=z_from_LMS(FEV1,p.L_FEV1,p.FEV1_pred,p.S_FEV1);
  const z2=z_from_LMS(FVC ,p.L_FVC ,p.FVC_pred ,p.S_FVC );
  const zR=z_from_LMS(ratio,p.L_RAT ,pR        ,p.S_RAT );
  return `Spirometria: FEV₁ ${isFinite(FEV1)?FEV1.toFixed(2)+' L':'n.d.'} (z ${isFinite(z1)?z1.toFixed(2):'n.d.'}), FVC ${isFinite(FVC)?FVC.toFixed(2)+' L':'n.d.'} (z ${isFinite(z2)?z2.toFixed(2):'n.d.'}), rapporto ${isFinite(ratio)?ratio.toFixed(1)+'%':'n.d.'} (z ${isFinite(zR)?zR.toFixed(2):'n.d.'}).`;
}

function wattShortReport(){
  const wmax=n($('r_wmax').value), kg=n($('weight').value), wkg = isFinite(n($('r_wkg').value))? n($('r_wkg').value) : (isFinite(wmax)&&isFinite(kg)&&kg>0? wmax/kg:NaN);
  const mets=isFinite(wmax)? (wmax/70):NaN, dur=n($('r_dur').value);
  const cr = chronotropicReserve(n($('age').value), n($('r_hrrest').value), n($('r_hrmax').value));
  const rec1=n($('r_hrrec1').value);
  return `Watt test: carico max ${fmt(wmax,'W')} (${isFinite(wkg)?wkg.toFixed(2)+' W/kg':'n.d.'}), durata ${fmt(dur,'min')}. `+
         `Riserva cronotropa: ${classifyCR(cr)}. HR recovery 1': ${fmt(rec1,'bpm')}. METs stimati: ${isFinite(mets)?mets.toFixed(1):'n.d.'}.`;
}
function wattLongReport(){
  const ergo=$('ergotype').value==='tm'?'treadmill':'cicloergometro';
  const ramp=$('w_ramp').value||'n.d.', w0=$('w_start').value||'n.d.';
  const hrrest=$('r_hrrest').value||'n.d.', hrmax=$('r_hrmax').value||'n.d.', pas=$('r_pas').value||'n.d.', pad=$('r_pad').value||'n.d.';
  const wmax=$('r_wmax').value||'n.d.', mets=(+$('r_wmax').value/70)||NaN, dur=$('r_dur').value||'n.d.';
  return `Il test da sforzo al ${ergo} è stato eseguito con protocollo a rampa di ${ramp} W/min, carico iniziale ${w0} W.
Condizioni basali: FC ${hrrest} bpm, PA ${pas}/${pad} mmHg.
Carico massimo ${wmax} W (≈ ${isFinite(mets)?mets.toFixed(1):'n.d.'} METs) dopo ${dur} minuti. FC picco ${hrmax} bpm. Riserva cronotropa ${classifyCR(chronotropicReserve(n($('age').value), n($('r_hrrest').value), n($('r_hrmax').value)))}.
Risposta pressoria e sintomi riportati interpretati in modo neutro. Interpretazione contestuale ai predetti e al profilo clinico.`;
}

function cpetShortReport(){
  const age=n($('age').value);
  const [hr0,hrp]= ( $('r_hr_pair').value||'/' ).split('/').map(v=>n(v));
  const cr = chronotropicReserve(age, isFinite(hr0)?hr0:n($('r_hrrest').value), isFinite(hrp)?hrp:n($('r_hrmax').value));
  const vo2=n($('r_vo2').value), rer=n($('r_rer').value), slope=n($('r_vevco2').value);
  const slopeTxt = isFinite(slope)? `${slope.toFixed(1)} (${slope>34?'elevata':'nei limiti'})` : 'n.d.';
  const at=n($('r_at').value), br=n($('r_br').value);
  return `CPET: VO₂ picco ${fmt(vo2,'ml/min/kg')}, RER ${fmt(rer)}, VE/VCO₂ ${slopeTxt}. `+
         `AT ${fmt(at,'ml/min/kg')}, BR ${fmt(br,'%')}. `+
         `Riserva cronotropa: ${classifyCR(cr)}. `+ spiroSummaryShort();
}
function cpetLongReport(){
  const ergo=$('ergotype').value==='tm'?'treadmill':'cicloergometro';
  const vo2=$('r_vo2').value||'n.d.', rer=$('r_rer').value||'n.d.', dur=$('r_dur_c').value||'n.d.';
  const slope=$('r_vevco2').value||'n.d.', o2p=$('r_o2pulse').value||'n.d.', at=$('r_at').value||'n.d.', br=$('r_br').value||'n.d.';
  const vemvv=$('r_vemvv').value||'n.d.', eqo2=$('r_eqo2').value||'n.d.', eqco2=$('r_eqco2').value||'n.d.', pet=$('r_petco2').value||'n.d.', oues=$('r_oues').value||'n.d.';
  return `Il test cardiopolmonare è stato eseguito su ${ergo}. Parametri principali: VO₂ picco ${vo2} ml/min/kg, RER ${rer}, durata ${dur} min.
VE/VCO₂ slope ${slope}, O₂ pulse ${o2p}. Soglia anaerobica (AT) ${at} ml/min/kg, BR ${br}%, VE/MVV ${vemvv}%.
EqO₂ ${eqo2}, EqCO₂ ${eqco2}, PETCO₂ al AT ${pet} mmHg, OUES ${oues}.
${spiroSummaryShort()}
Interpretazione descrittiva e neutra basata sul confronto con i predetti e la clinica.`;
}

// Report buttons
$('short_rep').addEventListener('click',()=>{ $('report').value = (exam==='watt')?wattShortReport():cpetShortReport(); });
$('long_rep').addEventListener('click',()=>{ $('report').value = (exam==='watt')?wattLongReport():cpetLongReport(); });

// Bind inputs
['age','sex','height','weight','ergotype','pa_hours','dx','sp_fev1','sp_fvc','sp_ratio','sp_method'].forEach(id=>{
  const el=$(id); if(el) el.addEventListener('input', ()=>{ suggestProtocol(); if(exam==='cpet'){ renderSpiroPred(); renderSpiroLMS(); } });
});

// Init
setExam(null);
