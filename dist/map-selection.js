// Background loading never activates a map or supersedes a newer selection.
export function createMapSelection(loadFacility,activate){
 let id='island',request=0,loading=null;
 const validate=next=>{if(!['island','facility'].includes(next))throw new Error('Unknown map');};
 const load=()=>{
  if(!loading){try{loading=Promise.resolve(loadFacility());}catch(error){loading=Promise.reject(error);}loading=loading.catch(error=>{loading=null;throw error;});}
  return loading;
 };
 return {get id(){return id;},async preload(next){validate(next);if(next==='facility')await load();return true;},async select(next){
  validate(next);const revision=++request;
  if(next==='facility')await load();
  if(revision!==request)return false;
  if(id!==next){activate(next);id=next;}
  return true;
 }};
}
