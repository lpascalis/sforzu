const $ = s=>document.querySelector(s);
const show = id => { document.querySelectorAll('section.card').forEach(s=>s.classList.add('hidden')); $(id).classList.remove('hidden'); window.scrollTo(0,0); };
document.addEventListener('click', e=>{ const go=e.target.getAttribute('data-go'); if(go){ e.preventDefault(); show('#'+go);} });
window.addEventListener('load',()=>{ if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js'); });

// Toggle spirometry block
$('#cpet_spiro').addEventListener('change',()=>{ if($('#cpet_spiro').value==='si') $('#spiro_block').classList.remove('hidden'); else $('#spiro_block').classList.add('hidden'); });

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
function hrMax(age, formula){ return (formula==='tanaka') ? (208 - 0.7*age) : (220 - age); }
function badge(text, status){ const cls=status==='ok'?'ok':status==='warn'?'warn':'risk'; return `<span class="badge ${cls}">${text}</span>`; }

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

function calcCPET(){
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

  const badges = {
    vevco2: vevco2<30 ? badge('normale','ok') : vevco2<36 ? badge('intermedio','warn') : badge('elevato','risk'),
    rer: rer>=1.10 ? badge('massimale','ok') : badge('non massimale','warn'),
    at: (at/vo2pk)>=0.40 ? badge('adeguato','ok') : badge('basso','warn')
  };

  let html = `
    <h3>Risultati CPET</h3>
    <div class="kv">
      <div><span>VO₂ picco</span><strong>${vo2pk.toFixed(1)} ml/kg/min</strong></div>
      <div><span>AT</span><strong>${at.toFixed(1)} ml/kg/min ${badges.at}</strong></div>
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
  if (rer<1.10) concl.push('Test non pienamente massimale (RER<1.10)');
  if (vevco2>=36) concl.push('Inefficienza ventilatoria (VE/VCO₂ elevato)');
  if ((at/vo2pk)<0.40) concl.push('AT basso in % del VO₂ picco');
  if (concl.length===0) concl.push('CPET nei limiti principali con buona risposta cardiorespiratoria');
  html += `<h4 class="mt">Conclusione</h4><div class="hint">${concl.join(' · ')}</div>`;

  // Optional spirometry quick check
  if($('#cpet_spiro').value==='si'){
    const age=+$('#c_age').value, sex=$('#c_sex').value, h=+$('#c_height').value/100;
    const fev1=+$('#sp_fev1').value, fvc=+$('#sp_fvc').value, ratio=+$('#sp_ratio').value;
    // Simple GLI-like predicted (very simplified, for placeholder)
    const predFEV1 = (sex==='M' ? 0.0414 : 0.0342)*h*100 + (sex==='M'?2.190:1.578) - 0.03*age;
    const predFVC  = (sex==='M' ? 0.0550 : 0.0425)*h*100 + (sex==='M'?1.850:1.350) - 0.025*age;
    const predRatio = sex==='M'?78:80;
    const pctFEV1 = 100*fev1/Math.max(0.1,predFEV1);
    const pctFVC = 100*fvc/Math.max(0.1,predFVC);
    const pctRatio = 100*(ratio/Math.max(1,predRatio));
    const ratioLLN = sex==='M'?70:71;
    html += `
      <h4 class="mt">Spirometria (check rapido)</h4>
      <div class="kv">
        <div><span>FEV₁ % pred</span><strong>${pctFEV1.toFixed(0)}%</strong></div>
        <div><span>FVC % pred</span><strong>${pctFVC.toFixed(0)}%</strong></div>
        <div><span>FEV₁/FVC</span><strong>${ratio.toFixed(0)}% ${ratio<ratioLLN?badge('sotto LLN','risk'):badge('nella norma','ok')}</strong></div>
      </div>`;
  }

  $('#cpet_results').innerHTML = html;
  $('#cpet_results').classList.remove('hidden');
}
