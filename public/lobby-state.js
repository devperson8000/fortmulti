export function orderPartyProfiles(profiles){
 return [...profiles].sort((a,b)=>(Number(Boolean(b.self))-Number(Boolean(a.self)))||(Number(Boolean(b.host))-Number(Boolean(a.host)))||String(a.name||'').localeCompare(String(b.name||'')));
}
