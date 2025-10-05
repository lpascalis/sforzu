/* PWA */
let deferredPrompt; const installBtn=document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;installBtn.hidden=false;});
installBtn?.addEventListener('click',async()=>{installBtn.hidden=true;await deferredPrompt.prompt();deferredPrompt=null;});
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js');}

const $=(id)=>document.getElementById(id);

/* Wizard */
let MODE=null; // 'watt'|'cpet'
let DEVICE=null; // 'cycle'|'treadmill'
let SUGG=null;   // suggestion object

function goto(step){
  document.querySelectorAll('.step').forEach(s=>s.classList.remove('active'));
  const el=document.querySelector(`.step[data-step="${step}"]`); if(el){el.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'});}
  if(step==='0a') refreshDeviceStep();
  if(step===2) refreshProtocol();
  if(step===3) showStep3ForMode();
}
$('choose_watt').addEventListener('click',()=>{ MODE='watt'; goto('0a'); });
$('choose_cpet').addEventListener('click',()=>{ MODE='cpet'; goto('0a'); });
$('choose_cycle').addEventListener('click',()=>{ DEVICE='cycle'; goto(1); });
$('choose_treadmill').addEventListener('click',()=>{
  if(MODE==='watt'){ alert('Il Watt Test è supportato su cicloergometro. Passo al ciclo.'); DEVICE='cycle'; goto(1); return; }
  DEVICE='treadmill'; goto(1);
});

function refreshDeviceStep(){
  const note = (MODE==='watt')
    ? 'Per il Watt Test è raccomandato il cicloergometro; il treadmill verrà indirizzato al ciclo.'
    : 'Seleziona l’ergometro per il CPET. I suggerimenti di protocollo cambiano in base al dispositivo.';
  $('device_note').textContent = note;
}

/* Helpers */
function reqPos(v,n){ const x=+v; if(!isFinite(x)||x<=0) throw new Error(`${n}: inserire un valore > 0`); return x; }
function pct(a,b){ return (isFinite(a)&&isFinite(b)&&b>0)? 100*a/b : NaN; }
function round(x,n=0){ const p=10**n; return Math.round(x*p)/p; }
function hrPred(age, formula){ return formula==='tanaka' ? (208 - 0.7*age) : (220 - age); }

/* Predetti rapidi (educativi) */
function quickPred(age,sex,h_cm){
  const h=h_cm/100; let fev1,fvc;
  if(sex==='M'){ fev1=0.553*Math.pow(h,2.6) - 0.013*age; fvc=0.578*Math.pow(h,2.9) - 0.015*age; }
  else{ fev1=0.433*Math.pow(h,2.6) - 0.011*age; fvc=0.489*Math.pow(h,2.9) - 0.013*age; }
  fev1=Math.max(0.8,fev1); fvc=Math.max(1.0,fvc);
  let vo2kg=(sex==='M'?50:42) - 0.25*age; vo2kg=Math.max(14,vo2kg);
  return {fev1,fvc,vo2kg};
}
document.addEventListener('click',(e)=>{
  if(e.target&&e.target.id==='wiz_calc'){try{
    const age=reqPos(($('wiz_age')||{}).value||$('age').value,'Età'), sex=($('wiz_sex')||{}).value||$('sex').value, h=reqPos(($('wiz_h')||{}).value||$('height').value,'Altezza');
    const p=quickPred(age,sex,h);
    $('wiz_out').innerHTML=`<p>Predetti rapidi → FEV₁ ≈ <b>${p.fev1.toFixed(2)} L</b>, FVC ≈ <b>${p.fvc.toFixed(2)} L</b>, VO₂/kg ≈ <b>${p.vo2kg.toFixed(1)}</b> mL·kg⁻¹·min⁻¹</p>`;
  }catch(err){ $('wiz_out').innerHTML=`<p style="color:#ff8a8a">⚠️ ${err.message}</p>`; }}
  if(e.target&&e.target.id==='wiz_apply'){try{
    const age=reqPos(($('wiz_age')||{}).value||$('age').value,'Età'), sex=($('wiz_sex')||{}).value||$('sex').value, h=reqPos(($('wiz_h')||{}).value||$('height').value,'Altezza');
    const p=quickPred(age,sex,h);
    if($('sp_fev1_pred')) $('sp_fev1_pred').value=p.fev1.toFixed(2);
    if($('sp_fvc_pred')) $('sp_fvc_pred').value=p.fvc.toFixed(2);
    $('wiz_out').innerHTML='<p>Predetti applicati.</p>';
  }catch(err){ $('wiz_out').innerHTML=`<p style="color:#ff8a8a">⚠️ ${err.message}</p>`; }}
});

/* STEP1 → Calcola predetti, mostra suggerimento e continua */
$('step1_next').addEventListener('click',()=>{
  try{
    const age=reqPos($('age').value,'Età'), sex=$('sex').value, h=reqPos($('height').value,'Altezza'), w=reqPos($('weight').value,'Peso');
    const train = +$('train_h').value || 0;
    const flags = {
      ihd: $('p_ihd').checked, hf: $('p_hf').checked, copd: $('p_copd').checked, ob: $('p_ob').checked, elder: $('p_elder').checked, ath: $('p_ath').checked, bb: $('p_bb').checked
    };

    let base=quickPred(age,sex,h).vo2kg;
    if(flags.hf) base*=0.78;
    if(flags.copd) base*=0.85;
    if(flags.ob) base*=0.92;
    if(flags.elder) base*=0.92;
    if(flags.ath) base*=1.10;
    const vo2kg_pred=round(base,1), vo2_pred=round(vo2kg_pred*w,0), mets_pred=round(vo2kg_pred/3.5,1);

    let spiroTxt=''; let MVV=NaN;
    if(MODE==='cpet'){
      const FEV1= +$('sp_fev1').value, FVC= +$('sp_fvc').value;
      let ratio= +$('sp_ratio').value; if(!isFinite(ratio)&&isFinite(FEV1)&&isFinite(FVC)&&FVC>0) ratio=100*FEV1/FVC;
      MVV = isFinite(+$('sp_mvv').value)? +$('sp_mvv').value : (isFinite(FEV1)? 40*FEV1: NaN);
      const LLN= +$('sp_ratio_lln').value || 70; const ratioAbn= isFinite(ratio)? (ratio<LLN): false;
      const fev1pred= +$('sp_fev1_pred').value, fvcpred= +$('sp_fvc_pred').value;
      const fev1pct=pct(FEV1,fev1pred), fvcpct=pct(FVC,fvcpred);
      let pattern='';
      if(ratioAbn && isFinite(fev1pct)) pattern='Ostruttivo' + (fev1pct<50?' severo':(fev1pct<80?' moderato':' lieve'));
      else if(!ratioAbn && isFinite(fvcpct) && fvcpct<80) pattern='Restrittivo (sospetto)';
      if(ratioAbn && isFinite(fvcpct) && fvcpct<80) pattern='Misto';
      spiroTxt=`Spirometria: ${isFinite(ratio)?'FEV₁/FVC '+ratio.toFixed(1)+'% (LLN '+LLN+'%) — ':''}${pattern||'n.d.'}. MVV ${isFinite(MVV)? Math.round(MVV):'n.d.'} L/min.`;
    }

    $('pred_summary').innerHTML=`<p><b>Predetti</b> — VO₂ ≈ <b>${vo2_pred} mL/min</b> (${vo2kg_pred} mL·kg⁻¹·min⁻¹; <b>${mets_pred} METs</b>). ${spiroTxt}</p>`;

    // Build suggestion based on device, training hours and flags
    SUGG = { device: DEVICE, mode: MODE };
    if(DEVICE==='cycle'){
      let inc = 15, start = 20, t=10, note=[];
      const lowFitness = (vo2kg_pred<20) || (train<1) || flags.elder || flags.hf;
      const highFitness = (vo2kg_pred>40) || flags.ath || (train>=5);
      if(lowFitness){ inc=10; start=10; t=10; note.push('profilo a bassa capacità: rampa delicata 10 W/min'); }
      else if(highFitness){ inc=25; start=30; t=10; note.push('profilo atleta/allenato: rampa 20–30 W/min'); }
      else { inc=15; start=20; t=10; note.push('profilo intermedio: rampa 15 W/min'); }
      if(flags.ihd || flags.bb){ inc=Math.min(inc,15); start=Math.min(start,20); note.push('cardiopatia ischemica/beta-blocco: evitare ramp troppo ripide'); }
      SUGG.cycle={type:'ramp', target_min:t, start_w:start, inc_w:inc, step_min:2, gain:10, rationale:note.join('; ')};
      $('proto_sug_text').innerHTML = `<p><b>Cicloergometro</b> — Rampa consigliata: start ${start} W, +${inc} W/min, durata target ${t} min. <br><span class="hint">${SUGG.cycle.rationale}</span></p>`;
    } else {
      // Treadmill suggestion
      let proto='ramp_tm', t=10, speed0=3.0, grade0=0, ds=0.2, dg=1, stepmin=1, title='Rampa personalizzata';
      const lowFitness = (vo2kg_pred<20) || (train<1) || flags.elder || flags.hf;
      const highFitness = (vo2kg_pred>40) || flags.ath || (train>=5);
      if((flags.hf || flags.elder)){ proto='naughton'; title='Naughton'; speed0=2.5; grade0=0; ds=0.1; dg=1; stepmin=2; t=10; }
      else if(flags.ihd && !highFitness){ proto='mod_bruce'; title='Modified Bruce'; speed0=2.7; grade0=0; ds=0.1; dg=2; stepmin=3; t=12; }
      else if(highFitness){ proto='bruce'; title='Bruce'; speed0=4.0; grade0=10; ds=0.3; dg=2; stepmin=3; t=10; }
      const note = (proto==='ramp_tm') ? 'rampa dolce: +0.2 km/h e +1% pendenza ogni 1′' :
                    (proto==='mod_bruce') ? 'avvio graduale; adatto a decondizionati/coronari non severi' :
                    (proto==='naughton') ? 'incrementi leggeri, indicato in HF/anziani' :
                    'incrementi sostenuti, adatto a soggetti allenati';
      SUGG.treadmill={proto, target:t, speed0, grade0, ds, dg, stepmin, rationale:note, title};
      $('proto_sug_text').innerHTML = `<p><b>Treadmill</b> — ${title}: start ${speed0} km/h @ ${grade0}%, step ${stepmin}′, +${ds} km/h & +${dg}%/step, target ${t} min.<br><span class="hint">${note}</span></p>`;
    }
    $('proto_suggestion').classList.remove('hidden');
    goto(2);
  }catch(e){ $('pred_summary').innerHTML=`<p style="color:#ff8a8a">⚠️ ${e.message}</p>`; }
});

/* Copy suggestion */
$('copy_suggestion').addEventListener('click',()=>{
  if(!SUGG) return;
  if(DEVICE==='cycle' && SUGG.cycle){
    $('proto_type').value='ramp';
    $('target_min').value=SUGG.cycle.target_min;
    $('start_w').value=SUGG.cycle.start_w;
    $('inc_w').value=SUGG.cycle.inc_w;
    $('step_min').value=SUGG.cycle.step_min;
    $('gain').value=SUGG.cycle.gain;
  }
  if(DEVICE==='treadmill' && SUGG.treadmill){
    $('tm_proto').value=SUGG.treadmill.proto;
    $('tm_target').value=SUGG.treadmill.target;
    $('tm_speed0').value=SUGG.treadmill.speed0;
    $('tm_grade0').value=SUGG.treadmill.grade0;
    $('tm_dspeed').value=SUGG.treadmill.ds;
    $('tm_dgrade').value=SUGG.treadmill.dg;
    $('tm_stepmin').value=SUGG.treadmill.stepmin;
  }
  refreshProtocol();
  alert('Parametri suggeriti copiati nel protocollo.');
});

/* Treadmill VO2/METs estimation */
function vo2kgFromTm(speed_kmh, grade_pct){
  const s = speed_kmh*16.6667; // m/min
  const G = grade_pct/100;
  if(!isFinite(s) || s<=0) return NaN;
  const vo2 = (s>=134) ? (0.2*s + 0.9*s*G + 3.5) : (0.1*s + 1.8*s*G + 3.5);
  return vo2; // mL/kg/min
}
function tmEstimatePeak(){
  const t = +$('tm_target').value||10, sm= +$('tm_stepmin').value||1;
  const nSteps = Math.max(1, Math.round(t/sm));
  const s0 = +$('tm_speed0').value||3.0, g0= +$('tm_grade0').value||0;
  const ds = +$('tm_dspeed').value||0.2, dg= +$('tm_dgrade').value||1;
  const s_peak = s0 + ds*(nSteps-1);
  const g_peak = g0 + dg*(nSteps-1);
  const vo2_start = vo2kgFromTm(s0,g0);
  const vo2_peak = vo2kgFromTm(s_peak,g_peak);
  const mets_start = isFinite(vo2_start)? vo2_start/3.5 : NaN;
  const mets_peak = isFinite(vo2_peak)? vo2_peak/3.5 : NaN;
  return {nSteps, s0, g0, s_peak, g_peak, mets_start, mets_peak, vo2_peak};
}

/* Protocol UI refresh */
function refreshProtocol(){
  // Toggle cycle/tm blocks
  const tm = (DEVICE==='treadmill');
  if(tm){ $('cycle_block').classList.add('hidden'); $('tm_block').classList.remove('hidden'); }
  else { $('tm_block').classList.add('hidden'); $('cycle_block').classList.remove('hidden'); }

  let txt='';
  if(!tm){
    const mode=$('proto_type').value, t= +$('target_min').value||10, start= +$('start_w').value||20, gain= +$('gain').value||10;
    let inc= +$('inc_w').value||15;
    if(mode==='ramp'){
      const vo2= parseFloat(($('pred_summary').innerText.match(/VO₂ ≈ (\d+)/)||[])[1]) || (250+(t-8)*80);
      const targetW= start + Math.max(0, Math.round((vo2-250)/gain));
      const steps=Math.max(8,Math.round(t));
      inc=Math.max(5, Math.round((targetW-start)/steps/5)*5);
      const endW=start+inc*steps;
      txt=`Rampa ciclo: +${inc} W/min da ${start} W → fine ≈ ${endW} W.`;
    }else if(mode==='step'){
      const stepMin= +$('step_min').value||2; const nSteps=Math.max(3,Math.round(t/stepMin));
      const endW=start+inc*(nSteps-1);
      txt=`Step ciclo: ${nSteps} × ${stepMin}' con +${inc} W → ultimo ${endW} W.`;
    }else if(mode==='constant'){
      txt=`Ciclo a carico costante: ${start} W per ${t} minuti.`;
    }else if(mode==='monark'){
      txt=`Monark: usa il convertitore kgf↔W (W = 6.12×kgf×rpm).`;
    }
    $('monark_block').style.display=(mode==='monark'?'block':'none');
    $('tm_mets_card').classList.add('hidden');
  } else {
    const proto=$('tm_proto').value, t= +$('tm_target').value||10;
    const s0= +$('tm_speed0').value||3, g0= +$('tm_grade0').value||0, ds= +$('tm_dspeed').value||0.2, dg= +$('tm_dgrade').value||1, sm= +$('tm_stepmin').value||1;
    if(proto==='ramp_tm'){
      txt=`Rampa treadmill: start ${s0} km/h @ ${g0}%, step ${sm}' con +${ds} km/h e +${dg}% per step, target ${t} min.`;
    } else if(proto==='mod_bruce'){
      txt=`Treadmill: Modified Bruce (impostazioni suggerite progressivamente crescenti).`;
    } else if(proto==='bruce'){
      txt=`Treadmill: Bruce standard per soggetti allenati.`;
    } else if(proto==='naughton'){
      txt=`Treadmill: Naughton (incrementi leggeri, utile in HF/anziani).`;
    } else if(proto==='balke'){
      txt=`Treadmill: Balke (incrementi graduali soprattutto di pendenza).`;
    }
    $('tm_mets_card').classList.remove('hidden');
    // Show METs preview (only meaningful in CPET)
    const ps=$('pred_summary').innerText.match(/; <b>([\d\.]+) METs<\/b>/); const mets_pred = ps? parseFloat(ps[1]) : NaN;
    const est = tmEstimatePeak();
    let line = `• Stima METs start: ${isFinite(est.mets_start)? est.mets_start.toFixed(1):'n.d.'} — picco: ${isFinite(est.mets_peak)? est.mets_peak.toFixed(1):'n.d.'}`;
    if(isFinite(mets_pred)&&isFinite(est.mets_peak)){ const pct = Math.round(100*est.mets_peak/mets_pred); line += ` (≈ ${pct}% dei METs predetti)`; }
    $('tm_mets_out').innerHTML = `<p>${line}</p>`;
  }
  $('proto_out').innerHTML=`<p>${txt}</p>`;
}
['proto_type','target_min','start_w','inc_w','step_min','gain','tm_proto','tm_target','tm_speed0','tm_grade0','tm_dspeed','tm_dgrade','tm_stepmin'].forEach(id=>{ const el=$(id); if(el) el.addEventListener('input',refreshProtocol); });

/* Copy treadmill estimate into CPET VO2/kg */
$('tm_copy_to_cpet').addEventListener('click',()=>{
  if(!(MODE==='cpet' && DEVICE==='treadmill')){ alert('Disponibile solo in CPET su treadmill.'); return; }
  const est = tmEstimatePeak();
  if(isFinite(est.vo2_peak)){ $('r_vo2kg').value = est.vo2_peak.toFixed(1); alert('VO₂/kg stimato dal protocollo copiato nei risultati CPET.'); }
  else { alert('Impossibile stimare VO₂/kg: controlla velocità/pendenza/step.'); }
});

/* Navigation */
$('back_to_1').addEventListener('click',()=>goto(1));
$('back_to_2a')?.addEventListener('click',()=>goto(2));
$('step2_next').addEventListener('click',()=>goto(3));

/* Step3 visibility */
function showStep3ForMode(){
  const wf=$('watt_fields'), cf=$('cpet_fields'), wc=$('watt_criteria');
  if(MODE==='watt'){ wf.classList.remove('hidden'); wc.classList.remove('hidden'); cf.classList.add('hidden'); }
  else { cf.classList.remove('hidden'); wf.classList.add('hidden'); wc.classList.add('hidden'); }
}

/* Monark */
$('m_from_kgf').addEventListener('click',()=>{const rpm=+$('m_rpm').value||60, kgf=+$('m_kgf').value||0; const w=6.12*rpm*kgf; $('m_w').value=Math.round(w); $('m_out').innerHTML=`<p>W = 6.12 × ${kgf} × ${rpm} ≈ <b>${Math.round(w)} W</b></p>`;});
$('m_from_w').addEventListener('click',()=>{const rpm=+$('m_rpm').value||60, w=+$('m_w').value||0; const kgf=w/(6.12*rpm); $('m_kgf').value=kgf.toFixed(2); $('m_out').innerHTML=`<p>kgf ≈ <b>${kgf.toFixed(2)}</b> (a ${rpm} rpm)</p>`;});

/* Prediction utils placeholders (kept for report calculations) */
function wpredFromVO2pred(vo2_pred, gain, intercept=250){ if(!isFinite(vo2_pred)) return NaN; return Math.max(0,(vo2_pred - intercept)/gain); }
function wpredFromMets(age,sex,weight,gain,intercept=250){ const m = ((sex==='M') ? (14 - 0.10*age) : (12 - 0.10*age)); const mC = Math.max(5, Math.min(16, m)); const vo2 = mC*3.5*weight; return wpredFromVO2pred(vo2,gain,intercept); }

/* STEP 3 → Analizza risultati (logica v6.5, aggiunge intestazione ergometro) */
$('step3_next').addEventListener('click',()=>{
  try{
    const ps=document.getElementById('pred_summary').innerText.match(/VO₂ ≈ (\d+) mL\/min \(([\d\.]+) mL·kg⁻¹·min⁻¹; <b>([\d\.]+) METs<\/b>\)/);
    const vo2_pred= ps? +ps[1] : NaN;
    const vo2kg_pred= ps? +ps[2] : NaN;
    const mets_pred= ps? +ps[3] : NaN;
    const w= +$('weight').value||NaN; const age= +$('age').value||NaN; const sex=$('sex').value;
    const gain= +$('gain').value || 10; const intercept=250;

    if(MODE==='watt'){
      const wpeak= +$('r_wpeak').value||NaN;
      let wkg= +$('r_wkg').value||NaN; if(!isFinite(wkg)&&isFinite(wpeak)&&isFinite(w)&&w>0) wkg=wpeak/w;
      const dur= +$('r_dur').value||NaN;

      const hrrest= +$('r_hrrest_w').value||NaN;
      const hrmax= +$('r_hrmax_w').value||NaN;
      const hr1= +$('r_hr1_w').value||NaN;
      const hr3= +$('r_hr3_w').value||NaN;

      const spo2= +$('r_spo2_w').value||NaN;
      const borg= +$('r_borg_w').value||NaN;

      const sbp_rest= +$('r_sbp_rest').value||NaN;
      const dbp_rest= +$('r_dbp_rest').value||NaN;
      const sbp= +$('r_sbp').value||NaN;
      const dbp= +$('r_dbp').value||NaN;
      const sbp1= +$('r_sbp1').value||NaN;
      const dbp1= +$('r_dbp1').value||NaN;
      const sbp3= +$('r_sbp3').value||NaN;
      const dbp3= +$('r_dbp3').value||NaN;

      const hr_formula = $('hrmax_formula').value;
      const hrmax_pred = hrPred(age, hr_formula);
      const hr_pct = (isFinite(hrmax)&&isFinite(hrmax_pred))? 100*hrmax/hrmax_pred : NaN;
      const ci = (isFinite(hrmax)&&isFinite(hrrest)&&isFinite(hrmax_pred)&&hrmax_pred>hrrest) ? ( (hrmax-hrrest)/(hrmax_pred-hrrest) ) : NaN;
      const hrr1 = (isFinite(hrmax)&&isFinite(hr1))? (hrmax-hr1) : NaN;
      const hrr3 = (isFinite(hrmax)&&isFinite(hr3))? (hrmax-hr3) : NaN;

      const wpred_vo2 = wpredFromVO2pred(vo2_pred, gain, intercept);
      const wpred_mets = wpredFromMets(age, sex, w, gain, intercept);
      const wpred_main = wpred_vo2;
      const wpct_main = (isFinite(wpeak)&&isFinite(wpred_main)&&wpred_main>0)? 100*wpeak/wpred_main : NaN;

      let vo2kg_est= (isFinite(wpeak)&&isFinite(w)&&w>0)? (10.8*wpeak/w + 7) : NaN;
      const vo2_est = isFinite(vo2kg_est)&&isFinite(w)? vo2kg_est*w : NaN;
      const vo2kg_pct= (isFinite(vo2kg_est)&&isFinite(vo2kg_pred))? 100*vo2kg_est/vo2kg_pred : NaN;
      const mets = isFinite(vo2kg_est)? vo2kg_est/3.5 : NaN;
      const mets_pct = (isFinite(mets)&&isFinite(mets_pred)&&mets_pred>0)? 100*mets/mets_pred : NaN;

      const dSBP = (isFinite(sbp)&&isFinite(sbp_rest))? (sbp - sbp_rest) : NaN;
      let pressorTxt='n.d.'; if(isFinite(dSBP)){ pressorTxt = dSBP>=30 ? 'adeguato' : (dSBP>=20?'ai limiti (≥20 mmHg)':'ridotto'); }
      const dp_rest = (isFinite(hrrest)&&isFinite(sbp_rest))? hrrest*sbp_rest : NaN;
      const dp_peak = (isFinite(hrmax)&&isFinite(sbp))? hrmax*sbp : NaN;
      const dp1 = (isFinite(hr1)&&isFinite(sbp1))? hr1*sbp1 : NaN;
      const dp3 = (isFinite(hr3)&&isFinite(sbp3))? hr3*sbp3 : NaN;
      const pressorFlags=[];
      if(isFinite(sbp)&&sbp>250) pressorFlags.push('ipertensione da sforzo (SBP >250)');
      if(isFinite(dbp)&&dbp>115) pressorFlags.push('ipertensione diastolica da sforzo (DBP >115)');
      if(isFinite(dSBP)&&dSBP<10) pressorFlags.push('risposta ipotensiva/flat della SBP');

      let maximal= false;
      if(isFinite(hr_pct) && hr_pct>=85) maximal=true;
      if(isFinite(borg) && borg>=17) maximal=true;
      let effortTxt = maximal? 'Criteri di sforzo adeguati.' : 'Possibile sforzo submassimale.';
      let satTxt=''; if(isFinite(spo2)){ if(spo2<94) satTxt='Desaturazione significativa.'; else satTxt='Saturazione nei limiti.' }

      const crit=[];
      ['c_angina','c_drop_sbp','c_hypertension','c_arrhythmia','c_syncope','c_hypoperfusion','c_spo2','c_dyspnea'].forEach(id=>{ const el=$(id); if(el&&el.checked){ const label=el.parentElement.textContent.trim(); crit.push(label); }});

      let rep='';
      rep += `DISPOSITIVO: Cicloergometro — Modalità: Watt Test\n\n`;
      rep += `PARAMETRI DI CARICO E PERFORMANCE\n`;
      if(isFinite(wpeak)) rep += `• Watt di picco: ${Math.round(wpeak)} W` + (isFinite(wkg)? ` (${wkg.toFixed(2)} W/kg)`:'') + (isFinite(dur)? ` — durata ${dur} min`:'') + `\n`;
      if(isFinite(wpred_vo2)) rep += `• Wprev (VO₂ pred + ΔVO₂/ΔW): ≈ ${Math.round(wpred_vo2)} W` + (isFinite(wpeak)&&wpred_vo2>0? ` — ${Math.round(100*wpeak/wpred_vo2)}% del previsto`:'') + `\n`;
      if(isFinite(wpred_mets)) rep += `• Wprev (METs rif. età/sesso): ≈ ${Math.round(wpred_mets)} W` + (isFinite(wpeak)&&wpred_mets>0? ` — ${Math.round(100*wpeak/wpred_mets)}%`:'') + `\n`;
      if(isFinite(vo2kg_est)) rep += `• VO₂ stimato: ${Math.round(vo2_est||0)} mL/min (${vo2kg_est.toFixed(1)} mL·kg⁻¹·min⁻¹; ${isFinite(mets)? mets.toFixed(1):'n.d.'} METs)` + (isFinite(vo2kg_pred)? ` — predetti ${vo2kg_pred.toFixed(1)} mL·kg⁻¹·min⁻¹ (${mets_pred} METs)`:'') + (isFinite(vo2kg_pct)? ` — ${Math.round(vo2kg_pct)}% del predetto`:'') + `\n`;

      rep += `\nPARAMETRI EMODINAMICI\n`;
      if(isFinite(hrrest)) rep += `• FC riposo: ${Math.round(hrrest)} bpm. `;
      if(isFinite(hrmax)) rep += `FC picco: ${Math.round(hrmax)} bpm (${isFinite(hr_pct)? Math.round(hr_pct):'n.d.'}% del teorico ${Math.round(hrmax_pred)}). `;
      if(isFinite(hrr1)) rep += `HRR 1′: ${Math.round(hrr1)} bpm. `;
      if(isFinite(hrr3)) rep += `HRR 3′: ${Math.round(hrr3)} bpm.\n`;
      if(isFinite(dp_rest)||isFinite(dp_peak)) rep += `• Doppio prodotto (HR×SBP): riposo ${isFinite(dp_rest)? Math.round(dp_rest):'n.d.'}, picco ${isFinite(dp_peak)? Math.round(dp_peak):'n.d.'}` + (isFinite(dp1)||isFinite(dp3)? `; 1′ ${isFinite(dp1)? Math.round(dp1):'n.d.'}, 3′ ${isFinite(dp3)? Math.round(dp3):'n.d.'}`:'') + `.\n`;
      if(isFinite(sbp_rest)||isFinite(sbp)) rep += `• Pressione: riposo ${isFinite(sbp_rest)? sbp_rest:''}/${isFinite(dbp_rest)? dbp_rest:''} → picco ${isFinite(sbp)? sbp:''}/${isFinite(dbp)? dbp:''} mmHg. Riserva pressoria: ${pressorTxt}.` + (pressorFlags.length? ` Segnali: ${pressorFlags.join(', ')}.`:'') + `\n`;
      if(crit.length){ rep += `\nCRITERI DI INTERRUZIONE OSSERVATI (promemoria)\n- ` + crit.join('\n- ') + `\n`; }

      rep += `\nSINTESI CLINICA\n`;
      const flags=[];
      if(isFinite(wpct_main)&&wpct_main<80 && (isFinite(hr_pct)? hr_pct>=85:false)) flags.push('% Wpeak <80% del previsto (metodo VO₂) con sforzo adeguato');
      if(isFinite(wpct_main)&&wpct_main<80 && (!isFinite(hr_pct) || hr_pct<85)) flags.push('% Wpeak <80% (potenziale sforzo non massimale)');
      if(isFinite(vo2kg_pct)&&vo2kg_pct<80) flags.push('ridotta capacità aerobica (stima)');
      if(isFinite(hrr1)&&hrr1<12) flags.push('HRR 1′ ridotto');
      if(isFinite(spo2)&&spo2<94) flags.push('desaturazione sotto sforzo');
      if(pressorFlags.length) flags.push('anomalie pressorie da sforzo');
      rep += (flags.length? ('Quadro compatibile con '+flags.join(', ')+'.') : 'Assenza di alterazioni di rilievo in base ai parametri inseriti.') + `\n`;

      $('report').textContent=rep; goto(4);
      return;
    }

    // ---- CPET path ----
    const vo2pk= +$('r_vo2pk').value||NaN; let vo2kg= +$('r_vo2kg').value||NaN; if(!isFinite(vo2kg)&&isFinite(vo2pk)&&isFinite(w)&&w>0) vo2kg=vo2pk/w;
    const slope= +$('r_slope').value||NaN, oues= +$('r_oues').value||NaN, vemax= +$('r_vemax').value||NaN;
    const hrrest= +$('r_hrrest').value||NaN, hrmax= +$('r_hrmax').value||NaN, hr1= +$('r_hr1').value||NaN, hr3= +$('r_hr3').value||NaN;
    const rer= +$('r_rer').value||NaN, spo2= +$('r_spo2').value||NaN, borg= +$('r_borg').value||NaN;
    const sbp_rest= +$('c_sbp_rest').value||NaN, dbp_rest= +$('c_dbp_rest').value||NaN, sbp= +$('c_sbp').value||NaN, dbp= +$('c_dbp').value||NaN;
    const sbp1= +$('c_sbp1').value||NaN, dbp1= +$('c_dbp1').value||NaN, sbp3= +$('c_sbp3').value||NaN, dbp3= +$('c_dbp3').value||NaN;

    const hr_formula = $('hrmax_formula').value;
    const hrmax_pred = hrPred(age, hr_formula);
    const hr_pct = (isFinite(hrmax)&&isFinite(hrmax_pred))? 100*hrmax/hrmax_pred : NaN;
    const hrr1 = (isFinite(hrmax)&&isFinite(hr1))? (hrmax-hr1) : NaN;
    const hrr3 = (isFinite(hrmax)&&isFinite(hr3))? (hrmax-hr3) : NaN;

    let fev1= +$('sp_fev1').value||NaN; let mvv= +$('sp_mvv').value||NaN; if(!isFinite(mvv)&&isFinite(fev1)) mvv=40*fev1;
    const BR= (isFinite(mvv)&&isFinite(vemax))? 100*(1 - vemax/mvv) : NaN;
    const vo2kg_pct= (isFinite(vo2kg)&&isFinite(vo2kg_pred))? 100*vo2kg/vo2kg_pred : NaN;

    function class3(v,low,high){ if(!isFinite(v)) return 'n.d.'; return v<low?'basso':(v>high?'alto':'nei limiti'); }
    const slopeTxt=class3(slope,36,40);
    let eff=''; if(isFinite(vo2kg_pct)){ eff = vo2kg_pct<50?'marcatamente ridotta':(vo2kg_pct<80?'ridotta':'nei limiti'); }

    const dSBP = (isFinite(sbp)&&isFinite(sbp_rest))? (sbp - sbp_rest) : NaN;
    let pressorTxt='n.d.'; if(isFinite(dSBP)){ pressorTxt = dSBP>=30 ? 'adeguato' : (dSBP>=20?'ai limiti (≥20 mmHg)':'ridotto'); }
    const dp_rest = (isFinite(hrrest)&&isFinite(sbp_rest))? hrrest*sbp_rest : NaN;
    const dp_peak = (isFinite(hrmax)&&isFinite(sbp))? hrmax*sbp : NaN;
    const dp1 = (isFinite(hr1)&&isFinite(sbp1))? hr1*sbp1 : NaN;
    const dp3 = (isFinite(hr3)&&isFinite(sbp3))? hr3*sbp3 : NaN;

    const mets_pred_c = isFinite(vo2kg_pred)? round(vo2kg_pred/3.5,1) : NaN;
    // Also compute treadmill estimate if on treadmill
    let tm_line=''; if(DEVICE==='treadmill'){ const est=tmEstimatePeak(); if(isFinite(est.mets_peak)){ const pct = isFinite(mets_pred_c)&&mets_pred_c>0 ? Math.round(100*est.mets_peak/mets_pred_c) : NaN; tm_line=`Stima METs dal protocollo treadmill: ${est.mets_peak.toFixed(1)}` + (isFinite(pct)? ` (${pct}% dei predetti).` : '.'); } }

    let rep='';
    rep += `DISPOSITIVO: ${DEVICE==='treadmill'?'Treadmill':'Cicloergometro'} — Modalità: CPET\n\n`;
    rep += `EFFICIENZA GLOBALE\n`;
    rep += `La capacità aerobica massimale risulta ${eff}` + (isFinite(vo2kg)? `, con VO₂ peak pari a ${round(vo2kg,1)} mL·kg⁻¹·min⁻¹`:'') + (isFinite(vo2kg_pct)? ` (${round(vo2kg_pct)}% del predetto)`:'') + `.\n`;
    if(isFinite(vo2pk)) rep += `VO₂ peak assoluto: ${Math.round(vo2pk)} mL/min.\n`;
    if(isFinite(mets_pred_c)) rep += `METs predetti: ${mets_pred_c}.\n`;
    if(tm_line) rep += tm_line + '\n';

    rep += `\nVENTILAZIONE\n`;
    if(isFinite(slope)) rep += `VE/VCO₂ slope ${round(slope,1)} (${slopeTxt}); `;
    if(isFinite(BR)) rep += `BR ${round(BR)}%. `;
    if(isFinite(oues)) rep += `OUES ${round(oues,2)}.`;

    rep += `\n\nRISPOSTA CARDIACA ED EMODINAMICA\n`;
    if(isFinite(hrrest)) rep += `FC riposo ${Math.round(hrrest)} bpm; `;
    if(isFinite(hrmax)) rep += `picco ${Math.round(hrmax)} bpm (${isFinite(hr_pct)? Math.round(hr_pct):'n.d.'}% del teorico ${Math.round(hrmax_pred)}). `;
    if(isFinite(hrr1)) rep += `HRR 1′ ${Math.round(hrr1)} bpm; `;
    if(isFinite(hrr3)) rep += `HRR 3′ ${Math.round(hrr3)} bpm.\n`;
    if(isFinite(dp_rest)||isFinite(dp_peak)) rep += `Doppio prodotto: riposo ${isFinite(dp_rest)? Math.round(dp_rest):'n.d.'}, picco ${isFinite(dp_peak)? Math.round(dp_peak):'n.d.'}` + (isFinite(dp1)||isFinite(dp3)? `; 1′ ${isFinite(dp1)? Math.round(dp1):'n.d.'}, 3′ ${isFinite(dp3)? Math.round(dp3):'n.d.'}`:'') + `.\n`;
    if(isFinite(sbp_rest)||isFinite(sbp)) rep += `Pressione: ${isFinite(sbp_rest)? sbp_rest:''}/${isFinite(dbp_rest)? dbp_rest:''} → ${isFinite(sbp)? sbp:''}/${isFinite(dbp)? dbp:''} mmHg. Riserva pressoria ${pressorTxt}.\n`;

    rep += `\n\nSCAMBI GASSOSI E SATURAZIONE\n`;
    if(isFinite(rer)) rep += `RER max ${round(rer,2)}, ` + (rer>=1.10?'coerente con sforzo massimale.':'che potrebbe indicare sforzo non pienamente massimale.') + ` `;
    if(isFinite(spo2)) rep += `SpO₂ nadir ${Math.round(spo2)}%.`;

    rep += `\n\nSINTESI CLINICA\n`;
    const flags=[];
    if(isFinite(vo2kg_pct)&&vo2kg_pct<80) flags.push('ridotta capacità aerobica');
    if(isFinite(slope)&&slope>=36&&slope<40) flags.push('inefficienza ventilatoria lieve-intermedia');
    if(isFinite(slope)&&slope>=40) flags.push('inefficienza ventilatoria moderata-severa');
    if(isFinite(hrr1)&&hrr1<12) flags.push('HRR 1′ ridotto');
    if(isFinite(dSBP)&&dSBP<20) flags.push('riserva pressoria ridotta');
    rep += (flags.length? ('Quadro compatibile con '+flags.join(', ')+'.') : 'Assenza di alterazioni di rilievo in base ai parametri inseriti.') + `\n`;

    $('report').textContent=rep; goto(4);
  }catch(e){ $('report').textContent='Errore nella generazione del referto: '+e.message; goto(4); }
});

/* Restart */
$('restart').addEventListener('click',()=>{
  MODE=null; DEVICE=null; SUGG=null;
  document.querySelectorAll('input').forEach(i=>i.value='');
  document.querySelectorAll('select').forEach(s=>s.selectedIndex=0);
  document.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=false);
  document.getElementById('pred_summary').innerHTML='';
  const so=document.getElementById('spiro_out'); if(so) so.innerHTML='';
  const wo=document.getElementById('wiz_out'); if(wo) wo.innerHTML='';
  document.getElementById('proto_suggestion').classList.add('hidden');
  $('tm_mets_card').classList.add('hidden');
  goto(0);
});
