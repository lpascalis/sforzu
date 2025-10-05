# Sforzu v6.6 — Stima METs treadmill (preview + copia su CPET)

**Novità**
- **Card “Stima METs treadmill”** nello Step 2 quando l’ergometro è **Treadmill**: calcola METs **allo start** e al **picco** (in base a velocità/pendenza e step). Mostra anche la **% sui METs predetti** dal paziente.
- Pulsante **“Usa come stima VO₂/kg in CPET”**: copia il VO₂/kg stimato (ACSM) nel campo risultati CPET (Step 3) per confronto rapido.
- Fix JavaScript (operatori logici) e aggiornamento cache PWA.

**Formule**
- Velocità da km/h → m/min: ×16.6667.  
- **Walking**: VO₂ = 0.1·v + 1.8·v·G + 3.5 (v m/min, G frazione).  
- **Running**: VO₂ = 0.2·v + 0.9·v·G + 3.5 (v ≥134 m/min).  
- METs = VO₂/kg ÷ 3.5.

> Anteprima utile per impostare la prova su tappeto e validare la coerenza con i METs predetti. Nessun salvataggio locale.
