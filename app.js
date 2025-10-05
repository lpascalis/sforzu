
const $ = (id)=>document.getElementById(id);
let flow = { exam:null, step:0 };

const steps = ["wizard","stepErgo","stepPatient","stepProtocol","stepMeasuresWatt","stepMeasuresCPET","results"];

function show(id){ steps.forEach(s=> $(s)?.classList.add('hide')); $(id).classList.remove('hide'); }
function go(i){ flow.step=i; show(steps[i]); }

// Start buttons
$("btnWatt").onclick = ()=>{ flow.exam="watt"; go(1); };
$("btnCPET").onclick = ()=>{ flow.exam="cpet"; go(1); $("spiromOpt").classList.remove('hide'); };

// Suggest protocol
$("btnSuggest").onclick = ()=>{
  const ergo = $("ergometer").value, prof = $("profile").value;
  const target = parseFloat($("targetDur").value || "10");
  const weekly = parseFloat($("weeklyPA").value || "0");
  let ramp, startW=20, txt=[];

  // simple heuristic: aim target duration reaching VO2peak around 8-12 min
  if(ergo==="cycle"){
    ramp = 15; // default
    if(prof==="athlete" || weekly>=5) ramp = 25;
    if(prof==="elderly" || weekly<1) ramp = 10;
    if(prof==="ischemic" || prof==="hf") ramp = 10;
    if(prof==="copd") ramp = 10;
    if(prof==="beta") ramp = 10;
    txt.push(`Cicloergometro: rampa suggerita ${ramp} W/min, carico iniziale ${startW} W.`);
  }else{
    // treadmill: suggest stage protocol emphasis
    ramp = 0; // N/A numeric, but provide hint
    txt.push(`Treadmill: suggerito protocollo a stadi moderati (es. Bruce modificato o rampa lenta) per ~${target} min di esercizio.`);
  }

  $("suggestOut").innerText = txt.join(" ");
  flow._suggest = {ramp, startW};
};

$("btnUseSuggest").onclick = ()=>{
  if(flow._suggest){
    if(flow._suggest.ramp>0) $("ramp").value = flow._suggest.ramp;
    $("startW").value = flow._suggest.startW || 20;
  }
};

// Navigation
$("prev").onclick = ()=>{
  if(flow.step>0){ go(flow.step-1); }
};

$("next").onclick = ()=>{
  // guard transitions per exam
  if(flow.step===1){ go(2); return; } // after ergometer
  if(flow.step===2){ go(3); return; } // after patient
  if(flow.step===3){
    if(flow.exam==="watt") { go(4); return; }
    if(flow.exam==="cpet") { go(5); return; }
  }
  if(flow.step===4 || flow.step===5){ go(6); return; } // results
};

$("calc").onclick = ()=>{
  if(flow.exam==="watt") computeWatt();
  else computeCPET();
  go(6);
};

/* ---------- Utils ---------- */
const ln = Math.log;
function clamp(x,min,max){ return Math.min(max, Math.max(min,x)); }
function sexFactor(sex, m, f){ return sex==="M" ? m : f; }
function fcMax(age){
  // Use Tanaka for better accuracy
  return Math.round(208 - 0.7*age);
}
function bmi(w,hcm){ const m=hcm/100; return w/(m*m); }
function MET_from_Watts(watt, weight){ // rough 1 MET = 3.5 ml/kg/min, 1 W ~ 12 ml/min O2
  // VO2 (ml/min) ≈ 12 * W (cycle). Then MET = (VO2/kg)/3.5
  return watt>0 && weight>0 ? ( (12*watt)/weight )/3.5 : 0;
}


// --- Added helpers v9.7 ---
function mapFromBP(sbp, dbp){ if(!sbp||!dbp) return NaN; return Math.round(dbp + (sbp-dbp)/3); }
function brPercent(vepk, mvv){ if(!vepk||!mvv) return NaN; return 100*vepk/mvv; }

/* ---------- Spirometry GLI-lite (no spline tables) ----------
   Using simplified log-linear GLI-like forms (spline terms ≈ 0).
   LLN via LMS with fixed L by sex and S modeled on ln(Age).
   These produce consistent relative behavior and LLN/borderline flags.
*/
function spiroPred(sex, age, height_cm){
  const H = ln(height_cm); const A = ln(age);
  let FEV1p, FVCp, RATIOp, Lf, Lfvc, Lratio, Sfev1, Sfvc, Sratio;

  if(sex==="F"){
    FEV1p = Math.exp(-10.901689 + 2.385928*H - 0.076386*A);
    FVCp  = Math.exp(-12.055901 + 2.621579*H - 0.035975*A);
    RATIOp= Math.exp(0.9189568 - 0.1840671*H - 0.0461306*A);
    Lf = 1.21388; Lfvc=0.899; Lratio = (6.6490 - 0.9920*A);
    Sfev1 = Math.exp(-2.364047 + 0.129402*A);
    Sfvc  = Math.exp(-2.310148 + 0.120428*A);
    Sratio= Math.exp(-3.171582 + 0.144358*A);
  }else{
    FEV1p = Math.exp(-11.399108 + 2.462664*H - 0.011394*A);
    FVCp  = Math.exp(-12.629131 + 2.727421*H + 0.009174*A);
    RATIOp= Math.exp(1.022608   - 0.218592*H - 0.027586*A);
    Lf = 1.22703; Lfvc=0.9346; Lratio = (3.8243 - 0.3328*A);
    Sfev1 = Math.exp(-2.256278 + 0.080729*A);
    Sfvc  = Math.exp(-2.195595 + 0.068466*A);
    Sratio= Math.exp(-2.882025 + 0.068889*A);
  }
  return {FEV1p, FVCp, RATIOp, Lf, Lfvc, Lratio, Sfev1, Sfvc, Sratio};
}

function LMS_z(meas, L, M, S){
  if(meas<=0 || M<=0 || S<=0) return NaN;
  if(Math.abs(L) < 1e-6){ // L≈0 -> log-normal
    return Math.log(meas/M)/S;
  }
  return (Math.pow(meas/M, L) - 1) / (L*S);
}
function LMS_lln(L,M,S){ // z = -1.645
  if(M<=0 || S<=0) return NaN;
  const z = -1.645;
  if(Math.abs(L) < 1e-6){
    return M * Math.exp(S*z);
  }
  return M * Math.pow(1 + L*S*z, 1/L);
}

function interpretSpiro(sex, age, height_cm, fev1, fvc, ratioPct){
  const P = spiroPred(sex, age, height_cm);
  const ratio = ratioPct>0 ? ratioPct/100 : (fvc>0 ? (fev1/fvc) : NaN);

  const zFEV1 = LMS_z(fev1, P.Lf, P.FEV1p, P.Sfev1);
  const zFVC  = LMS_z(fvc,  P.Lfvc, P.FVCp, P.Sfvc);
  const zR    = LMS_z(ratio, P.Lratio, P.RATIOp, P.Sratio);

  const llnFEV1 = LMS_lln(P.Lf, P.FEV1p, P.Sfev1);
  const llnFVC  = LMS_lln(P.Lfvc, P.FVCp, P.Sfvc);
  const llnR    = LMS_lln(P.Lratio, P.RATIOp, P.Sratio);

  const pctFEV1 = fev1>0? 100*fev1/P.FEV1p : NaN;
  const pctFVC  = fvc>0 ? 100*fvc/P.FVCp   : NaN;
  const pctR    = ratio>0? 100*ratio/P.RATIOp : NaN;

  // Flags
  const lowRatio = zR < -1.645;
  const borderlineRatio = zR >= -1.645 && zR < -1.0;
  const lowFVC = zFVC < -1.645;
  const lowFEV1 = zFEV1 < -1.645;

  let pattern = "Normale";
  if(lowRatio){
    pattern = lowFVC ? "Ostruttivo misto / da definire" : "Ostruttivo";
  }else if(lowFVC){
    pattern = "Possibile restrizione (spirometria)";
  }

  return {
    pred:{FEV1:P.FEV1p, FVC:P.FVCp, RATIO:P.RATIOp},
    pct:{FEV1:pctFEV1, FVC:pctFVC, RATIO:pctR},
    z:{FEV1:zFEV1, FVC:zFVC, RATIO:zR},
    lln:{FEV1:llnFEV1, FVC:llnFVC, RATIO:llnR},
    flags:{lowRatio,borderlineRatio,lowFVC,lowFEV1},
    pattern
  };
}

/* ---------- Watt Test calculations ---------- */
function computeWatt(){
  // v9.7 additions: PAD/MAP, MET pred.

  // inputs
  const age = +$("age").value, sex=$("sex").value, w=+$("weight").value, h=+$("height").value;
  const wattPeak = +$("wattPeak").value;
  const ramp = +$("ramp").value || 0;
  const dur = +$("dur").value || 0;
  const hrRest = +$("hrRest").value, hrPeak=+$("hrPeak").value, hr1=+$("hr1min").value;
  const sbpR=+$("sbpRest").value, sbpP=+$("sbpPeak").value, sbpRec=+$("sbpRec").value;
  const dbpR=+$("dbpRest").value, dbpP=+$("dbpPeak").value;
  const beta = $("onBeta").value==="si";

  // Predictions: simple heuristic for Watt predicted (cycle) using age/sex/weight/height
  // Here we use a linear model proxy; you may refine coefficients later.
  const Wpred = Math.max(0, (sex==="M"? 3.0:2.2)*w + 0.8*(h-150) - 1.5*(age-30)); 

  const fcmax = fcMax(age);
  const met = MET_from_Watts(wattPeak, w);
  const metPred = MET_from_Watts(Wpred, w);
  const pctW = Wpred>0 ? 100*wattPeak/Wpred : NaN;

  const hrRes = (hrPeak - hrRest);
  const icr = (hrPeak - hrRest) / Math.max(1,(fcmax - hrRest)); // riserva cronotropa
  const icrTag = beta ? (icr>=0.62?"Adeguata":"Ridotta") : (icr>=0.8?"Adeguata":"Ridotta");
  const hrRec1 = hrPeak>0 && hr1>0 ? (hrPeak - hr1) : NaN;

  const dpRest = (hrRest||0)*(sbpR||0);
  const dpPeak = (hrPeak||0)*(sbpP||0);
  const dpSlope = (dpPeak - dpRest) / Math.max(1, dur);
  const pasRise = (sbpP - sbpR);
  const pasResp = (pasRise>=20 && sbpP<230) ? "Fisiologica" : (sbpP>=230?"Ipertensiva":"Inadeguata/ipo");
  const mapRest = mapFromBP(sbpR, dbpR); const mapPeak = mapFromBP(sbpP, dbpP);

  // Build KPIs
  const k = [];
  k.push(kpi("Watt picco", wattPeak, "W", tagByPct(pctW)));
  k.push(kpi("% predetto Watt", pctW?.toFixed(0), "%", tagByPct(pctW)));
  k.push(kpi("METs (stima ciclo)", met.toFixed(1), "MET", metTag(met), `Pred: ${metPred.toFixed(1)}`));
  k.push(kpi("FC picco", hrPeak, "bpm"));
  k.push(kpi("FC% teorica", (100*hrPeak/fcmax).toFixed(0), "%", hrPeak/fcmax>=0.85?"ok":(hrPeak/fcmax>=0.75?"warn":"bad")));
  k.push(kpi("Riserva cronotropa", icr.toFixed(2), "", icrTag==="Adeguata"?"ok":"bad", icrTag));
  if(!isNaN(hrRec1)) k.push(kpi("HR recovery 1’", hrRec1, "bpm", hrRec1>=12?"ok":"bad", hrRec1>=12?"Adeguata":"Ridotta"));
  k.push(kpi("PAS picco", sbpP, "mmHg", pasResp==="Fisiologica"?"ok":(pasResp==="Ipertensiva"?"bad":"warn"), pasResp));
  k.push(kpi("Doppio prodotto picco", dpPeak, ""));
  if(mapRest===mapRest) k.push(kpi("MAP riposo", mapRest, "mmHg"));
  if(mapPeak===mapPeak) k.push(kpi("MAP picco", mapPeak, "mmHg"));

  renderSummary(["Watt Test", pasResp]);
  renderKPIs(k);
  // Interpretation bullets
  const bullets = [];
  bullets.push(bline("Capacità funzionale", `${met.toFixed(1)} MET (${pctW?pctW.toFixed(0):"—"}% del Watt predetto)`));
  bullets.push(bline("Risposta cronotropa", `${icrTag} (ICR ${icr.toFixed(2)})`));
  bullets.push(bline("Risposta pressoria", pasResp));
  if(hrRec1===hrRec1) bullets.push(bline("Recupero autonomico", hrRec1>=12?"normale":"ridotto"));
  if(ramp>0) bullets.push(bline("Protocollo", `rampa ${ramp} W/min, durata ${dur} min`));
  $("interp").innerHTML = bullets.join("");
}

/* ---------- CPET calculations ---------- */
function cpetVO2Pred(age, sex){ // ml/kg/min at peak (simple selectable formula: default "Base")
  // Base: generic fit adult reference ~ 45 - 0.35*age (M), 38 - 0.30*age (F) (cap at LLN)
  const v = sex==="M" ? (45 - 0.35*age) : (38 - 0.30*age);
  return Math.max(14, v);
}
function WeberClass(vo2){ // ml/kg/min
  if(vo2>=20) return "A (lieve/nessuna)";
  if(vo2>=16) return "B (lieve)";
  if(vo2>=10) return "C (moderata)";
  return "D (grave)";
}
function slopeTag(s){
  if(s<30) return ["ok","<30 (normale)"];
  if(s<36) return ["warn","30–35 (intermedio)"];
  return ["bad","≥36 (elevato)"];
}
function metTag(m){ if(m>=10) return "ok"; if(m>=5) return "warn"; return "bad"; }
function tagByPct(p){ if(!p) return ""; if(p>=85) return "ok"; if(p>=60) return "warn"; return "bad"; }

function computeCPET(){
  const age = +$("age").value, sex=$("sex").value, w=+$("weight").value, h=+$("height").value;
  const vo2pk = +$("vo2pk").value; // ml/kg/min
  const rer = +$("rer").value;
  const vat = +$("vat").value;      // ml/kg/min
  const slope = +$("slope").value;
  const oues = +$("oues").value;
  const wpk = +$("wpk").value;
  const vepk = +$("vepk").value; const mvvIn = +$("mvv").value; const spo2 = +$("spo2min").value;
  const hrPk = +$("hrPk").value, hrRp=+$("hrRp").value;
  const beta = $("betaTest").value==="si";

  // predicted
  const vo2pred = cpetVO2Pred(age,sex);
  const pct = vo2pk>0 ? 100*vo2pk/vo2pred : NaN;
  const atPct = (vo2pred>0 && vat>0) ? 100*vat/vo2pred : NaN;
  const weber = WeberClass(vo2pk);

  // ventilatory limitation proxy if MVV available; here approximate MVV≈ FEV1*40 if spirometry present
  let brTxt = "Non valutabile";
  let brVal = NaN; let brClass = "";
  const fev1 = +$("fev1").value, fvc = +$("fvc").value, ratioIn = +$("ratio").value;
  let MVVauto = fev1>0 ? fev1*40 : NaN;
  const MVV = (mvvIn>0)? mvvIn : MVVauto;
  if(vepk>0 && MVV>0){
    brVal = brPercent(vepk, MVV);
    if(brVal<80) { brClass="ok"; brTxt = `${brVal.toFixed(0)}% (normale)`; }
    else if(brVal<=85){ brClass="warn"; brTxt = `${brVal.toFixed(0)}% (borderline)`; }
    else { brClass="bad"; brTxt = `${brVal.toFixed(0)}% (limitazione ventilatoria)`; }
  } else if(fev1>0) {
    brTxt = "MVV stimabile da FEV₁×40; inserire VEpicco per BR%";
  }

  const [slTag, slTxt] = slopeTag(slope||0);

  // ΔVO2/ΔW if cycle
  let dVO2dW = null;
  if(wpk>0 && vo2pk>0){ // vo2 in ml/kg/min -> convert to ml/min with weight
    const vo2mlmin = vo2pk * $("weight").value;
    dVO2dW = vo2mlmin / Math.max(1,wpk); // ml/min/W
  }

  // β-blocker aware chronotropic index
  const fcmax = fcMax(age);
  const icr = (hrPk - hrRp) / Math.max(1,(fcmax - hrRp));
  const icrOK = beta ? (icr>=0.62) : (icr>=0.8);

  // Build KPIs
  const k=[];
  k.push(kpi("VO₂ picco", vo2pk, "ml/kg/min", tagByPct(pct), `${pct?pct.toFixed(0):"—"}% pred`));
  k.push(kpi("Classe di Weber", weber, ""));
  if(vat) k.push(kpi("AT", vat, "ml/kg/min", atPct>=40?"ok":(atPct>=30?"warn":"bad"), `${atPct?atPct.toFixed(0):"—"}% del predetto`));
  if(slope) k.push(kpi("VE/VCO₂ slope", slope, "", slTag, slTxt));
  if(!isNaN(oues) && oues>0) k.push(kpi("OUES", oues, "", oues>=1.4?"ok":"warn"));
  if(dVO2dW!==null) k.push(kpi("ΔVO₂/ΔW", dVO2dW.toFixed(0), "ml/min/W", dVO2dW>=8?"ok":"warn"));
  if(vepk) k.push(kpi("BR% (VE/MVV)", brVal===brVal? brVal.toFixed(0):"—", "%", brClass, brTxt));
  if(spo2) k.push(kpi("SpO₂ minima", spo2.toFixed(0), "%", (spo2>=94?"ok":(spo2>=90?"warn":"bad"))));
  if(rer) k.push(kpi("RER picco", rer.toFixed(2), "", rer>=1.10?"ok":"warn", rer>=1.10?"Massimale":"Sub-massimale"));
  if(hrPk) k.push(kpi("Riserva cronotropa", icr.toFixed(2), "", icrOK?"ok":"bad", icrOK?"Adeguata":"Ridotta"));

  // SPIRO in CPET (optional)
  let spiroObj = null;
  if(fev1>0 && fvc>0){
    const ratio = ratioIn>0 ? ratioIn : (100*fev1/fvc);
    spiroObj = interpretSpiro(sex, age, h, fev1, fvc, ratio);
  }

  renderSummary(["CPET", weber, slTxt]);
  renderKPIs(k);

  // Interpretation bullets (more structured)
  const bullets = [];

  // Capacity
  bullets.push(bline("Capacità aerobica",
    `${vo2pk?vo2pk.toFixed(1):"—"} ml/kg/min (${pct?pct.toFixed(0):"—"}% pred), Weber ${weber}`));

  // Effort adequacy
  bullets.push(bline("Adeguatezza sforzo",
    `RER ${rer?rer.toFixed(2):"—"} ${rer>=1.10?"(massimale)":"(sub-massimale)"}, riserva cronotropa ${icrOK?"adeguata":"ridotta"}`));

  // Ventilatory efficiency
  bullets.push(bline("Efficienza ventilatoria", `Slope VE/VCO₂ ${slope? slope.toFixed(1):"—"} ${slTxt}`));

  if(vat){
    bullets.push(bline("Soglia anaerobica", `${vat.toFixed(1)} ml/kg/min (${atPct?atPct.toFixed(0):"—"}% del predetto)`));
  }

  if(dVO2dW!==null){
    bullets.push(bline("Economia muscolare (ciclo)", `${Math.round(dVO2dW)} ml/min/W`));
  }

  if(spiroObj){
    const rz = spiroObj;
    const line = `FEV₁ ${(+$("fev1").value).toFixed(2)} L (${rz.pct.FEV1?rz.pct.FEV1.toFixed(0):"—"}% pred, Z ${rz.z.FEV1?.toFixed(2)}), `+
                 `FVC ${(+$("fvc").value).toFixed(2)} L (${rz.pct.FVC?rz.pct.FVC.toFixed(0):"—"}% pred, Z ${rz.z.FVC?.toFixed(2)}), `+
                 `FEV₁/FVC ${ ( ($("ratio").value?+$("ratio").value:(100*+$("fev1").value/+$("fvc").value))).toFixed(1)}% (Z ${rz.z.RATIO?.toFixed(2)}); `+
                 `pattern: ${rz.pattern}`;
    bullets.push(bline("Spirometria (GLI-lite)", line));
  }

  // Final pattern suggestion
  const patt = [];
  if(pct && pct<60) patt.push("limitazione cardiocircolatoria possibile");
  if(slope && slope>=36) patt.push("inefficienza ventilatoria aumentata");
  if(oues && oues<1.4) patt.push("capacità ventilatoria funzionale ridotta (OUES basso)");
  if(!icrOK) patt.push("risposta cronotropa ridotta");
  if(brVal===brVal && brVal>85) patt.push("riserva ventilatoria ridotta");
  if(spo2 && spo2<94) patt.push("desaturazione da sforzo");
  if(patt.length===0) patt.push("quadro complessivamente nei limiti o lievi alterazioni");
  bullets.push(bline("Conclusione automatica", capitalize(patt.join("; "))));

  $("interp").innerHTML = bullets.join("");
}

/* ---------- Render helpers ---------- */
function kpi(label, val, unit="", tagClass="", tagText=""){
  const v = (val!==undefined && val!==null && val===val) ? `${val}` : "—";
  const tag = tagText ? `<span class="tag ${tagClass}">${tagText}</span>` : (tagClass? `<span class="tag ${tagClass}">${tagClass}</span>`:"");
  return `<div class="kpi"><div class="v">${v} ${unit}</div><div class="muted">${label} ${tag}</div></div>`;
}
function renderKPIs(arr){
  $("kpis").innerHTML = arr.join("");
}
function renderSummary(tags){
  const el = $("summaryTags"); el.innerHTML="";
  tags.filter(Boolean).forEach(t=>{
    const span = document.createElement("span"); span.className="chip"; span.textContent=t; el.appendChild(span);
  });
}
function bline(title, text){ return `<div class="kpi"><div class="muted">${title}</div><div class="v" style="font-size:14px">${text}</div></div>`; }
function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

// Auto-calc spirometry ratio field if empty
["fev1","fvc"].forEach(id=>{
  $(id).addEventListener("input", ()=>{
    const fev1 = +$("fev1").value, fvc= +$("fvc").value;
    if(fev1>0 && fvc>0 && !$("ratio").value){
      $("ratio").value = (100*fev1/fvc).toFixed(1);
    }
  });
});
