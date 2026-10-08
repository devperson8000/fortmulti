export const FACILITY_DETAIL_DISTANCES=Object.freeze({low:[8,28],medium:[12,36],high:[15,40]});
export function facilityDetailLevel(distance,quality='high',previous=-1,distances=FACILITY_DETAIL_DISTANCES[quality]||FACILITY_DETAIL_DISTANCES.high){
 const level=distance>distances[1]?2:distance>distances[0]?1:0;
 // Hold a detail level near its boundary to prevent repeated uploads while moving.
 if(previous>=0&&Math.abs(level-previous)===1){const boundary=distances[Math.min(level,previous)];if(Math.abs(distance-boundary)<1.5)return previous;}
 return level;
}
