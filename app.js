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
  if(step===1) showStep1ForMode();
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

/* Quick predictions (educational placeholders) */
function quickPred(age,sex,h_cm){
  const h=h_cm/100; let fev1,fvc;
  if(sex==='M'){ fev1=0.553*Math.pow(h,2.6) - 0.013*age; fvc=0.578*Math.pow(h,2.9) - 0.015*age; }
  else{ fev1=0.433*Math.pow(h,2.6) - 0.011*age; fvc=0.489*Math.pow(h,2.9) - 0.013*age; }
  fev1=Math.max(0.8,fev1); fvc=Math.max(1.0,fvc);
  let vo2kg=(sex==='M'?50:42) - 0.25*age; vo2kg=Math.max(14,vo2kg);
  return {fev1,fvc,vo2kg};
}

/* Treadmill VO2/METs formulas */
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

/* STEP1 → predictions + suggestion */
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

    let spiroTxt='';
    if(MODE==='cpet'){
      const FEV1= +$('sp_fev1').value, FVC= +$('sp_fvc').value;
      let ratio= +$('sp_ratio').value; if(!isFinite(ratio)&&isFinite(FEV1)&&isFinite(FVC)&&FVC>0) ratio=100*FEV1/FVC;
      let MVV = isFinite(+$('sp_mvv').value)? +$('sp_mvv').value : (isFinite(FEV1)? 40*FEV1: NaN);
      const LLN= +$('sp_ratio_lln').value || 70; const ratioAbn= isFinite(ratio)? (ratio<LLN): false;
      const fev1pred= +$('sp_fev1_pred').value, fvcpred= +$('sp_fvc_pred').value;
      const fev1pct=(isFinite(FEV1)&&isFinite(fev1pred)&&fev1pred>0)? 100*FEV1/fev1pred : NaN;
      const fvcpct=(isFinite(FVC)&&isFinite(fvcpred)&&fvcpred>0)? 100*FVC/fvcpred : NaN;
      let pattern='';
      if(ratioAbn && isFinite(fev1pct)) pattern='Ostruttivo' + (fev1pct<50?' severo':(fev1pct<80?' moderato':' lieve'));
      else if(!ratioAbn && isFinite(fvcpct) && fvcpct<80) pattern='Restrittivo (sospetto)';
      if(ratioAbn && isFinite(fvcpct) && fvcpct<80) pattern='Misto';
      spiroTxt=` — Spirometria: ${isFinite(ratio)?'FEV₁/FVC '+ratio.toFixed(1)+'% (LLN '+LLN+'%) — ':''}${pattern||'n.d.'}. MVV ${isFinite(MVV)? Math.round(MVV):'n.d.'} L/min.`;
    }
    $('pred_summary').innerHTML=`<p><b>Predetti</b> — VO₂ ≈ <b>${vo2_pred} mL/min</b> (${vo2kg_pred} mL·kg⁻¹·min⁻¹; <b>${mets_pred} METs</b>)${spiroTxt}</p>`;

    // Suggestion
    SUGG = { device: DEVICE, mode: MODE };
    if(DEVICE==='cycle'){
      let inc = 15, start = 20, t=10, note=[];
      const lowFitness = (vo2kg_pred<20) || (train<1) || flags.elder || flags.hf;
      const highFitness = (vo2kg_pred>40) || flags.ath || (train>=5);
      if(lowFitness){ inc=10; start=10; t=10; note.push('profilo a bassa capacità: rampa 10 W/min'); }
      else if(highFitness){ inc=25; start=30; t=10; note.push('profilo atleta/allenato: rampa 20–30 W/min'); }
      else { inc=15; start=20; t=10; note.push('profilo intermedio: rampa 15 W/min'); }
      if(flags.ihd || flags.bb){ inc=Math.min(inc,15); start=Math.min(start,20); note.push('ischemia/beta-blocco: evitare ramp ripide'); }
      SUGG.cycle={type:'ramp', target_min:t, start_w:start, inc_w:inc, step_min:2, gain:10, rationale:note.join('; ')};
      $('proto_sug_text').innerHTML = `<p><b>Cicloergometro</b> — Rampa consigliata: start ${start} W, +${inc} W/min, durata target ${t} min. <br><span class="hint">${SUGG.cycle.rationale}</span></p>`;
    } else {
      let proto='ramp_tm', t=10, speed0=3.0, grade0=0, ds=0.2, dg=1, stepmin=1, title='Rampa personalizzata';
      const lowFitness = (vo2kg_pred<20) || (train<1) || flags.elder || flags.hf;
      const highFitness = (vo2kg_pred>40) || flags.ath || (train>=5);
      if((flags.hf || flags.elder)){ proto='naughton'; title='Naughton'; speed0=2.5; grade0=0; ds=0.1; dg=1; stepmin=2; t=10; }
      else if(flags.ihd && !highFitness){ proto='mod_bruce'; title='Modified Bruce'; speed0=2.7; grade0=0; ds=0.1; dg=2; stepmin=3; t=12; }
      else if(highFitness){ proto='bruce'; title='Bruce'; speed0=4.0; grade0=10; ds=0.3; dg=2; stepmin=3; t=10; }
      const note = (proto==='ramp_tm') ? 'rampa dolce: +0.2 km/h e +1% pendenza ogni 1′' :
                    (proto==='mod_bruce') ? 'avvio graduale; decondizionati/coronari non severi' :
                    (proto==='naughton') ? 'incrementi leggeri, utile in HF/anziani' :
                    'incrementi sostenuti, per soggetti allenati';
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

/* Protocol UI refresh */
function refreshProtocol(){
  const tm = (DEVICE==='treadmill');
  if(tm){ $('cycle_block').classList.add('hidden'); $('tm_block').classList.remove('hidden'); $('tm_mets_card').classList.remove('hidden'); }
  else { $('tm_block').classList.add('hidden'); $('cycle_block').classList.remove('hidden'); $('tm_mets_card').classList.add('hidden'); }

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
  } else {
    const proto=$('tm_proto').value, t= +$('tm_target').value||10;
    const s0= +$('tm_speed0').value||3, g0= +$('tm_grade0').value||0, ds= +$('tm_dspeed').value||0.2, dg= +$('tm_dgrade').value||1, sm= +$('tm_stepmin').value||1;
    if(proto==='ramp_tm'){
      txt=`Rampa treadmill: start ${s0} km/h @ ${g0}%, step ${sm}' con +${ds} km/h e +${dg}% per step, target ${t} min.`;
    } else if(proto==='mod_bruce'){
      txt=`Treadmill: Modified Bruce.`;
    } else if(proto==='bruce'){
      txt=`Treadmill: Bruce standard.`;
    } else if(proto==='naughton'){
      txt=`Treadmill: Naughton (incrementi leggeri).`;
    } else if(proto==='balke'){
      txt=`Treadmill: Balke (incrementi di pendenza).`;
    }
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

/* Step3 visibility */
function showStep3ForMode(){
  const wf=$('watt_fields'), cf=$('cpet_fields'), wc=$('watt_criteria'), cn=$('cpet_notes'), spb=$('spiro_block');
  if(MODE==='watt'){ wf.classList.remove('hidden'); wc.classList.remove('hidden'); cf.classList.add('hidden'); cn.classList.add('hidden'); spb.classList.add('hidden'); }
  else { cf.classList.remove('hidden'); cn.classList.remove('hidden'); wf.classList.add('hidden'); wc.classList.add('hidden'); spb.classList.remove('hidden'); }
}


/* Step1 visibility */
function showStep1ForMode(){
  const spb=document.getElementById('spiro_block');
  if(!spb) return;
  if(MODE==='cpet'){ spb.classList.remove('hidden'); }
  else { spb.classList.add('hidden'); }
}
/* Monark */
$('m_from_kgf').addEventListener('click',()=>{const rpm=+$('m_rpm').value||60, kgf=+$('m_kgf').value||0; const w=6.12*rpm*kgf; $('m_w').value=Math.round(w); $('m_out').innerHTML=`<p>W = 6.12 × ${kgf} × ${rpm} ≈ <b>${Math.round(w)} W</b></p>`;});
$('m_from_w').addEventListener('click',()=>{const rpm=+$('m_rpm').value||60, w=+$('m_w').value||0; const kgf=w/(6.12*rpm); $('m_kgf').value=kgf.toFixed(2); $('m_out').innerHTML=`<p>kgf ≈ <b>${kgf.toFixed(2)}</b> (a ${rpm} rpm)</p>`;});

/* Utilities for Watt predictions */
function wpredFromVO2pred(vo2_pred, gain, intercept=250){ if(!isFinite(vo2_pred)) return NaN; return Math.max(0,(vo2_pred - intercept)/gain); }
function wpredFromMets(age,sex,weight,gain,intercept=250){ const m = ((sex==='M') ? (14 - 0.10*age) : (12 - 0.10*age)); const mC = Math.max(5, Math.min(16, m)); const vo2 = mC*3.5*weight; return wpredFromVO2pred(vo2,gain,intercept); }

/* Build long narrative (Watt) */
function longReportWatt(ctx){
  const {inc,start,tmin} = ctx.proto;
  const hrrest=ctx.hrrest, sbpr=ctx.sbp_rest, dbpr=ctx.dbp_rest;
  const wpeak=ctx.wpeak, mets=ctx.mets, mets_pred=ctx.mets_pred, wpct=ctx.wpct, dur=ctx.dur;
  const hrmax=ctx.hrmax, hr_pct=ctx.hr_pct, dSBP=ctx.dSBP, sbp=ctx.sbp, dbp=ctx.dbp;
  const reason=ctx.reason, symptoms=ctx.symptoms;
  const borg=ctx.borg;
  const st=ctx.st, arrh=ctx.arrh;
  const hrr1=ctx.hrr1, hrr3=ctx.hrr3;

  const pressClass = (!isFinite(dSBP))? 'non valutabile'
                    : ( (isFinite(sbp)&&sbp>250) || (isFinite(dbp)&&dbp>115) )? 'ipertensiva'
                    : (dSBP<10)? 'inadeguata'
                    : 'fisiologica';

  const mass = ( (isFinite(hr_pct)&&hr_pct>=85) || (isFinite(borg)&&borg>=17) )? 'massimale':'sub-massimale';
  let capFun='nei limiti';
  if(isFinite(wpct)&&wpct<80) capFun='ridotta';
  if(isFinite(wpct)&&wpct>120) capFun='aumentata';

  let chrono='non valutabile';
  if(isFinite(hr_pct)){ chrono = (hr_pct>=85)? 'adeguata':'inadeguata'; }

  // ECG phrasing
  let ecg='Il ritmo di base è rimasto sinusale. ';
  if(st.type==='nessuna'){ ecg += 'Nessuna alterazione significativa del tratto ST durante lo sforzo.'; }
  else {
    const ent = isFinite(st.mm)? `${st.mm} mm`:'entità non quantificata';
    const leads = st.leads? ` in derivazioni ${st.leads}`:'';
    const atW = isFinite(st.w)? ` a ${st.w} W`:'';
    const atHR = isFinite(st.hr)? ` e ${st.hr} bpm`:'';
    ecg += `Comparsa di ${st.type} del tratto ST di ${ent}${leads}, insorto${atW}${atHR}.`;
  }
  const recov = `Nel recupero si osserva ` + (isFinite(st.normMin)? `normalizzazione del tratto ST entro ${st.normMin} minuti, `:'') +
                (isFinite(hrr1)? `riduzione della FC di ${Math.round(hrr1)} bpm al primo minuto`:'') +
                (isFinite(hrr3)? ` e di ${Math.round(hrr3)} bpm al terzo minuto`:'') + `.`;

  // Conclusion heuristic
  const positive = ( (st.type!=='nessuna' && isFinite(st.mm) && st.mm>=1) || (symptoms.toLowerCase().includes('dolore toracico tipico')) );
  const concl = positive? 'positivo' : 'negativo';

  return `Il test da sforzo al cicloergometro è stato eseguito con protocollo a rampa incrementale di ${inc??'n.d.'} W/min, con carico iniziale di ${start??'n.d.'} W.
Il paziente si è presentato in condizioni basali stabili, ritmo sinusale a ${isFinite(hrrest)?Math.round(hrrest):'n.d.'} bpm, pressione arteriosa di ${isFinite(sbpr)?sbpr:'n.d.'}/${isFinite(dbpr)?dbpr:'n.d.'} mmHg, assenza di sintomi riferiti a riposo.

Durante la prova il paziente ha raggiunto un carico massimo di ${isFinite(wpeak)?Math.round(wpeak):'n.d.'} W (equivalente a ${isFinite(mets)?mets.toFixed(1):'n.d.'} METs, pari a ${isFinite(wpct)?Math.round(wpct):'n.d.'}% del valore predetto), interrotto per ${reason||'n.d.'} dopo ${isFinite(dur)?dur:'n.d.'} minuti complessivi di esercizio. La frequenza cardiaca massima è stata di ${isFinite(hrmax)?Math.round(hrmax):'n.d.'} bpm (${isFinite(hr_pct)?Math.round(hr_pct):'n.d.'}% della teorica) con incremento ${ (isFinite(hrmax)&&isFinite(hrrest)&&hrmax>hrrest+20) ? 'adeguato' : 'limitato' } rispetto al basale. La risposta pressoria è risultata ${pressClass}, con valori massimi di ${isFinite(sbp)?sbp:'n.d.'}/${isFinite(dbp)?dbp:'n.d.'} mmHg.

Dal punto di vista clinico si rileva: ${symptoms or 'assenza di sintomi significativi'}${isFinite(borg)?` (Borg ${borg})`:''}.

All’analisi elettrocardiografica: ${ecg}
${recov}
La prova può essere considerata ${mass}. La capacità funzionale globale è risultata ${capFun}. La risposta cronotropa è risultata ${chrono}. La risposta pressoria ${pressClass}.

Conclusioni: test ${concl} per ischemia inducibile, con ${positive?'presenza':'assenza'} di sintomi e/o modificazioni elettrocardiografiche suggestive. ${arrh?('Aritmie: '+arrh+'.'):'Non si sono osservate aritmie di rilievo.'}`;
}

/* Build long narrative (CPET) */
function longReportCPET(ctx){
  const protoTxt = (DEVICE==='treadmill')
    ? (document.getElementById('tm_proto').selectedOptions[0].textContent || 'protocollo treadmill')
    : (document.getElementById('proto_type').selectedOptions[0].textContent || 'protocollo ciclo');
  const start = (DEVICE==='treadmill')? `${$('tm_speed0').value||'n.d.'} km/h @ ${$('tm_grade0').value||'n.d.'}%` : `${$('start_w').value||'n.d.'} W`;

  const spiro = ctx.spiroTxt? (` Spirometria pre-test: ${ctx.spiroTxt}`) : '';
  const hrrest=ctx.hrrest, sbpr=ctx.sbp_rest, dbpr=ctx.dbp_rest;
  const vo2kg=ctx.vo2kg, vo2kg_pred=ctx.vo2kg_pred, vo2kg_pct=ctx.vo2kg_pct, vo2pk=ctx.vo2, rer=ctx.rer;
  const slope=ctx.slope, br=ctx.br, oues=ctx.oues, vemax=ctx.vemax;
  const dur=ctx.dur, reason=ctx.reason, symptoms=ctx.symptoms, borg=ctx.borg;
  const hrmax=ctx.hrmax, hr_pct=ctx.hr_pct;
  const sbp=ctx.sbp, dbp=ctx.dbp, dSBP=ctx.dSBP;
  const hrr1=ctx.hrr1, hrr3=ctx.hrr3;

  const pressClass = (!isFinite(dSBP))? 'non valutabile'
                    : ( (isFinite(sbp)&&sbp>250) || (isFinite(dbp)&&dbp>115) )? 'ipertensiva'
                    : (dSBP<20)? 'ridotta'
                    : 'fisiologica';

  const mass = ( (isFinite(hr_pct)&&hr_pct>=85) || (isFinite(rer)&&rer>=1.10) )? 'massimale':'sub-massimale';
  const eff = (isFinite(vo2kg_pct) ? (vo2kg_pct<50?'marcatamente ridotta':(vo2kg_pct<80?'ridotta':'nei limiti')) : 'non valutabile');

  return `Il test da sforzo (${DEVICE==='treadmill'?'treadmill':'cicloergometro'}) è stato eseguito con ${protoTxt}, avvio a ${start}.${spiro}

Durante la prova il paziente ha raggiunto un VO₂ di picco pari a ${isFinite(vo2kg)?vo2kg.toFixed(1):'n.d.'} mL·kg⁻¹·min⁻¹ (${isFinite(vo2kg_pct)?Math.round(vo2kg_pct):'n.d.'}% del predetto)${isFinite(vo2pk)?`, corrispondente a ${Math.round(vo2pk)} mL/min`:''}. RER massimo ${isFinite(rer)?rer.toFixed(2):'n.d.'}. Indici ventilatori: VE/VCO₂ slope ${isFinite(slope)?slope.toFixed(1):'n.d.'}, riserva ventilatoria (BR) ${isFinite(br)?Math.round(br):'n.d.'}%, OUES ${isFinite(oues)?oues.toFixed(2):'n.d.'}.

L’esercizio è stato interrotto per ${reason||'n.d.'} dopo ${isFinite(dur)?dur:'n.d.'} minuti. FC massima ${isFinite(hrmax)?Math.round(hrmax):'n.d.'} bpm (${isFinite(hr_pct)?Math.round(hr_pct):'n.d.'}% del teorico). Pressione massima ${isFinite(sbp)?sbp:'n.d.'}/${isFinite(dbp)?dbp:'n.d.'} mmHg; risposta pressoria ${pressClass}. Nel recupero: HRR 1′ ${isFinite(hrr1)?Math.round(hrr1):'n.d.'} bpm, 3′ ${isFinite(hrr3)?Math.round(hrr3):'n.d.'} bpm.

Dal punto di vista clinico: ${symptoms or 'assenza di sintomi significativi'}${isFinite(borg)?` (Borg ${borg})`:''}.

La prova può essere considerata ${mass}. La capacità funzionale globale appare ${eff}.

Conclusioni: quadro ${eff}${isFinite(slope)? (slope>=40? ' con inefficienza ventilatoria moderata-severa':'') : ''}. Ulteriori approfondimenti clinico-strumentali secondo giudizio clinico.`;
}

/* STEP 3 → Analyze + build both reports */
$('step3_next').addEventListener('click',()=>{
  try{
    const ps=document.getElementById('pred_summary').innerText.match(/VO₂ ≈ (\d+) mL\/min \(([\d\.]+) mL·kg⁻¹·min⁻¹; <b>([\d\.]+) METs<\/b>\)/);
    const vo2_pred= ps? +ps[1] : NaN;
    const vo2kg_pred= ps? +ps[2] : NaN;
    const mets_pred= ps? +ps[3] : NaN;
    const w= +$('weight').value||NaN; const age= +$('age').value||NaN; const sex=$('sex').value;
    const h= +$('height').value||NaN;
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

      const reason = ($('r_reason')?.value)||'';
      const symptoms = ($('r_symptoms')?.value)||'';
      const st = {
        type: ($('r_st_type')?.value)||'nessuna',
        mm: +$('r_st_mm').value||NaN,
        leads: ($('r_st_leads')?.value)||'',
        w: +$('r_st_w').value||NaN,
        hr: +$('r_st_hr').value||NaN,
        normMin: +$('r_st_norm_min').value||NaN
      };
      const arrh = ($('r_arrh')?.value)||'';

      const hr_formula = $('hrmax_formula').value;
      const hrmax_pred = hrPred(age, hr_formula);
      const hr_pct = (isFinite(hrmax)&&isFinite(hrmax_pred))? 100*hrmax/hrmax_pred : NaN;
      const ci = (isFinite(hrmax)&&isFinite(hrrest)&&isFinite(hrmax_pred)&&hrmax_pred>hrrest) ? ( (hrmax-hrrest)/(hrmax_pred-hrrest) ) : NaN;
      const hrr1 = (isFinite(hrmax)&&isFinite(hr1))? (hrmax-hr1) : NaN;
      const hrr3 = (isFinite(hrmax)&&isFinite(hr3))? (hrmax-hr3) : NaN;

      const wpred_vo2 = wpredFromVO2pred(vo2_pred, gain, intercept);
      const wpct_main = (isFinite(wpeak)&&isFinite(wpred_vo2)&&wpred_vo2>0)? 100*wpeak/wpred_vo2 : NaN;

      let vo2kg_est= (isFinite(wpeak)&&isFinite(w)&&w>0)? (10.8*wpeak/w + 7) : NaN;
      const vo2_est = isFinite(vo2kg_est)&&isFinite(w)? vo2kg_est*w : NaN;
      const mets = isFinite(vo2kg_est)? vo2kg_est/3.5 : NaN;

      const dSBP = (isFinite(sbp)&&isFinite(sbp_rest))? (sbp - sbp_rest) : NaN;

      // --- Short report (existing style) ---
      let rep='';
      rep += `DISPOSITIVO: Cicloergometro — Modalità: Watt Test\n\n`;
      rep += `PARAMETRI DI CARICO E PERFORMANCE\n`;
      if(isFinite(wpeak)) rep += `• Watt di picco: ${Math.round(wpeak)} W` + (isFinite(wkg)? ` (${wkg.toFixed(2)} W/kg)`:'') + (isFinite(dur)? ` — durata ${dur} min`:'') + `\n`;
      if(isFinite(wpred_vo2)) rep += `• Wprev (VO₂ pred + ΔVO₂/ΔW): ≈ ${Math.round(wpred_vo2)} W` + (isFinite(wpeak)&&wpred_vo2>0? ` — ${Math.round(100*wpeak/wpred_vo2)}% del previsto`:'') + `\n`;
      if(isFinite(vo2kg_est)) rep += `• VO₂ stimato: ${Math.round(vo2_est||0)} mL/min (${vo2kg_est.toFixed(1)} mL·kg⁻¹·min⁻¹; ${isFinite(mets)? mets.toFixed(1):'n.d.'} METs)\n`;

      rep += `\nPARAMETRI EMODINAMICI\n`;
      if(isFinite(hrrest)) rep += `• FC riposo: ${Math.round(hrrest)} bpm. `;
      if(isFinite(hrmax)) rep += `FC picco: ${Math.round(hrmax)} bpm (${isFinite(hr_pct)? Math.round(hr_pct):'n.d.'}% del teorico ${Math.round(hrmax_pred)}). `;
      if(isFinite(hrr1)) rep += `HRR 1′: ${Math.round(hrr1)} bpm. `;
      if(isFinite(hrr3)) rep += `HRR 3′: ${Math.round(hrr3)} bpm.\n`;
      if(isFinite(sbp_rest)||isFinite(sbp)) rep += `• Pressione: riposo ${isFinite(sbp_rest)? sbp_rest:''}/${isFinite(dbp_rest)? dbp_rest:''} → picco ${isFinite(sbp)? sbp:''}/${isFinite(dbp)? dbp:''} mmHg.\n`;

      rep += `\nSINTESI CLINICA\n`;
      const flags=[];
      if(isFinite(wpct_main)&&wpct_main<80) flags.push('% Wpeak <80% del previsto');
      if(isFinite(hrr1)&&hrr1<12) flags.push('HRR 1′ ridotto');
      if(isFinite(spo2)&&spo2<94) flags.push('desaturazione sotto sforzo');
      rep += (flags.length? ('Quadro compatibile con '+flags.join(', ')+'.') : 'Assenza di alterazioni di rilievo in base ai parametri inseriti.') + `\n`;

      $('report').textContent=rep;

      // --- Long narrative ---
      const proto = { inc: +$('inc_w').value||NaN, start: +$('start_w').value||NaN, tmin: +$('target_min').value||NaN };
      const longCtx = {
        proto, hrrest, sbp_rest, dbp_rest, wpeak, mets, mets_pred, wpct: wpct_main, dur,
        hrmax, hr_pct, dSBP, sbp, dbp,
        reason, symptoms, borg, st, arrh, hrr1, hrr3
      };
      $('report_long').textContent = longReportWatt(longCtx);

      goto(4);
      return;
    }

    // ---- CPET path ----
    const vo2pk= +$('r_vo2pk').value||NaN; let vo2kg= +$('r_vo2kg').value||NaN; if(!isFinite(vo2kg)&&isFinite(vo2pk)&&isFinite(w)&&w>0) vo2kg=vo2pk/w;
    const slope= +$('r_slope').value||NaN, oues= +$('r_oues').value||NaN, vemax= +$('r_vemax').value||NaN;
    const hrrest= +$('r_hrrest').value||NaN, hrmax= +$('r_hrmax').value||NaN, hr1= +$('r_hr1').value||NaN, hr3= +$('r_hr3').value||NaN;
    const rer= +$('r_rer').value||NaN, spo2= +$('r_spo2').value||NaN, borg= +$('r_borg').value||NaN;
    const sbp_rest= +$('c_sbp_rest').value||NaN, dbp_rest= +$('c_dbp_rest').value||NaN, sbp= +$('c_sbp').value||NaN, dbp= +$('c_dbp').value||NaN;
    const sbp1= +$('c_sbp1').value||NaN, dbp1= +$('c_dbp1').value||NaN, sbp3= +$('c_sbp3').value||NaN, dbp3= +$('c_dbp3').value||NaN;
    const reason = ($('c_reason')?.value)||''; const symptoms = ($('c_symptoms')?.value)||'';
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

    const dSBP = (isFinite(sbp)&&isFinite(sbp_rest))? (sbp - sbp_rest) : NaN;
    const dp_rest = (isFinite(hrrest)&&isFinite(sbp_rest))? hrrest*sbp_rest : NaN;
    const dp_peak = (isFinite(hrmax)&&isFinite(sbp))? hrmax*sbp : NaN;

    const mets_pred_c = isFinite(vo2kg_pred)? round(vo2kg_pred/3.5,1) : NaN;
    let tm_line=''; if(DEVICE==='treadmill'){ const est=tmEstimatePeak(); if(isFinite(est.mets_peak)){ const pct = isFinite(mets_pred_c)&&mets_pred_c>0 ? Math.round(100*est.mets_peak/mets_pred_c) : NaN; tm_line=`Stima METs dal protocollo treadmill: ${est.mets_peak.toFixed(1)}` + (isFinite(pct)? ` (${pct}% dei predetti).` : '.'); } }

    let rep='';
    rep += `DISPOSITIVO: ${DEVICE==='treadmill'?'Treadmill':'Cicloergometro'} — Modalità: CPET\n\n`;
    rep += `EFFICIENZA GLOBALE\n`;
    rep += `La capacità aerobica massimale risulta ${(isFinite(vo2kg_pct)? (vo2kg_pct<50?'marcatamente ridotta':(vo2kg_pct<80?'ridotta':'nei limiti')) : 'non valutabile')}` + (isFinite(vo2kg)? `, con VO₂ peak pari a ${round(vo2kg,1)} mL·kg⁻¹·min⁻¹`:'') + (isFinite(vo2kg_pct)? ` (${round(vo2kg_pct)}% del predetto)`:'') + `.\n`;
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
    if(isFinite(sbp_rest)||isFinite(sbp)) rep += `Pressione: ${isFinite(sbp_rest)? sbp_rest:''}/${isFinite(dbp_rest)? dbp_rest:''} → ${isFinite(sbp)? sbp:''}/${isFinite(dbp)? dbp:''} mmHg. ΔSBP ${isFinite(dSBP)?dSBP:'n.d.'} mmHg.\n`;

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

    $('report').textContent=rep;

    // Long narrative CPET
    const longCtx={
      spiroTxt: (function(){
        const FEV1= +$('sp_fev1').value, FVC= +$('sp_fvc').value; let ratio= +$('sp_ratio').value;
        if(!isFinite(ratio)&&isFinite(FEV1)&&isFinite(FVC)&&FVC>0) ratio=100*FEV1/FVC;
        if(!isFinite(FEV1)&&!isFinite(FVC)) return '';
        return `FEV₁ ${isFinite(FEV1)?FEV1.toFixed(2)+' L':'n.d.'}, FVC ${isFinite(FVC)?FVC.toFixed(2)+' L':'n.d.'}, rapporto ${isFinite(ratio)?ratio.toFixed(1)+'%':'n.d.'}.`;
      })(),
      hrrest, sbp_rest, dbp_rest, vo2kg, vo2kg_pred, vo2kg_pct, vo2: vo2pk, rer, slope, br:BR, oues, vemax,
      dur, reason, symptoms, borg, hrmax, hr_pct, sbp, dbp, dSBP, hrr1, hrr3
    };
    $('report_long').textContent = longReportCPET(longCtx);

    goto(4);
  }catch(e){ $('report').textContent='Errore nella generazione del referto: '+e.message; goto(4); }
});

/* Navigation */
$('back_to_1').addEventListener('click',()=>goto(1));
$('back_to_2a')?.addEventListener('click',()=>goto(2));
$('step2_next').addEventListener('click',()=>goto(3));

/* Restart */
$('restart').addEventListener('click',()=>{
  MODE=null; DEVICE=null; SUGG=null;
  document.querySelectorAll('input').forEach(i=>i.value='');
  document.querySelectorAll('select').forEach(s=>s.selectedIndex=0);
  document.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=false);
  ['pred_summary','spiro_out','wiz_out','proto_suggestion','tm_mets_card'].forEach(id=>{ const el=document.getElementById(id); if(el&&el.classList) el.classList.add('hidden'); });
  document.getElementById('pred_summary').innerHTML='';
  goto(0);
});
