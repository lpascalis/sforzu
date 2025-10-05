
const $=id=>document.getElementById(id);
function go(which){$('screenStart').classList.add('hidden'); if(which==='watt') $('screenWatt').classList.remove('hidden'); else $('screenCPET').classList.remove('hidden'); }
function back(){ $('screenStart').classList.remove('hidden'); $('screenWatt').classList.add('hidden'); $('screenCPET').classList.add('hidden'); }
function toggle(id){ $(id).classList.toggle('hidden'); }

// Helpers
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const round=(x,n=0)=> (isFinite(x)? Number(x).toFixed(n):'—');
const hrMax=(age,profile)=> profile==='beta'? Math.round(164 - 0.7*age) : Math.round(208 - 0.7*age);
const MET_from_Watts=(W, weightKg)=> (W>0 && weightKg>0)? (W*6.12)/(weightKg*3.5) : NaN;
const Wpred_simple=(age,sex,weight,erg)=>{ // semplice lineare per avere un riferimento
  const base = (sex==='M'? 3.0:2.2)*weight; // ~W a VO2 1 MET stepwise
  const ageCorr = (sex==='M'? 0.6:0.5)*(50-Math.min(50,age));
  const ergCorr = (erg==='cycle'? 0 : 40); // treadmill tende a valori più alti equivalenti
  return Math.max(60, Math.round(base*0.25 + ageCorr + ergCorr));
};
const tag=(condOk,condWarn)=> condOk? 'ok' : (condWarn? 'warn':'bad');
const kpi=(label,val,unit='',cls='',hint='')=> `<div class="kpi"><div>${label} <span class="small">${hint}</span></div><div><span class="tag ${cls}">${val}${unit? ' '+unit:''}</span></div></div>`;

// -------------------- WATT --------------------
function suggestWatt(){
  const erg=$('wt_erg').value, profile=$('wt_profile').value, age=+$('wt_age').value, sex=$('wt_sex').value, w=+$('wt_w').value;
  const Wpred=Wpred_simple(age,sex,w,erg);
  let ramp = 15; let start=20;
  if(profile==='athlete'){ ramp=25; start=30; }
  if(profile==='ihd'){ ramp=10; start=10; }
  if(profile==='beta'){ ramp=10; }
  $('wt_ramp').value=ramp; $('wt_wpk').placeholder=`~${Math.round(Wpred*0.9)} W`;
  $('wt_out').innerHTML = `<div class="muted">Suggerimento protocollo: start ${start} W, rampa ${ramp} W/min • Pred. Watt ≈ ${Wpred} W</div>`;
}

function calcWatt(){
  const erg=$('wt_erg').value, profile=$('wt_profile').value;
  const age=+$('wt_age').value, sex=$('wt_sex').value, w=+$('wt_w').value, h=+$('wt_h').value;
  const hrR=+$('wt_hrR').value, hrP=+$('wt_hrP').value, hr1=+$('wt_hr1').value;
  const sbpR=+$('wt_sbpR').value, sbpP=+$('wt_sbpP').value, sbpRec=+$('wt_sbpRec').value;
  const dur=+$('wt_dur').value, ramp=+$('wt_ramp').value, Wpk=+$('wt_wpk').value;

  const HRT = hrMax(age,profile);
  const Wpred = Wpred_simple(age,sex,w,erg);
  const met = MET_from_Watts(Wpk, w);
  const metPred = MET_from_Watts(Wpred, w);
  const pctW = Wpk>0? Math.round(100*Wpk/Wpred): NaN;
  const chronoRes = (hrP-hrR)/(HRT-hrR);
  const chronTag = tag(chronoRes>=0.8, chronoRes>=0.62);
  const hrRec = hrP>0 && hr1>0 ? (hrP-hr1): NaN;
  const hrRecTag = tag(hrRec>=12, hrRec>=8);
  const pasRise = (sbpP>0 && sbpR>0) ? sbpP - sbpR : NaN;
  const pasTag = tag((pasRise>=20 && sbpP<230), (pasRise>=10 && sbpP<230));

  let k=[];
  k.push(kpi("Watt picco", isFinite(Wpk)?Wpk:'—', "W"));
  k.push(kpi("Watt/kg", isFinite(Wpk)&&w? round(Wpk/w,2):'—', "W/kg"));
  k.push(kpi("% Watt predetto", isFinite(pctW)? pctW : '—', "%"));
  k.push(kpi("METs (ciclo, stima)", isFinite(met)? round(met,1):'—', "MET", '', `Pred: ${isFinite(metPred)? round(metPred,1):'—'}`));
  if(dur) k.push(kpi("Durata esercizio", round(dur,1), "min"));
  if(ramp) k.push(kpi("Rampa", ramp, "W/min"));
  if(hrR) k.push(kpi("FC riposo", hrR, "bpm"));
  if(hrP) k.push(kpi("FC picco", hrP, "bpm", tag(hrP>=0.85*HRT, hrP>=0.8*HRT), `Teorica ${HRT} bpm`));
  if(isFinite(chronoRes)) k.push(kpi("Riserva cronotropa", round(chronoRes,2), "", chronTag, chronoRes>=0.8?"Adeguata":(chronoRes>=0.62?"Borderline":"Ridotta")));
  if(isFinite(hrRec)) k.push(kpi("HR recovery 1’", hrRec, "bpm", hrRecTag, hrRec>=12?"Adeguato":(hrRec>=8?"Borderline":"Ridotto")));
  if(sbpR) k.push(kpi("PAS riposo", sbpR, "mmHg"));
  if(sbpP) k.push(kpi("PAS picco", sbpP, "mmHg", pasTag, (pasRise?`Δ ${pasRise} mmHg`:"")));
  if(sbpRec) k.push(kpi("PAS 3’ recupero", sbpRec, "mmHg"));

  $('wt_out').innerHTML = `<h3>Risultati</h3>${k.join('')}`;
}

// -------------------- CPET --------------------
function suggestCPET(){
  const erg=$('cp_erg').value, profile=$('cp_profile').value, age=+$('cp_age').value, sex=$('cp_sex').value, w=+$('cp_w').value;
  const Wpred=Wpred_simple(age,sex,w,erg);
  const ramp = (profile==='athlete')? 25 : (profile==='ihd'||profile==='beta'?10:15);
  $('cp_out').innerHTML = `<div class="muted">Suggerimento: rampa ${ramp} W/min • riferimento Watt ≈ ${Wpred} W • obiettivo 8–12 min</div>`;
}

function calcCPET(){
  const age=+$('cp_age').value, sex=$('cp_sex').value, w=+$('cp_w').value, h=+$('cp_h').value;
  const vo2=+$('cp_vo2pk').value, vat=+$('cp_vat').value, rer=+$('cp_rer').value;
  const slope=+$('cp_slope').value, dvow=+$('cp_dvow').value, oues=+$('cp_oues').value;
  const vepk=+$('cp_vepk').value, mvvIn=+$('cp_mvv').value, spo2=+$('cp_spo2').value;
  const fev1=+$('sp_fev1').value, fvc=+$('sp_fvc').value, ratio=+$('sp_ratio').value;

  // Predetti basilari (semplificati): VO2peak/kg
  const vo2pred = (sex==='M'? 45 : 38) - 0.2*(age-30); // riferimento grezzo per avere %
  const vo2pct = isFinite(vo2) ? Math.round(100*vo2/vo2pred) : NaN;

  // Weber class (cardio-centric) basata su VO2peak/kg
  const weber = isFinite(vo2)? (vo2<10?'D': vo2<14?'C': vo2<20?'B':'A') : '—';

  // VE/VCO2 slope classi
  let slopeTag='', slopeTxt='—';
  if(slope){
    if(slope<30){ slopeTag='ok'; slopeTxt='<30 (migliore prognosi)'; }
    else if(slope<36){ slopeTag='warn'; slopeTxt='30–35 (intermedio)'; }
    else { slopeTag='bad'; slopeTxt='≥36 (sfavorevole)'; }
  }

  // BR% (VE/MVV)
  let MVV = mvvIn>0? mvvIn : (fev1>0? fev1*40 : NaN);
  let br = (vepk>0 && MVV>0)? 100*vepk/MVV : NaN;
  let brTag='', brHint=''; 
  if(isFinite(br)){
    if(br<80){ brTag='ok'; brHint='normale'; }
    else if(br<=85){ brTag='warn'; brHint='borderline'; }
    else { brTag='bad'; brHint='limitazione ventilatoria'; }
  }

  // Pattern spirometrico (GLI-lite, senza tabelle): soglie pragmatiche se assenti LMS
  let spTxt='—', spTag='';
  if(fev1 && fvc){
    const ratioCalc = ratio? ratio : (100*fev1/fvc);
    let llr = age>=40? 70 : 75; // cut pragmatico % per semplicità
    if(ratioCalc < llr){
      spTag='bad'; spTxt='ostruttivo probabile';
    } else {
      // poss restrizione se FVC bassa vs attesa grezza
      const fvcPred = (sex==='M'? (0.063*h - 5.5) : (0.049*h - 3.6)); // litri approssimativi
      if(fvc < 0.8*fvcPred){ spTag='warn'; spTxt='possibile restrizione'; }
      else { spTag='ok'; spTxt='nei limiti'; }
    }
  }

  // Conclusione compatta
  let patt=[];
  if(isFinite(vo2pct) && vo2pct<80) patt.push('bassa capacità aerobica');
  if(slopeTag==='bad') patt.push('ventilazione inefficiente');
  if(brTag==='bad') patt.push('riserva ventilatoria ridotta');
  if(spo2 && spo2<94) patt.push('desaturazione da sforzo');
  if(patt.length===0) patt.push('performance globale nei limiti o lievi alterazioni');

  let k=[];
  if(isFinite(vo2)) k.push(kpi("VO₂ picco", round(vo2,1), "ml/kg/min", tag(vo2>=vo2pred*0.8, vo2>=vo2pred*0.7), `Pred ~${round(vo2pred,0)} • ${isFinite(vo2pct)?vo2pct+'%':''}`));
  if(isFinite(vat)) k.push(kpi("Soglia anaerobica (AT)", round(vat,1), "ml/kg/min", tag(vat>=0.4*vo2pred, vat>=0.3*vo2pred)));
  if(rer) k.push(kpi("RER picco", round(rer,2), "", tag(rer>=1.10, rer>=1.05), rer>=1.10?"massimale":""));
  if(slope) k.push(kpi("VE/VCO₂ slope", round(slope,1), "", slopeTag, slopeTxt));
  if(isFinite(dvow)) k.push(kpi("ΔVO₂/ΔW", round(dvow,0), "ml/min/W", tag(dvow>=8, dvow>=7)));
  if(isFinite(oues)) k.push(kpi("OUES", round(oues,2), "", tag(oues>=1.4, oues>=1.2)));
  if(isFinite(br)) k.push(kpi("BR% (VE/MVV)", round(br,0), "%", brTag, brHint));
  if(spo2) k.push(kpi("SpO₂ minima", round(spo2,0), "%", tag(spo2>=94, spo2>=90)));
  if(fev1||fvc||ratio) k.push(kpi("Spirometria (pattern)", spTxt, "", spTag));

  $('cp_out').innerHTML = `<h3>Risultati</h3>${k.join('')}<hr><div class="muted">Conclusione: ${patt.join(' • ')}</div><div class="small muted">Nota: interpretazione automatica di supporto clinico, non sostituisce il giudizio medico.</div>`;
}

