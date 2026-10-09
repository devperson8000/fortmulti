// Fortnut is a deliberately separate presentation layer. The existing Horizon
// party and match systems remain the sole source of multiplayer/game rules.
const $=id=>document.getElementById(id);
const lobby=$('fortnut-lobby'),launch=$('fortnut-launch');
function enterFortnut(){document.body.classList.add('fortnut-mode');$('lobby').hidden=true;lobby.hidden=false;}
function leaveFortnut(){document.body.classList.remove('fortnut-mode');lobby.hidden=true;$('lobby').hidden=false;}
launch?.addEventListener('click',enterFortnut);
$('fortnut-back')?.addEventListener('click',leaveFortnut);
$('fortnut-play')?.addEventListener('click',()=>{
  // Return to Horizon's existing party UI, styled as Fortnut. This reuses its
  // normal invite, ready-up and authoritative match flow without changing it.
  lobby.hidden=true;$('lobby').hidden=false;
  const mode=$('mode');
  if(mode&&!mode.disabled){mode.value='town';mode.dispatchEvent(new Event('change',{bubbles:true}));}
  const map=$('map-choice');
  if(map&&!map.disabled){map.value='island';map.dispatchEvent(new Event('change',{bubbles:true}));}
  $('create')?.scrollIntoView({block:'center',behavior:'smooth'});
});
document.addEventListener('click',event=>{
  // Keep the intentionally clumsy look for the match, then restore Horizon's
  // normal presentation whenever the player returns to the party lobby.
  if(event.target?.id==='back-lobby'||event.target?.id==='rematch'){
    document.body.classList.remove('fortnut-mode');
  }
});
