
const $ = (id)=>document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
function nav(view){ ['home','watt','cpet','spiro'].forEach(hide); show(view); }
nav('home');
document.addEventListener('change',(e)=>{
  if(e.target && e.target.id==='c_spiro_on'){
    if(e.target.value==='si') show('c_spiro'); else hide('c_spiro');
  }
});

// ===== Utilities =====
function hrMax(age){ return Math.round(208 - 0.7*age); }
function toPASPAD(s){ const m=(s||'').match(/(\d+)\s*\/\s*(\d+)/); return m?[+m[1],+m[2]]:[NaN,NaN]; }
function vo2_cycle_mlkmin(W,kg){ return 10.8*W/Math.max(1,kg) + 7; } // ACSM
function watt_pred(age,sex,kg){ const base=sex==='M'?3.5:3.0; const ageF=Math.max(0.55, 1-(Math.max(0,age-25)*0.005)); return Math.round(base*kg*ageF); }
function pct(v,ref){ return Math.round(100*v/Math.max(1,ref)); }
function badge(txt,cls){ return `<span class="badge ${cls}">${txt}</span>`; }

// ===== Protocol suggestion engine =====
function suggestCore(prefix){
  const age=+$((prefix+'age')).value, sex=$((prefix+'sex')).value;
  const H=+$((prefix+'h')).value, kg=+$((prefix+'w')).value;
  const mode=$((prefix+'mode')).value, prof=$((prefix+'prof')).value, act=+$((prefix+'act')).value||0;
  // predicted peak watts as target reference
  const wp = watt_pred(age,sex,kg);
  // Defaults by profile
  let targetFrac=0.9, wstart=20, rampMin=10, rampMax=20, rampBase=15;
  let note='';
  switch(prof){
    case 'sedent': targetFrac=0.8; wstart=10; rampMin=10; rampMax=15; rampBase=12; note='Sedentario: progressione prudente.'; break;
    case 'ath': targetFrac=1.1; wstart=50; rampMin=20; rampMax=30; rampBase=25; note='Atleta: incremento sostenuto.'; break;
    case 'elder': targetFrac=0.7; wstart=0; rampMin=5; rampMax=10; rampBase=8; note='Anziano/frailty: rampa lenta.'; break;
    case 'ihd': targetFrac=0.85; wstart=10; rampMin=10; rampMax=15; rampBase=12; note='Cardiopatia ischemica: evitare grandi step.'; break;
    case 'hf': targetFrac=0.75; wstart=0; rampMin=5; rampMax=10; rampBase=8; note='Scompenso: rampa bassa (5–10 W/min).'; break;
    case 'copd': targetFrac=0.8; wstart=10; rampMin=10; rampMax=15; rampBase=10; note='BPCO/Asma: preferire durata >10′ con rampa 10–15.'; break;
    case 'postcovid': targetFrac=0.8; wstart=10; rampMin=10; rampMax=15; rampBase=12; note='Decondizionamento: rampa 10–15 W/min.'; break;
    default: targetFrac=0.9; wstart=20; rampMin=10; rampMax=20; rampBase=15; note='Standard.';
  }
  // Activity adjustment: +/- ~2 W/min per ogni 2 h
  const adj = Math.max(-6, Math.min(6, Math.round((act-2)/2)*2));
  let ramp = rampBase + adj;
  // Target duration 10′ to reach targetFrac * predicted
  const targetW = Math.max(40, Math.round(wp*targetFrac));
  ramp = Math.round(Math.max(rampMin, Math.min(rampMax, (targetW - wstart)/10 )));
  // Treadmill hint
  let protoText='';
  if(mode==='treadmill'){
    if(prof==='elder' || prof==='hf' || prof==='sedent') protoText='Treadmill: Modified Bruce / Naughton (step 2–3′).';
    else if(prof==='ath') protoText='Treadmill: Bruce / Ramp personalizzato (step 2′).';
    else protoText='Treadmill: Modified Bruce consigliato per 8–12′.';
  }
  // Estimated duration if Wmax equals target
  const dur = Math.max(6, Math.min(14, (targetW - wstart)/Math.max(1,ramp)));
  return {wstart, ramp, dur:+dur.toFixed(1), targetW, wp, note, protoText};
}
function pushSuggestion(prefix,s){
  $((prefix+'wstart')).value = s.wstart;
  $((prefix+'ramp')).value = s.ramp;
  $((prefix+'dur')).value = s.dur;
  const tip = $((prefix+'tip'));
  tip.innerHTML = `Suggerito: <b>start ${s.wstart} W</b>, <b>rampa ${s.ramp} W/min</b>, durata attesa ≈ <b>${s.dur}′</b>. Target ≈ ${s.targetW} W (pred. ${s.wp} W). ${s.protoText} <br><span class="small">${s.note}</span>`;
}
function suggest(prefix){ const s=suggestCore(prefix); pushSuggestion(prefix,s); show(prefix==='w_'?'watt-res':'cpet-res'); }

// ===== WATT TEST =====
function calcWatt(){
  const age=+$('w_age').value, sex=$('w_sex').value, h=+$('w_h').value, kg=+$('w_w').value;
  const mode=$('w_mode').value, ramp=+$('w_ramp').value||0, wstart=+$('w_wstart').value||0, dur=+$('w_dur').value||0;
  const wmax=+$('w_wmax').value||0; let wkg=+$('w_wkg').value; if(!(wkg>0)&&kg>0) wkg=+(wmax/kg).toFixed(2);
  const hr0=+$('w_hr0').value||0, hrp=+$('w_hrp').value||0, hrr1=+$('w_hrr1').value;
  const [pas0,pad0]=toPASPAD($('w_bp0').value), [pasp,padp]=toPASPAD($('w_bpp').value);
  const hr_th=hrMax(age), hr_pct=pct(hrp,hr_th);
  const pas_delta=pasp-pas0;
  const wpred=watt_pred(age,sex,kg);
  const wpct=pct(wmax,wpred);
  const vo2_est = (mode==='cycle' && wmax>0 && kg>0) ? vo2_cycle_mlkmin(wmax,kg) : NaN;
  const mets = isNaN(vo2_est)? '-' : (vo2_est/3.5).toFixed(1);
  const chron = (hrp-hr0)/Math.max(1,(hr_th-hr0));
  const chron_txt = chron>=0.8 ? badge('adeguata','ok') : (chron>=0.7 ? badge('borderline','warn') : badge('ridotta','bad'));
  const hrr_txt = (hrr1>=12)? badge('nella norma','ok') : (hrr1>=8 ? badge('borderline','warn') : badge('ridotto','bad'));
  const bp_txt = (pas_delta>=20 && pasp<= (sex==='M'?210:190)) ? badge('fisiologica','ok') : (pasp>(sex==='M'?210:190)? badge('ipertensiva','bad') : badge('inadeguata','warn'));
  const cap_txt = (wpct>=85)? badge('nei limiti','ok') : (wpct>=70 ? badge('liev. ridotta','warn') : badge('ridotta','bad'));

  const html = `
  <h3 class="title">Risultati Watt Test</h3>
  <div class="kpi">
    <div class="card"><div class="muted">Watt massimi</div><div class="v">${wmax||'-'} W</div></div>
    <div class="card"><div class="muted">W/kg</div><div class="v">${(wkg>0)?wkg:'-'}</div></div>
    <div class="card"><div class="muted">% predetto</div><div class="v">${isFinite(wpct)?wpct:'-'}%</div></div>
    <div class="card"><div class="muted">METs (stima)</div><div class="v">${mets}</div></div>
  </div>
  <div class="section">Interpretazione sintetica</div>
  <table>
    <tr><th>Parametro</th><th>Valore</th><th>Cut-off</th><th>Esito</th></tr>
    <tr><td>Riserva cronotropa</td><td>${Math.round(chron*100)}%</td><td>≥80%</td><td>${chron_txt}</td></tr>
    <tr><td>HR recovery 1′</td><td>${isNaN(hrr1)?'-':hrr1} bpm</td><td>≥12</td><td>${hrr_txt}</td></tr>
    <tr><td>Risposta pressoria</td><td>ΔPAS ${isNaN(pas_delta)?'-':pas_delta} (max ${pasp||'-'})</td><td>ΔPAS ≥20; max ≤ ${sex==='M'?210:190}</td><td>${bp_txt}</td></tr>
    <tr><td>Capacità funzionale</td><td>${isFinite(wpct)?wpct:'-'}% del pred.</td><td>≥85%</td><td>${cap_txt}</td></tr>
  </table>`;
  const box=$('watt-res'); box.innerHTML=html; show('watt-res');
}

// ===== CPET =====
function calcCPET(){
  const age=+$('c_age').value, sex=$('c_sex').value, kg=+$('c_w').value;
  const wstart=+$('c_wstart').value||0, dur=+$('c_dur').value||0;
  let wmax=+$('c_wmax').value||0; const wmax2=+$('c_wmax2').value||0; if(wmax2>0) wmax=wmax2;
  const vo2pk=+$('c_vo2pk').value, rer=+$('c_rer').value;
  const vevco2=+$('c_vevco2').value, o2pulse=+$('c_o2pulse').value;
  let vo2wr=+$('c_vo2wr').value;
  const hrp=+$('c_hrp').value, hrr1=+$('c_hrr1').value;
  const [pasp,padp]=toPASPAD($('c_bpp').value);
  if(!(vo2wr>0) && vo2pk>0 && kg>0 && wmax>wstart){
    const vo2_rest = 3.5*kg; // 1 MET
    vo2wr = +(((vo2pk*kg - vo2_rest)/(wmax-wstart)).toFixed(1));
  }

  const hr_th=hrMax(age), hr_pct=Math.round(100*hrp/Math.max(1,hr_th));
  const mets = vo2pk>0 ? (vo2pk/3.5).toFixed(1) : '-';
  const ve_status = (vevco2<=30)? badge('normale','ok') : (vevco2<=34? badge('borderline','warn') : badge('aumentato','bad'));
  const vwr_status = (vo2wr>=9 && vo2wr<=12) ? badge('normale','ok') : (vo2wr>=8.5 ? badge('liev. ridotto','warn') : badge('ridotto','bad'));
  const hrr_txt = (hrr1>=12)? badge('nella norma','ok') : (hrr1>=8 ? badge('borderline','warn') : badge('ridotto','bad'));
  const effort_txt = (rer>=1.10)? badge('massimale','ok') : (rer>=1.00? badge('quasi','warn'): badge('non massimale','bad'));
  const hr_txt = (hr_pct>=85)? badge('adeguata','ok') : (hr_pct>=80? badge('borderline','warn'): badge('inadeguata','bad'));
  const bp_txt = (pasp>0)? ((pasp<= (sex==='M'?210:190))? badge('ok','ok') : badge('ipertensiva','bad')) : '-';

  let perf=0;
  if(vo2pk>0){ perf+=Math.min(40,(vo2pk/50)*40); }
  if(vo2wr>0){ perf+=(vo2wr>=10?20:(vo2wr>=8.5?14:6)); }
  if(vevco2>0){ perf+=(vevco2<=30?20:(vevco2<=34?12:4)); }
  if(hrr1>0){ perf+=(hrr1>=12?10:(hrr1>=8?6:2)); }
  perf+=(hr_pct>=85?10:(hr_pct>=80?6:2));
  perf=Math.round(Math.min(100,perf));
  const perfTxt = perf>=80?'ottima':(perf>=65?'buona':(perf>=50?'discreta':'ridotta'));

  const pattern = [(vevco2>34?'ventilatorio':''),(vo2wr>0 && vo2wr<9?'periferico':''),(o2pulse>0 && o2pulse<8?'centrale':'')].filter(Boolean).join(' + ') || 'nessun pattern prevalente';

  let arena=0;
  if(vo2pk>0){ if(vo2pk<14) arena+=2; else if(vo2pk<20) arena+=1; }
  if(vevco2>0){ if(vevco2>36) arena+=2; else if(vevco2>34) arena+=1; }
  if(hrr1>0 && hrr1<12) arena+=1;
  if(rer>0 && rer<1.05) arena+=1;
  const arenaRisk = (arena<=1)? badge('basso','ok') : (arena<=3? badge('moderato','warn') : badge('alto','bad'));

  const html = `
  <h3 class="title">Risultati CPET</h3>
  <div class="kpi">
    <div class="card"><div class="muted">VO₂ picco</div><div class="v">${isNaN(vo2pk)?'-':vo2pk} ml/kg/min (${mets} METs)</div></div>
    <div class="card"><div class="muted">Watt massimi</div><div class="v">${wmax||'-'} W</div></div>
    <div class="card"><div class="muted">VE/VCO₂</div><div class="v">${isNaN(vevco2)?'-':vevco2} ${ve_status}</div></div>
    <div class="card"><div class="muted">VO₂/WR</div><div class="v">${isNaN(vo2wr)?'-':vo2wr} ml/min/W ${vwr_status}</div></div>
    <div class="card"><div class="muted">RER</div><div class="v">${isNaN(rer)?'-':rer} ${effort_txt}</div></div>
    <div class="card"><div class="muted">HR picco</div><div class="v">${hrp||'-'} bpm (${isNaN(hr_pct)?'-':hr_pct}%) ${hr_txt}</div></div>
    <div class="card"><div class="muted">HRR 1′</div><div class="v">${isNaN(hrr1)?'-':hrr1} bpm ${hrr_txt}</div></div>
  </div>

  <div class="section">Indice composito</div>
  <p class="small">Performance globale: <b>${perf}/100</b> (${perfTxt}). Pattern: <b>${pattern}</b>. PA picco: ${pasp||'-'}/${padp||'-'} ${bp_txt}</p>

  <div class="section">Score e cut-off</div>
  <table>
    <tr><th>Parametro</th><th>Valore</th><th>Cut-off clinico</th><th>Esito</th></tr>
    <tr><td>VE/VCO₂</td><td>${isNaN(vevco2)?'-':vevco2}</td><td>≤30 normale; 31–34 borderline; ≥35 patologico</td><td>${ve_status}</td></tr>
    <tr><td>VO₂/WR</td><td>${isNaN(vo2wr)?'-':vo2wr} ml/min/W</td><td>9–12 normale; &lt;8.5 ridotto</td><td>${vwr_status}</td></tr>
    <tr><td>HRR 1′</td><td>${isNaN(hrr1)?'-':hrr1} bpm</td><td>≥12 normale</td><td>${hrr_txt}</td></tr>
    <tr><td>RER</td><td>${isNaN(rer)?'-':rer}</td><td>≥1.10 massimale</td><td>${effort_txt}</td></tr>
    <tr><td>Arena (0–6)</td><td>${arena}</td><td>0–1 basso; 2–3 moderato; ≥4 alto</td><td>${arenaRisk}</td></tr>
  </table>`;

  const box=$('cpet-res'); box.innerHTML=html; show('cpet-res');
}

// ===== SPIROMETRY (GLI-like simplified) =====
function predSpiro(sex, age, Hcm){
  const H=Math.log(Hcm), A=Math.log(age);
  if(sex==='F'){
    return {
      FEV1: Math.exp(-10.901689 + 2.385928*H - 0.076386*A),
      FVC:  Math.exp(-12.055901 + 2.621579*H - 0.035975*A),
      R:    Math.exp(0.9189568 - 0.1840671*H - 0.0461306*A)
    };
  }else{
    return {
      FEV1: Math.exp(-11.399108 + 2.462664*H - 0.011394*A),
      FVC:  Math.exp(-12.629131 + 2.727421*H + 0.009174*A),
      R:    Math.exp(1.022608 - 0.218592*H - 0.027586*A)
    };
  }
}
function lms(sex, age){
  const A=Math.log(age);
  if(sex==='F'){
    return { Lf:1.21388, Sf:Math.exp(-2.364047 + 0.129402*A),
             Lv:0.899,   Sv:Math.exp(-2.310148 + 0.120428*A),
             Lr:6.6490 - 0.9920*A, Sr:Math.exp(-3.171582 + 0.144358*A) };
  }else{
    return { Lf:1.22703, Sf:Math.exp(-2.256278 + 0.080729*A),
             Lv:0.9346,  Sv:Math.exp(-2.195595 + 0.068466*A),
             Lr:3.8243 - 0.3328*A, Sr:Math.exp(-2.882025 + 0.068889*A) };
  }
}
function zscore(meas,L,M,S){ return L===0 ? Math.log(meas/M)/S : (Math.pow(meas/M,L)-1)/(L*S); }
function llnFromZ(L,M,S){ const z=-1.645; return L===0 ? M*Math.exp(z*S) : M*Math.pow(1+L*S*z,1/L); }

function calcSpiro(){
  const age=+$('s_age').value, sex=$('s_sex').value, H=+$('s_h').value;
  const FEV1m=+$('s_fev1').value, FVCm=+$('s_fvc').value;
  let Rm=+$('s_ratio').value; if(!(Rm>0) && FVCm>0) Rm=FEV1m/FVCm;
  const P=predSpiro(sex,age,H), L=lms(sex,age);
  const zF=zscore(FEV1m,L.Lf,P.FEV1,L.Sf), zV=zscore(FVCm,L.Lv,P.FVC,L.Sv), zR=zscore(Rm,L.Lr,P.R,L.Sr);
  const LLN_F=llnFromZ(L.Lf,P.FEV1,L.Sf), LLN_V=llnFromZ(L.Lv,P.FVC,L.Sv), LLN_R=llnFromZ(L.Lr,P.R,L.Sr);
  const pctF=Math.round(100*FEV1m/P.FEV1), pctV=Math.round(100*FVCm/P.FVC), pctR=Math.round(100*Rm/P.R);
  const obstructive = Rm < LLN_R;
  const restrictive = (!obstructive && FVCm < LLN_V);
  const mixed = (obstructive && FVCm < LLN_V);
  let pattern='normale'; if(mixed) pattern='misto'; else if(obstructive) pattern='ostruttivo'; else if(restrictive) pattern='restrittivo';

  const res=$('spiro-res');
  res.innerHTML = `
  <h3 class="title">Risultati Spirometria</h3>
  <div class="kpi">
    <div class="card"><div class="muted">FEV₁</div><div class="v">${FEV1m.toFixed(2)} L</div><div class="muted">${pctF}% del pred.</div></div>
    <div class="card"><div class="muted">FVC</div><div class="v">${FVCm.toFixed(2)} L</div><div class="muted">${pctV}% del pred.</div></div>
    <div class="card"><div class="muted">FEV₁/FVC</div><div class="v">${Rm.toFixed(2)}</div><div class="muted">${pctR}% del pred.</div></div>
    <div class="card"><div class="muted">Pattern</div><div class="v">${pattern}</div></div>
  </div>
  <div class="section">Dettaglio (predetti, LLN, Z-score)</div>
  <table>
    <tr><th>Parametro</th><th>Misurato</th><th>Predetto</th><th>LLN</th><th>% pred.</th><th>Z</th></tr>
    <tr><td>FEV₁</td><td>${FEV1m.toFixed(2)}</td><td>${P.FEV1.toFixed(2)}</td><td>${LLN_F.toFixed(2)}</td><td>${pctF}%</td><td>${zF.toFixed(2)}</td></tr>
    <tr><td>FVC</td><td>${FVCm.toFixed(2)}</td><td>${P.FVC.toFixed(2)}</td><td>${LLN_V.toFixed(2)}</td><td>${pctV}%</td><td>${zV.toFixed(2)}</td></tr>
    <tr><td>FEV₁/FVC</td><td>${Rm.toFixed(2)}</td><td>${P.R.toFixed(2)}</td><td>${LLN_R.toFixed(2)}</td><td>${pctR}%</td><td>${zR.toFixed(2)}</td></tr>
  </table>`;
  show('spiro-res');
}

// PWA
if('serviceWorker' in navigator){ window.addEventListener('load', ()=>navigator.serviceWorker.register('sw.js')); }
