/* PWA */
let deferredPrompt; const installBtn=document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;installBtn.hidden=false;});
installBtn?.addEventListener('click',async()=>{installBtn.hidden=true;await deferredPrompt.prompt();deferredPrompt=null;});
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js');}

const $=(id)=>document.getElementById(id);

/* Wizard */
let MODE=null; // 'watt'|'cpet'
function goto(step){
  document.querySelectorAll('.step').forEach(s=>s.classList.remove('active'));
  const el=document.querySelector(`.step[data-step="${step}"]`); if(el){el.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'});}
}
$('choose_watt').addEventListener('click',()=>{ MODE='watt'; $('spiro_block').classList.add('hidden'); goto(1); });
$('choose_cpet').addEventListener('click',()=>{ MODE='cpet'; $('spiro_block').classList.remove('hidden'); goto(1); });

/* Helpers */
function reqPos(v,n){ const x=+v; if(!isFinite(x)||x<=0) throw new Error(`${n}: inserire un valore > 0`); return x; }
function pct(a,b){ return (isFinite(a)&&isFinite(b)&&b>0)? 100*a/b : NaN; }
function round(x,n=0){ const p=10**n; return Math.round(x*p)/p; }

/* Predetti rapidi (educativi) */
function quickPred(age,sex,h_cm){
  const h=h_cm/100; let fev1,fvc;
  if(sex==='M'){ fev1=0.553*h**2.6 - 0.013*age; fvc=0.578*h**2.9 - 0.015*age; }
  else{ fev1=0.433*h**2.6 - 0.011*age; fvc=0.489*h**2.9 - 0.013*age; }
  fev1=Math.max(0.8,fev1); fvc=Math.max(1.0,fvc);
  let vo2kg=(sex==='M'?50:42) - 0.25*age; vo2kg=Math.max(14,vo2kg);
  return {fev1,fvc,vo2kg};
}
document.addEventListener('click',(e)=>{
  if(e.target&&e.target.id==='wiz_calc'){
    try{
      const age=reqPos(($('wiz_age')||{}).value||$('age').value,'Età'), sex=($('wiz_sex')||{}).value||$('sex').value, h=reqPos(($('wiz_h')||{}).value||$('height').value,'Altezza');
      const p=quickPred(age,sex,h);
      $('wiz_out').innerHTML=`<p>Predetti rapidi → FEV₁ ≈ <b>${p.fev1.toFixed(2)} L</b>, FVC ≈ <b>${p.fvc.toFixed(2)} L</b>, VO₂/kg ≈ <b>${p.vo2kg.toFixed(1)}</b> mL·kg⁻¹·min⁻¹</p>`;
    }catch(err){ $('wiz_out').innerHTML=`<p style="color:#ff8a8a">⚠️ ${err.message}</p>`; }
  }
  if(e.target&&e.target.id==='wiz_apply'){
    try{
      const age=reqPos(($('wiz_age')||{}).value||$('age').value,'Età'), sex=($('wiz_sex')||{}).value||$('sex').value, h=reqPos(($('wiz_h')||{}).value||$('height').value,'Altezza');
      const p=quickPred(age,sex,h);
      if($('sp_fev1_pred')) $('sp_fev1_pred').value=p.fev1.toFixed(2);
      if($('sp_fvc_pred')) $('sp_fvc_pred').value=p.fvc.toFixed(2);
      $('wiz_out').innerHTML='<p>Predetti applicati.</p>';
    }catch(err){ $('wiz_out').innerHTML=`<p style="color:#ff8a8a">⚠️ ${err.message}</p>`; }
  }
});

/* STEP1 → Calcola predetti e continua */
$('step1_next').addEventListener('click',()=>{
  try{
    const age=reqPos($('age').value,'Età'), sex=$('sex').value, h=reqPos($('height').value,'Altezza'), w=reqPos($('weight').value,'Peso');
    let base=quickPred(age,sex,h).vo2kg;
    if($('p_hf').checked) base*=0.78;
    if($('p_copd').checked) base*=0.85;
    if($('p_ob').checked) base*=0.92;
    if($('p_elder').checked) base*=0.92;
    if($('p_ath').checked) base*=1.10;
    const vo2kg_pred=round(base,1), vo2_pred=round(vo2kg_pred*w,0);

    let spiroTxt=''; if(MODE==='cpet'){
      const FEV1= +$('sp_fev1').value, FVC= +$('sp_fvc').value;
      let ratio= +$('sp_ratio').value; if(!isFinite(ratio)&&isFinite(FEV1)&&isFinite(FVC)&&FVC>0) ratio=100*FEV1/FVC;
      const MVV= isFinite(+$('sp_mvv').value)? +$('sp_mvv').value : (isFinite(FEV1)? 40*FEV1: NaN);
      const LLN= +$('sp_ratio_lln').value || 70; const ratioAbn= isFinite(ratio)? (ratio<LLN): false;
      const fev1pred= +$('sp_fev1_pred').value, fvcpred= +$('sp_fvc_pred').value;
      const fev1pct=pct(FEV1,fev1pred), fvcpct=pct(FVC,fvcpred);
      let pattern='';
      if(ratioAbn && isFinite(fev1pct)) pattern='Ostruttivo' + (fev1pct<50?' severo':(fev1pct<80?' moderato':' lieve'));
      else if(!ratioAbn && isFinite(fvcpct) && fvcpct<80) pattern='Restrittivo (sospetto)';
      if(ratioAbn && isFinite(fvcpct) && fvcpct<80) pattern='Misto';
      spiroTxt=`Spirometria: ${isFinite(ratio)?'FEV₁/FVC '+ratio.toFixed(1)+'% (LLN '+LLN+'%) — ':''}${pattern||'n.d.'}. MVV ${isFinite(MVV)? Math.round(MVV):'n.d.'} L/min.`;
    }

    $('pred_summary').innerHTML=`<p><b>Predetti</b> — VO₂ ≈ <b>${vo2_pred} mL/min</b> (${vo2kg_pred} mL·kg⁻¹·min⁻¹). ${spiroTxt}</p>`;
    goto(2);
  }catch(e){ $('pred_summary').innerHTML=`<p style="color:#ff8a8a">⚠️ ${e.message}</p>`; }
});

/* STEP 2 Protocollo */
function refreshProtocol(){
  const mode=$('proto_type').value, t= +$('target_min').value||10, start= +$('start_w').value||20, gain= +$('gain').value||10;
  let inc= +$('inc_w').value||15; let txt='';
  if(mode==='ramp'){
    const vo2= parseFloat(($('pred_summary').innerText.match(/VO₂ ≈ (\d+)/)||[])[1]) || (250+(t-8)*80);
    const targetW= start + Math.max(0, Math.round((vo2-250)/gain));
    const steps=Math.max(8,Math.round(t));
    inc=Math.max(5, Math.round((targetW-start)/steps/5)*5);
    const endW=start+inc*steps;
    txt=`Rampa consigliata: +${inc} W/min da ${start} W → fine ≈ ${endW} W.`;
  }else if(mode==='step'){
    const stepMin= +$('step_min').value||2; const nSteps=Math.max(3,Math.round(t/stepMin));
    const endW=start+inc*(nSteps-1);
    txt=`Step: ${nSteps} × ${stepMin}' con incrementi +${inc} W → ultimo ${endW} W.`;
  }else if(mode==='constant'){
    txt=`Carico costante suggerito: ${start} W per ${t} minuti.`;
  }else if(mode==='monark'){
    txt=`Usa il convertitore kgf↔W (W = 6.12×kgf×rpm) per definire il carico.`;
  }
  $('proto_out').innerHTML=`<p>${txt}</p>`;
  document.getElementById('monark_block').style.display=(mode==='monark'?'block':'none');
}
['proto_type','target_min','start_w','inc_w','step_min','gain'].forEach(id=>$(id).addEventListener('input',refreshProtocol));
refreshProtocol();
$('back_to_1').addEventListener('click',()=>goto(1));
$('step2_next').addEventListener('click',()=>goto(3));

/* Monark */
$('m_from_kgf').addEventListener('click',()=>{const rpm=+$('m_rpm').value||60, kgf=+$('m_kgf').value||0; const w=6.12*rpm*kgf; $('m_w').value=Math.round(w); $('m_out').innerHTML=`<p>W = 6.12 × ${kgf} × ${rpm} ≈ <b>${Math.round(w)} W</b></p>`;});
$('m_from_w').addEventListener('click',()=>{const rpm=+$('m_rpm').value||60, w=+$('m_w').value||0; const kgf=w/(6.12*rpm); $('m_kgf').value=kgf.toFixed(2); $('m_out').innerHTML=`<p>kgf ≈ <b>${kgf.toFixed(2)}</b> (a ${rpm} rpm)</p>`;});

/* STEP 3 → Analizza risultati */
$('back_to_2').addEventListener('click',()=>goto(2));
$('step3_next').addEventListener('click',()=>{
  try{
    const pm=$('pred_summary').innerText.match(/VO₂ ≈ (\d+) mL\/min \(([\d\.]+) mL·kg⁻¹·min⁻¹\)/);
    const vo2kg_pred= pm? +pm[2] : NaN; const w= +$('weight').value||NaN;
    const vo2pk= +$('r_vo2pk').value||NaN; let vo2kg= +$('r_vo2kg').value||NaN; if(!isFinite(vo2kg)&&isFinite(vo2pk)&&isFinite(w)&&w>0) vo2kg=vo2pk/w;
    const slope= +$('r_slope').value||NaN, oues= +$('r_oues').value||NaN, vemax= +$('r_vemax').value||NaN;
    const hrmax= +$('r_hrmax').value||NaN, hrr= +$('r_hrr').value||NaN, rer= +$('r_rer').value||NaN, spo2= +$('r_spo2').value||NaN;

    let fev1= +$('sp_fev1').value||NaN; let mvv= +$('sp_mvv').value||NaN; if(!isFinite(mvv)&&isFinite(fev1)) mvv=40*fev1;
    const BR= (isFinite(mvv)&&isFinite(vemax))? 100*(1 - vemax/mvv) : NaN;
    const vo2kg_pct= (isFinite(vo2kg)&&isFinite(vo2kg_pred))? 100*vo2kg/vo2kg_pred : NaN;

    function class3(v,low,high){ if(!isFinite(v)) return 'n.d.'; return v<low?'basso':(v>high?'alto':'nei limiti'); }
    const slopeTxt=class3(slope,36,40);
    let eff=''; if(isFinite(vo2kg_pct)){ eff = vo2kg_pct<50?'marcatamente ridotta':(vo2kg_pct<80?'ridotta':'nei limiti'); }
    let brTxt='n.d.'; if(isFinite(BR)) brTxt = BR<10?'quasi assente (≤10%)':(BR<20?'ridotta (10–20%)':'conservata (≥20%)');
    let hrrTxt='n.d.'; if(isFinite(hrr)) hrrTxt = hrr<6?'marcatamente ridotto':(hrr<12?'ridotto':'nei limiti');

    let rep='';
    rep += `EFFICIENZA GLOBALE\n`;
    rep += `La capacità aerobica massimale risulta ${eff}` + (isFinite(vo2kg)? `, con VO₂ peak pari a ${round(vo2kg,1)} mL·kg⁻¹·min⁻¹`:'') + (isFinite(vo2kg_pct)? ` (${round(vo2kg_pct)}% del predetto)`:'') + `.\n`;
    if(isFinite(vo2pk)) rep += `Il valore assoluto di VO₂ peak è ${Math.round(vo2pk)} mL/min.\n`;

    rep += `\nVENTILAZIONE\n`;
    if(isFinite(slope)) rep += `La pendenza VE/VCO₂ è ${round(slope,1)} (${slopeTxt}); `;
    if(isFinite(BR)) rep += `la riserva ventilatoria (BR) è ${Math.round(BR)}%, ${brTxt}. `;
    if(isFinite(oues)) rep += `L'OUES risulta ${round(oues,2)}.`;

    rep += `\n\nRISPOSTA CARDIACA\n`;
    if(isFinite(hrmax)) rep += `La frequenza cardiaca massima raggiunta è ${Math.round(hrmax)} bpm. `;
    if(isFinite(hrr)) rep += `Il recupero a 1 minuto (HRR1) è ${Math.round(hrr)} bpm, ${hrrTxt}.`;

    rep += `\n\nSCAMBI GASSOSI E SATURAZIONE\n`;
    if(isFinite(rer)) rep += `Il RER massimo è ${round(rer,2)}, ` + (rer>=1.10?'coerente con sforzo massimale.':'che potrebbe indicare sforzo non pienamente massimale.') + ` `;
    if(isFinite(spo2)) rep += `La saturazione minima rilevata è ${Math.round(spo2)}%.`;

    rep += `\n\nSINTESI CLINICA\n`;
    const flags=[];
    if(isFinite(vo2kg_pct)&&vo2kg_pct<80) flags.push('ridotta capacità aerobica');
    if(isFinite(slope)&&slope>=36&&slope<40) flags.push('inefficienza ventilatoria lieve-intermedia');
    if(isFinite(slope)&&slope>=40) flags.push('inefficienza ventilatoria moderata-severa');
    if(isFinite(BR)&&BR<20) flags.push('possibile limitazione ventilatoria');
    if(isFinite(hrr)&&hrr<12) flags.push('recupero cronotropico rallentato');
    rep += (flags.length? ('Quadro compatibile con '+flags.join(', ')+'.') : 'Assenza di alterazioni di rilievo in base ai parametri inseriti.') + `\n`;

    $('report').textContent=rep; goto(4);
  }catch(e){ $('report').textContent='Errore nella generazione del referto: '+e.message; goto(4); }
});

/* Restart */
$('restart').addEventListener('click',()=>{
  MODE=null;
  document.querySelectorAll('input').forEach(i=>i.value='');
  document.querySelectorAll('select').forEach(s=>s.selectedIndex=0);
  document.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=false);
  $('pred_summary').innerHTML=''; const so=document.getElementById('spiro_out'); if(so) so.innerHTML=''; const wo=document.getElementById('wiz_out'); if(wo) wo.innerHTML='';
  goto(0);
});
