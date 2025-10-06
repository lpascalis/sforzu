const $ = id => document.getElementById(id);
const show = id => { document.querySelectorAll('.card').forEach(c=>c.classList.add('hidden')); $(id).classList.remove('hidden'); };

let state = {
  examType:'watt', ergometer:'cycle', profile:'standard',
  age:null, sex:'M', weight:null, height:null,
  protoStart:null, protoRamp:null, protoDur:null,
  wPeak:null, hrRest:null, hrPeak:null, hr1:null, hr3:null,
  sbpRest:null, sbpPeak:null, sbpRec:null, dbpRest:null, borg:null, dur:null,
  vo2:null, at:null, rer:null, spo2:null, slope:null, dvo2dw:null, oues:null, br:null,
  petco2r:null, petco2at:null, petco2p:null, vdvt:null,
  fev1:null, fvc:null, ratio:null, spiroModel:'rapid'
};

// NAV
$('toStep1').onclick = ()=>{
  ['examType','ergometer','profile','sex'].forEach(k=>state[k]=$(k).value);
  ['age','weight','height'].forEach(k=>state[k]=+($(k).value||0));
  suggestProtocol(); show('step-1');
};
$('back0').onclick = ()=>show('step-0');

$('toStep2').onclick = ()=>{
  ['protoStart','protoRamp','protoDur'].forEach(k=>state[k]=+($(k).value||0));
  show('step-2');
};
$('back1').onclick = ()=>show('step-1');

$('toStep3').onclick = ()=>{
  ['wPeak','hrRest','hrPeak','hr1','hr3','sbpRest','sbpPeak','sbpRec','dbpRest','borg','dur'].forEach(k=>state[k]=+($(k).value||0));
  if(state.examType==='watt'){ $('ventBlock').classList.add('hidden'); $('ventNote').textContent='Watt test selezionato: modulo ventilatorio non richiesto.'; }
  else { $('ventBlock').classList.remove('hidden'); $('ventNote').textContent=''; }
  show('step-3');
};
$('back2').onclick = ()=>show('step-2');

$('toStep4').onclick = ()=>{
  if(state.examType==='cpet'){
    ['vo2','at','rer','spo2','slope','dvo2dw','oues','br','petco2r','petco2at','petco2p','vdvt','fev1','fvc','ratio'].forEach(k=>state[k]=+($(k).value||0));
    state.spiroModel = $('spiroModel').value;
    computeSpirometry();
  }
  renderAdequacy(); show('step-4');
};
$('back3').onclick = ()=>show('step-3');

$('toStep5').onclick = ()=>{ renderResults(); show('step-5'); };
$('restart').onclick = ()=>window.location.reload();

// Helpers
function hrMaxTheory(){ return 208 - 0.7*state.age; }
function hrReserveIndex(){
  const hm = hrMaxTheory();
  const num = (state.hrPeak||0) - (state.hrRest||0);
  const den = (hm||0) - (state.hrRest||0);
  if(den<=0 || !isFinite(num/den)) return null;
  return num/den;
}
function hrRecovery(t=1){ const v = t===1 ? state.hrPeak - state.hr1 : state.hrPeak - state.hr3; return isFinite(v)? v : null; }
function dpPeak(){ return (state.hrPeak && state.sbpPeak)? state.hrPeak*state.sbpPeak : null; }
function deltaPAS(){ return (state.sbpPeak!=null && state.sbpRest!=null)? (state.sbpPeak - state.sbpRest) : null; }
function metFromWatt(){ if(!state.wPeak||!state.weight) return null; const vo2 = (state.wPeak*10.8/state.weight)+3.5; return vo2/3.5; }
function predictedMETs(){ const base = state.sex==='M'?12.0:10.5; const adj = Math.max(0,(50-state.age))*0.05; return Math.max(4, base - (state.age-20)*0.06 + (state.sex==='M'?0.5:0) + adj); }

// Protocol suggestion
function suggestProtocol(){
  const {ergometer, profile} = state;
  let start = ergometer==='cycle'?25:2;
  let ramp  = ergometer==='cycle'?15:0.5;
  let dur   = 10;
  if(profile==='athlete'){ start = ergometer==='cycle'?50:3; ramp = ergometer==='cycle'?25:0.8; dur=10; }
  if(profile==='ihd' || profile==='betablocker'){ start = ergometer==='cycle'?10:1.5; ramp = ergometer==='cycle'?10:0.3; dur=10; }
  if(profile==='copd'){ start = ergometer==='cycle'?10:1.5; ramp = ergometer==='cycle'?10:0.3; dur=10; }
  $('protoStart').value = start; $('protoRamp').value = ramp; $('protoDur').value = dur;
  $('protoNote').textContent = ergometer==='cycle'
    ? `Ciclo: start ${start} W, rampa ${ramp} W/min, durata ${dur} min.`
    : `Treadmill: start ${start} km/h, incremento ${ramp} km/h/min, durata ${dur} min.`;
}

// Adequacy
function adequacy(){
  let flags=[];
  if(state.dur){
    if(state.dur>=8 && state.dur<=12) flags.push(['Durata','ok',`${state.dur.toFixed(1)} min`]);
    else if(state.dur>=6 && state.dur<=13) flags.push(['Durata','warn',`${state.dur.toFixed(1)} min`]);
    else flags.push(['Durata','bad',`${state.dur.toFixed(1)} min`]);
  }
  if(state.examType==='cpet' && state.rer){
    if(state.rer>=1.10) flags.push(['RER','ok',state.rer.toFixed(2)]);
    else if(state.rer>=1.05) flags.push(['RER','warn',state.rer.toFixed(2)]);
    else flags.push(['RER','bad',state.rer.toFixed(2)]);
  }
  const hri = hrReserveIndex();
  if(hri!=null){
    if(hri>=0.80) flags.push(['Riserva cronotropa','ok',(hri*100).toFixed(0)+'%']);
    else if(hri>=0.62) flags.push(['Riserva cronotropa','warn',(hri*100).toFixed(0)+'%']);
    else flags.push(['Riserva cronotropa','bad',(hri*100).toFixed(0)+'%']);
  } else if(state.hrPeak && state.age){
    const pct = state.hrPeak/hrMaxTheory();
    if(pct>=0.90) flags.push(['HR% teorica','ok',(pct*100).toFixed(0)+'%']);
    else if(pct>=0.85) flags.push(['HR% teorica','warn',(pct*100).toFixed(0)+'%']);
    else flags.push(['HR% teorica','bad',(pct*100).toFixed(0)+'%']);
  }
  const dpas = deltaPAS();
  if(dpas!=null){
    if(dpas>=20) flags.push(['ΔPAS','ok', dpas+' mmHg']);
    else if(dpas>=10) flags.push(['ΔPAS','warn', dpas+' mmHg']);
    else flags.push(['ΔPAS','bad', dpas+' mmHg']);
  }
  const ok = flags.filter(f=>f[1]==='ok').length;
  const bad = flags.filter(f=>f[1]==='bad').length;
  const verdict = bad>=2 ? 'Submassimale' : (ok>=2 ? 'Massimale' : 'Borderline');
  return {verdict, flags};
}
function renderAdequacy(){
  const {verdict, flags} = adequacy();
  const chip = (cls, k, v)=>`<div class="kpi"><div><strong>${k}</strong><br><small>${v}</small></div><span class="badge ${cls}">${cls==='ok'?'OK':(cls==='warn'?'Borderline':'Ridotto')}</span></div>`;
  $('adequacy').innerHTML = `<h3>Esito: ${verdict}</h3>` + flags.map(f=>chip(f[1], f[0], f[2])).join('');
}

// Spirometry quick + ANE 2023 beta
function computeSpirometry(){
  const h_m = state.height? state.height/100 : null;
  const age = state.age; const sex = state.sex;
  let {fev1,fvc,ratio} = state;
  if(!ratio && fev1 && fvc){ ratio = (fev1/fvc)*100; state.ratio = ratio; const r=$('ratio'); if(r) r.value=ratio.toFixed(1); }
  let out=[];
  if(state.spiroModel==='rapid' && h_m && age){
    const predFEV1 = (sex==='M'?4.30:3.80) - 0.029*age + (sex==='M'?0:-0.1);
    const predFVC  = (sex==='M'?5.60:4.60) - 0.034*age;
    const predR    = (sex==='M'?80:82);
    appendSpiro(out, fev1, fvc, ratio, predFEV1, predFVC, predR);
  } else if(state.spiroModel==='ane2023' && h_m && age){
    const lnH = Math.log(h_m), lnA = Math.log(age);
    let predFEV1, predFVC, predR;
    if(sex==='F'){
      predFEV1 = Math.exp(-10.901689 + 2.385928*lnH - 0.076386*lnA - 0.05);
      predFVC  = Math.exp(-12.055901 + 2.621579*lnH - 0.035975*lnA - 0.05);
      predR    = Math.exp(0.9189568 - 0.1840671*lnH - 0.0461306*lnA);
    } else {
      predFEV1 = Math.exp(-11.399108 + 2.462664*lnH - 0.011394*lnA - 0.05);
      predFVC  = Math.exp(-12.629131 + 2.727421*lnH + 0.009174*lnA - 0.05);
      predR    = Math.exp(1.022608 - 0.218592*lnH - 0.027586*lnA);
    }
    appendSpiro(out, fev1, fvc, ratio, predFEV1, predFVC, predR*100);
  }
  const el = $('spiroOut'); if(el) el.innerHTML = out.join('<br>');
}
function appendSpiro(out, fev1, fvc, ratio, Pfev1, Pfvc, Pratio){
  const fev1pp = fev1 && Pfev1? (fev1/Pfev1*100).toFixed(0)+'%' : '—';
  const fvcpp  = fvc && Pfvc? (fvc/Pfvc*100).toFixed(0)+'%' : '—';
  const rpp    = ratio && Pratio? ((ratio/Pratio)*100).toFixed(0)+'%' : '—';
  const pattern = inferPattern(fev1, fvc, ratio, Pfev1, Pfvc, Pratio);
  out.push(`Predetti: FEV₁ ${Pfev1?Pfev1.toFixed(2):'—'} L · FVC ${Pfvc?Pfvc.toFixed(2):'—'} L · FEV₁/FVC ${Pratio?Pratio.toFixed(0):'—'}%`);
  out.push(`%pred: FEV₁ ${fev1pp} · FVC ${fvcpp} · Rapporto ${rpp}`);
  out.push(`<span class="tag">Pattern: ${pattern}</span>`);
}
function inferPattern(fev1, fvc, ratio, Pfev1, Pfvc, Pratio){
  if(!fev1||!fvc||!ratio||!Pratio) return 'dati incompleti';
  const llnRatio = 0.7*Pratio; // proxy LLN
  if(ratio < llnRatio || ratio < 70){
    if(fev1 < 0.8*Pfev1) return 'ostruttivo (FEV₁ ridotto)';
    return 'ostruttivo lieve';
  }
  if(fvc < 0.8*Pfvc) return 'possibile restrizione';
  return 'nei limiti';
}

// KPI helpers
function kpi(name, value, cls=null){
  const badge = cls? `<span class="badge ${cls}">${cls==='ok'?'OK':(cls==='warn'?'Borderline':'Ridotto')}</span>` : '';
  return `<div class="kpi"><div><strong>${name}</strong><br><small>${value}</small></div>${badge}</div>`;
}

// CPET interpretation (soglie tipiche)
function interpretCPET(){
  let rows=[];

  // VO2 peak
  if(state.vo2){
    const weber = state.vo2>=20?'A':(state.vo2>=16?'B':(state.vo2>=10?'C':'D'));
    rows.push(kpi('VO₂ peak', `${state.vo2.toFixed(1)} ml/kg/min · classe ${weber}`, state.vo2>=16?'ok':(state.vo2>=14?'warn':'bad')));
  }

  // AT %
  if(state.at && state.vo2){
    const atpct = state.at/state.vo2*100;
    const cls = atpct>=60?'ok':(atpct>=40?'warn':'bad');
    rows.push(kpi('AT (soglia anaerobica)', `${state.at.toFixed(1)} ml/kg/min (${atpct.toFixed(0)}% del picco)`, cls));
  }

  // VE/VCO2 slope
  if(state.slope){
    let cls='ok'; if(state.slope>35) cls='bad'; else if(state.slope>30) cls='warn';
    rows.push(kpi('VE/VCO₂ slope', state.slope.toFixed(1), cls));
  }

  // BR%
  if(state.br){
    let cls='ok'; if(state.br>85) cls='bad'; else if(state.br>80) cls='warn';
    rows.push(kpi('BR% (VE/MVV×100)', `${state.br.toFixed(0)}%`, cls));
  }

  // RER
  if(state.rer){
    const cls = state.rer>=1.10?'ok':(state.rer>=1.05?'warn':'bad');
    rows.push(kpi('RER', state.rer.toFixed(2), cls));
  }

  // SpO2
  if(state.spo2){
    const cls = state.spo2>=94?'ok':(state.spo2>=90?'warn':'bad');
    rows.push(kpi('SpO₂ minima', `${state.spo2.toFixed(0)}%`, cls));
  }

  if(state.dvo2dw) rows.push(kpi('ΔVO₂/ΔW', state.dvo2dw.toFixed(2)));
  if(state.oues)   rows.push(kpi('OUES', state.oues.toFixed(2)));
  if(state.petco2at) rows.push(kpi('PetCO₂ @AT', `${state.petco2at.toFixed(0)} mmHg`));
  if(state.vdvt) rows.push(kpi('VD/VT', state.vdvt.toFixed(2)));

  rows.push(`<hr><div class="notice">${inferMatrixCPET()}</div>`);
  return rows.join('');
}

// Matrix indicativa
function inferMatrixCPET(){
  let cardio=false, ventil=false, decond=false, effort=false;

  if(state.vo2 && state.vo2<16) cardio=true;
  if(state.at && state.vo2 && (state.at/state.vo2*100)<40) cardio=true;
  if(state.slope && state.slope>35) ventil=true;
  if(state.br && state.br>85) ventil=true;
  if(state.spo2 && state.spo2<92) ventil=true;
  if(state.vo2 && state.vo2<16 && !ventil) decond=true;
  if(state.rer && state.rer<1.05) effort=true;

  let tags=[];
  if(ventil) tags.push('Limitazione ventilatoria probabile');
  if(cardio) tags.push('Componente cardiocircolatoria probabile');
  if(decond) tags.push('Decondizionamento plausibile');
  if(effort) tags.push('Sforzo subottimale');
  if(tags.length===0) tags.push('Profilo globale nei limiti o non dirimente');
  return tags.join(' · ');
}

// Watt test
function interpretWatt(){
  let rows=[];
  if(state.wPeak) rows.push(kpi('Watt picco', state.wPeak+' W'));
  const mets = metFromWatt(); if(mets) rows.push(kpi('METs stimati', mets.toFixed(1)+' METs', mets>=8?'ok':(mets>=5?'warn':'bad')));
  const pMET = predictedMETs(); if(pMET) rows.push(kpi('METs predetti (stima)', pMET.toFixed(1)+' METs'));
  const hrr1 = hrRecovery(1); if(hrr1!=null) rows.push(kpi('HR recovery 1′', hrr1+' bpm', hrr1>=12?'ok':(hrr1>=8?'warn':'bad')));
  const hrr3 = hrRecovery(3); if(hrr3!=null) rows.push(kpi('HR recovery 3′', hrr3+' bpm'));
  const hri = hrReserveIndex(); if(hri!=null){ const cls = hri>=0.80?'ok':(hri>=0.62?'warn':'bad'); rows.push(kpi('Riserva cronotropa', (hri*100).toFixed(0)+'%', cls)); }
  const dpas = deltaPAS(); if(dpas!=null) rows.push(kpi('ΔPAS', dpas+' mmHg', dpas>=20?'ok':(dpas>=10?'warn':'bad')));
  const dp = dpPeak(); if(dp) rows.push(kpi('Doppio prodotto', dp.toLocaleString()));
  return rows.join('');
}

// Results rendering
function renderResults(){
  const {verdict} = adequacy();
  let html = `<h3>Adeguatezza: ${verdict}</h3>`;
  html += `<h3>Indici principali</h3>`;
  if(state.examType==='cpet'){ html += interpretCPET(); }
  else { html += interpretWatt(); }
  if(state.examType==='cpet' && state.fev1 && state.fvc){ html += `<hr><h3>Spirometria</h3>${$('spiroOut').innerHTML}`; }
  $('results').innerHTML = html;
  const text = html.replace(/<[^>]+>/g,'').replace(/\s+\n/g,'\n');
  $('copyBtn').onclick = async ()=>{
    try{ await navigator.clipboard.writeText(text); const b=$('copyBtn'); b.textContent='✅ Copiato'; setTimeout(()=>b.textContent='📋 Copia referto sintetico',1500);}catch(e){ alert('Copia non riuscita'); }
  };
}

// Start
show('step-0');

// PWA
if('serviceWorker' in navigator){ window.addEventListener('load',()=>{ navigator.serviceWorker.register('./sw.js'); }); }
