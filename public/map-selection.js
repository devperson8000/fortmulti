// Keep loading separate from activation: a late download must not change a
// newer party choice. The unselected facility never starts a download.
export function createMapSelection(loadFacility,activate){
 let id='island',request=0,loading=null;
 return {get id(){return id;},async select(next){
  if(!['island','facility'].includes(next))throw new Error('Unknown map');
  const revision=++request;
  if(next==='facility'){
   if(!loading){try{loading=Promise.resolve(loadFacility());}catch(error){loading=Promise.reject(error);}loading=loading.catch(error=>{loading=null;throw error;});}
   await loading;
  }
  if(revision!==request)return false;
  if(id!==next){activate(next);id=next;}
  return true;
 }};
}
