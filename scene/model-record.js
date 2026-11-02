export function createModelRecord(s,scenario,elapsed,renderer,createdAt=new Date().toISOString()) {
  return {
    schema:'crossroute.synthetic-model-record.v1',createdAt,
    provenance:'SYNTHETIC DEMO · NOT OPERATIONAL',
    disclaimer:'Not an ISO 14083 certificate, compliance finding, sensor observation, emissions result, financial guarantee or signed audit record.',
    scenario:scenario.id,renderer,simulatedSeconds:Math.round(elapsed*120),
    inputs:{cargoId:s.cargo.id,ambientC:s.ambientC,payloadTon:s.cargo.payloadTon,heatCapacityKJperKgK:s.cargo.cp,referenceSetpointC:s.cargo.prechill,referenceUpperC:s.cargo.critical,assumedCargoValueTWD:s.cargo.valueTWD},
    outputs:{coreEstimateC:+s.temp.toFixed(3),marginToReferenceUpperC:+s.marginC.toFixed(3),withinReferenceUpper:s.withinRef,peakCoreEstimateC:+s.peakTemp.toFixed(3),priorReferenceExceedance:s.breachOccurred,timeAboveReferenceSeconds:Math.round(s.timeAboveReferenceSeconds),scriptedBatterySocPct:+s.soc.toFixed(2),heatIngressKW:+s.heatIngressKw.toFixed(3),refrigerationMode:s.unitMode},
    assumptions:{thermalTimeScale:120,shoreCoolingCapacityKW:10,ecoCoolingCapacityKW:7.5,solarLoadW:4470,wallLeakWperK:28.5,coolingBasis:'thermal removal assumption, not electrical input; no COP model',historyScope:'current cargo since selection/reset; recovery does not erase prior exceedance',geometry:'schematic, not a terminal survey',palletColors:'illustrative, not individual measurements'},
    emissions:null,signature:null,certified:false
  };
}
