const $ = s=>document.querySelector(s);
const show = id => { document.querySelectorAll('section.card').forEach(s=>s.classList.add('hidden')); $(id).classList.remove('hidden'); window.scrollTo(0,0); };
document.addEventListener('click', e=>{ const go=e.target.getAttribute('data-go'); if(go){ e.preventDefault(); show('#'+go);} });
window.addEventListener('load',()=>{ if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js'); });
$('#cpet_spiro').addEventListener('change',()=>{ if($('#cpet_spiro').value==='si') $('#spiro_block').classList.remove('hidden'); else $('#spiro_block').classList.add('hidden'); });

// Utils
function hrMax(age, formula){ return (formula==='tanaka') ? (208 - 0.7*age) : (220 - age); }
function badge(text, status){ const cls=status==='ok'?'ok':status==='warn'?'warn':'risk'; return `<span class="badge ${cls}">${text}</span>`; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

// Protocol suggestions
function suggestProtocol(modality, profile, hours){
  let startW=25, ramp=15, note='';
  if(modality==='cycle'){
    switch(profile){
      case 'Atleta': startW=50; ramp=25; note='Alto condizionamento: rampa rapida.'; break;
      case 'Adulto sano / attivo': startW=30; ramp=20; note='Attivo: rampa medio-rapida.'; break;
      case 'Sedentario / decondizionato': startW=20; ramp=10; note='Decondizionato: rampa lenta.'; break;
      case 'Anziano / frailty': startW=10; ramp=10; note='Frailty: inizio basso, rampa lenta.'; break;
      case 'Cardiopatia ischemica': startW=20; ramp=10; note='Cardiopatia: rampa lenta.'; break;
      case 'Scompenso cardiaco': startW=10; ramp=10; note='HF: rampa lenta, monitoraggio.'; break;
      case 'BPCO / Asma': startW=15; ramp=10; note='Possibile limitazione ventilatoria: rampa lenta.'; break;
      case 'Post-COVID / Long-COVID': startW=15; ramp=10; note='Pacing: rampa conservativa.'; break;
    }
    if(hours>=5 && (profile==='Adulto sano / attivo' || profile==='Atleta')) ramp+=5;
  } else {
    switch(profile){
      case 'Atleta': note='Bruce / Balke veloce; target 8–10′.'; break;
      case 'Adulto sano / attivo': note='Modified Bruce; target 9–11′.'; break;
      case 'Sedentario / decondizionato': note='Naughton o Balke lento; target 10–12′.'; break;
      case 'Anziano / frailty': note='Naughton lento; corrimano; target 10–12′.'; break;
      case 'Cardiopatia ischemica': note='Modified Bruce/Naughton; monitoraggio ST.'; break;
      case 'Scompenso cardiaco': note='Naughton; step piccoli; target 10–12′.'; break;
      case 'BPCO / Asma': note='Balke lievi pendenze; attenzione dispnea.'; break;
      case 'Post-COVID / Long-COVID': note='Balke dolce; pacing; target 10–12′.'; break;
    }
  }
  return {startW, ramp, note, target:10};
}

// WATT TEST
document.addEventListener('click', (e)=>{
  if(e.target && e.target.id==='btnSuggestWT'){
    const s = suggestProtocol($('#wt_modality').value,$('#wt_profile').value,+$('#wt_hours').value);
    const box = $('#wt_suggestion');
    box.innerHTML = `<strong>Suggerimento:</strong> Carico iniziale <b>${s.startW} W</b>, rampa <b>${s.ramp} W/min</b>, durata target <b>${s.target}′</b>.<br>${s.note}`;
    box.dataset.startW=s.startW; box.dataset.ramp=s.ramp; box.dataset.target=s.target;
  }
  if(e.target && e.target.id==='btnUseSuggestionWT'){
    const box = $('#wt_suggestion'); if(!box.dataset.startW){ alert('Prima genera un suggerimento.'); return; }
    $('#wt_startW').value=box.dataset.startW; $('#wt_ramp').value=box.dataset.ramp; $('#wt_target_min').value=box.dataset.target;
  }
  if(e.target && e.target.id==='btnCalcWT') calcWattTest();
  if(e.target && e.target.id==='btnCalcCPET') calcCPET();
});

function calcWattTest(){
  const modality = $('#wt_modality').value;
  const age = +$('#age').value;
  const sex = $('#sex').value;
  const weight = +$('#weight').value;
  const onBB = $('#on_bb').value==='si';
  const formula = $('#hrmax_formula').value;

  const peakW = +$('#wt_peakW').value;
  const hrRest = +$('#hr_rest').value;
  const hr1 = +$('#hr_1min').value;
  const hrPeak = +$('#hr_peak').value;
  const sbpRest = +$('#sbp_rest').value;
  const sbpPeak = +$('#sbp_peak').value;
  const sbp1 = +$('#sbp_1min').value;
  const duration = +$('#wt_duration').value;

  const HRmax = hrMax(age, formula);
  const pctHRmax = 100 * hrPeak / HRmax;
  const chronRes = (hrPeak - hrRest) / (HRmax - hrRest);
  const chronCut = onBB ? 0.62 : 0.80;
  const chronStatus = chronRes >= chronCut ? 'ok' : 'risk';
  const HRR1 = hrPeak - hr1;
  const HRR1status = HRR1 >= 12 ? 'ok' : 'risk';

  const dSBP = sbpPeak - sbpRest;
  let bpStatus = 'ok';
  if (dSBP < 20) bpStatus = 'warn';
  if (sbpPeak < sbpRest - 10) bpStatus = 'risk';
  const hyper = (sex==='M' && sbpPeak>210) || (sex==='F' && sbpPeak>190);

  const DP = hrPeak * sbpPeak;
  let dpNote = DP < 18000 ? 'basso' : (DP<=30000 ? 'nella norma' : 'elevato');

  let vo2_mlkgmin = (10.8 * peakW / Math.max(1,weight)) + (modality==='cycle'?7:3.5);
  const METs = vo2_mlkgmin/3.5;
  let capCat = METs<5 ? 'Severamente ridotta' : METs<8 ? 'Moderatamente ridotta' : METs<10 ? 'Lievemente ridotta' : 'Nei limiti/ottima';

  const hrWorkSlope = (hrPeak - hrRest) / Math.max(1, peakW);
  const hrPer25W = hrWorkSlope * 25;
  const pressorReserve = dSBP / Math.max(1, peakW);
  const o2pulse_surr = hrPeak>0 ? ((vo2_mlkgmin*weight)/1000)/hrPeak*1000 : null;

  let html = `
    <h3>Risultati Watt Test</h3>
    <div class="kv">
      <div><span>Watt massimi</span><strong>${peakW} W</strong></div>
      <div><span>Durata</span><strong>${duration.toFixed(1)} min</strong></div>
      <div><span>FC riposo</span><strong>${hrRest} bpm</strong></div>
      <div><span>FC picco</span><strong>${hrPeak} bpm</strong></div>
      <div><span>HR recovery 1'</span><strong>${HRR1} bpm ${HRR1status==='ok'?badge('normale','ok'):badge('ridotto','risk')}</strong></div>
      <div><span>PAS riposo</span><strong>${sbpRest} mmHg</strong></div>
      <div><span>PAS picco</span><strong>${sbpPeak} mmHg ${hyper?badge('ipertensiva','warn'):''}</strong></div>
      <div><span>ΔPAS</span><strong>${dSBP} mmHg ${bpStatus==='ok'?badge('adeguata','ok'):bpStatus==='warn'?badge('bassa','warn'):badge('ipotensiva','risk')}</strong></div>
      <div><span>Doppio prodotto</span><strong>${DP.toLocaleString()} (${dpNote})</strong></div>
      <div><span>% FC max teorica</span><strong>${pctHRmax.toFixed(0)}%</strong></div>
      <div><span>Riserva cronotropa</span><strong>${(chronRes*100).toFixed(0)}% ${chronStatus==='ok'?badge('adeguata','ok'):badge('ridotta','risk')}</strong></div>
      <div><span>VO₂ stimato</span><strong>${vo2_mlkgmin.toFixed(1)} ml/kg/min</strong></div>
      <div><span>METs</span><strong>${METs.toFixed(1)} (${capCat})</strong></div>
      <div><span>HR/25W</span><strong>${hrPer25W.toFixed(1)} bpm/25W</strong></div>
      <div><span>Indice riserva pressoria</span><strong>${pressorReserve.toFixed(3)} mmHg/W</strong></div>
      <div><span>O₂ pulse (surrogato)</span><strong>${o2pulse_surr?o2pulse_surr.toFixed(1):'n.d.'} ml/batt</strong></div>
    </div>
  `;
  const concl = [];
  if (pctHRmax<85) concl.push('Sforzo potenzialmente sotto-massimale (<85% FC teorica)');
  if (chronStatus==='risk') concl.push('Riserva cronotropa ridotta');
  if (HRR1<12) concl.push('HR recovery ridotto');
  if (hyper) concl.push('Risposta pressoria ipertensiva');
  if (dSBP<20) concl.push('Aumento PAS insufficiente');
  if (capCat.includes('ridotta')) concl.push(`Capacità funzionale ${capCat.toLowerCase()}`);
  if (concl.length===0) concl.push('Risposta globale nei limiti per età e profilo');

  html += `<h4 class="mt">Conclusione</h4><div class="hint">${concl.join(' · ')}</div>`;
  $('#wt_results').innerHTML = html;
  $('#wt_results').classList.remove('hidden');
}

// ---------- CPET with predictions ----------
function vo2Pred(age, sex, modality){
  // Simple approximation: treadmill ~10% > cycle
  let base = (sex==='M') ? (60 - 0.55*age) : (48 - 0.37*age);
  if (modality==='cycle') base *= 0.90;
  return clamp(base, 10, 70);
}

// Auto-calc FEV1/FVC% when spirometry is shown
function autoRatio(){
  const fev1 = parseFloat($('#sp_fev1').value || '0');
  const fvc = parseFloat($('#sp_fvc').value || '0');
  if(fev1>0 && fvc>0){
    const r = (fev1/fvc)*100;
    $('#sp_ratio').value = r.toFixed(1);
  }
}
['input','change'].forEach(ev=>{
  document.addEventListener(ev, (e)=>{
    if(!$('#spiro_block').classList.contains('hidden')){
      if(e.target && (e.target.id==='sp_fev1' || e.target.id==='sp_fvc')) autoRatio();
    }
  });
});

function calcCPET(){
  const mod = $('#cpet_modality').value;
  const age = +$('#c_age').value;
  const sex = $('#c_sex').value;

  const vo2pk = +$('#c_vo2pk').value;
  const at = +$('#c_at').value;
  const vevco2 = +$('#c_vevco2').value;
  const oues = +$('#c_oues').value;
  const eqo2 = +$('#c_eqo2').value;
  const eqco2 = +$('#c_eqco2').value;
  const o2pulse = +$('#c_o2pulse').value;
  const rer = +$('#c_rer').value;
  const hrpk = +$('#c_hrpk').value;
  const sbp = +$('#c_sbp').value;

  // Predetti
  const vo2_pred = vo2Pred(age, sex, mod);
  const vo2_pct = 100*vo2pk/vo2_pred;
  const at_pct_vo2pred = 100*at/vo2_pred;
  const at_pct_vo2pk = 100*at/Math.max(1,vo2pk);

  const badges = {
    vevco2: vevco2<30 ? badge('normale','ok') : vevco2<36 ? badge('intermedio','warn') : badge('elevato','risk'),
    rer: rer>=1.10 ? badge('massimale','ok') : badge('non massimale','warn'),
    at: (at_pct_vo2pk)>=40 ? badge('adeguato','ok') : badge('basso','warn'),
    vo2: vo2_pct>=85 ? badge('≥85% pred','ok') : vo2_pct>=60 ? badge('60–84%','warn') : badge('<60%','risk')
  };

  let html = `
    <h3>Risultati CPET</h3>
    <div class="kv">
      <div><span>VO₂ picco</span><strong>${vo2pk.toFixed(1)} ml/kg/min (${vo2_pct.toFixed(0)}% pred) ${badges.vo2}</strong></div>
      <div><span>VO₂ predetto</span><strong>${vo2_pred.toFixed(1)} ml/kg/min</strong></div>
      <div><span>AT assoluto</span><strong>${at.toFixed(1)} ml/kg/min</strong></div>
      <div><span>AT / VO₂ picco</span><strong>${at_pct_vo2pk.toFixed(0)}% ${badges.at}</strong></div>
      <div><span>AT / VO₂ pred</span><strong>${at_pct_vo2pred.toFixed(0)}%</strong></div>
      <div><span>VE/VCO₂ slope</span><strong>${vevco2.toFixed(1)} ${badges.vevco2}</strong></div>
      <div><span>OUES</span><strong>${oues.toFixed(1)}</strong></div>
      <div><span>EqO₂</span><strong>${eqo2.toFixed(1)}</strong></div>
      <div><span>EqCO₂</span><strong>${eqco2.toFixed(1)}</strong></div>
      <div><span>O₂ pulse picco</span><strong>${o2pulse.toFixed(1)} ml/batt</strong></div>
      <div><span>RER picco</span><strong>${rer.toFixed(2)} ${badges.rer}</strong></div>
      <div><span>FC picco</span><strong>${hrpk} bpm</strong></div>
      <div><span>PAS picco</span><strong>${sbp} mmHg</strong></div>
    </div>
  `;

  const concl = [];
  if (vo2_pct<85) concl.push('VO₂ picco <85% del predetto');
  if (vevco2>=36) concl.push('Inefficienza ventilatoria (VE/VCO₂ elevato)');
  if (rer<1.10) concl.push('Test non pienamente massimale (RER<1.10)');
  if (at_pct_vo2pk<40) concl.push('AT basso rispetto al VO₂ picco');
  if (concl.length===0) concl.push('Risposta cardiorespiratoria complessivamente nei limiti');
  html += `<h4 class="mt">Conclusione</h4><div class="hint">${concl.join(' · ')}</div>`;

  // ---------- Spirometria opzionale (GLI-like simplified) ----------
  if($('#cpet_spiro').value==='si'){
    const h_m = +$('#c_height').value/100;
    const age = +$('#c_age').value;
    const sex = $('#c_sex').value;
    const fev1 = +$('#sp_fev1').value;
    const fvc = +$('#sp_fvc').value;
    const ratio = +$('#sp_ratio').value;

    const lnH = Math.log(h_m);
    const lnA = Math.log(age);
    let a_fev1, b_fev1, c_fev1, a_fvc, b_fvc, c_fvc, a_ratio, b_ratio, c_ratio;
    if (sex==='F'){
      a_fev1=-10.901689; b_fev1=2.385928; c_fev1=-0.076386;
      a_fvc=-12.055901;  b_fvc=2.621579;  c_fvc=-0.035975;
      a_ratio=0.9189568; b_ratio=-0.1840671; c_ratio=-0.0461306;
    } else {
      a_fev1=-11.399108; b_fev1=2.462664; c_fev1=-0.011394;
      a_fvc=-12.629131;  b_fvc=2.727421;  c_fvc=0.009174;
      a_ratio=1.022608;  b_ratio=-0.218592; c_ratio=-0.027586;
    }
    const predFEV1 = Math.exp(a_fev1 + b_fev1*Math.log(h_m) + c_fev1*Math.log(age));
    const predFVC  = Math.exp(a_fvc  + b_fvc *Math.log(h_m) + c_fvc *Math.log(age));
    const predRatio= 100*Math.exp(a_ratio + b_ratio*Math.log(h_m) + c_ratio*Math.log(age));

    const pctFEV1 = 100*fev1/Math.max(0.1,predFEV1);
    const pctFVC  = 100*fvc /Math.max(0.1,predFVC);
    const pctRatio= 100*(ratio/Math.max(1,predRatio));

    let L_fev1, L_fvc, L_ratio, alpha_fev1, beta_fev1, alpha_fvc, beta_fvc, alpha_ratio, beta_ratio;
    if (sex==='F'){
      L_fev1=1.21388; L_fvc=0.899; L_ratio=(6.6490 - 0.9920*Math.log(age));
      alpha_fev1=-2.364047; beta_fev1=0.129402;
      alpha_fvc=-2.310148;  beta_fvc=0.120428;
      alpha_ratio=-3.171582; beta_ratio=0.144358;
    } else {
      L_fev1=1.22703; L_fvc=0.9346; L_ratio=(3.8243 - 0.3328*Math.log(age));
      alpha_fev1=-2.256278; beta_fev1=0.080729;
      alpha_fvc=-2.195595;  beta_fvc=0.068466;
      alpha_ratio=-2.882025; beta_ratio=0.068889;
    }
    const S_fev1 = Math.exp(alpha_fev1 + beta_fev1*Math.log(age));
    const S_fvc  = Math.exp(alpha_fvc  + beta_fvc *Math.log(age));
    const S_ratio= Math.exp(alpha_ratio + beta_ratio*Math.log(age));
    function zscore(meas, L, M, S){ return ((Math.pow(meas/M, L) - 1)/(L*S)); }
    const zFEV1 = zscore(fev1, L_fev1, predFEV1, S_fev1);
    const zFVC  = zscore(fvc,  L_fvc,  predFVC,  S_fvc);
    const zRATIO= zscore(ratio/100, L_ratio, predRatio/100, S_ratio);

    const ratioLLNflag = zRATIO < -1.645;
    const pattern = ratioLLNflag ? (pctFVC<80 ? 'Ostruttivo + restrizione sospetta' : 'Ostruttivo') : (pctFVC<80 ? 'Restrittivo (sospetto)' : 'Normale');

    html += `
      <h4 class="mt">Spirometria (predetti & Z-score)</h4>
      <div class="kv">
        <div><span>FEV₁</span><strong>${fev1.toFixed(2)} L · ${pctFEV1.toFixed(0)}% pred · Z ${zFEV1.toFixed(2)} ${zFEV1<-1.645?badge('basso','risk'):badge('OK','ok')}</strong></div>
        <div><span>FVC</span><strong>${fvc.toFixed(2)} L · ${pctFVC.toFixed(0)}% pred · Z ${zFVC.toFixed(2)} ${zFVC<-1.645?badge('basso','risk'):badge('OK','ok')}</strong></div>
        <div><span>FEV₁/FVC</span><strong>${ratio.toFixed(1)}% · Z ${zRATIO.toFixed(2)} ${ratioLLNflag?badge('sotto LLN','risk'):badge('OK','ok')}</strong></div>
        <div><span>Pattern</span><strong>${pattern}</strong></div>
      </div>
    `;
  }

  $('#cpet_results').innerHTML = html;
  $('#cpet_results').classList.remove('hidden');
}
