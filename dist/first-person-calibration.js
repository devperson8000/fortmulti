// Measured from the shipped East weapon GLBs: Y up, muzzle toward -Z.
// Index contact calibrated against the actual Soldier fingertip and GLB trigger geometry.
// Positions below are in GLB metres; presentation positions are camera metres.
const rightFingers={index:[.16,.48,.32],middle:[.72,1.18,.85],ring:[.78,1.22,.9],pinky:[.86,1.25,.92],thumb:[.35,.55,.42]};
// Both native hand palms face local -X; only the finger fan mirrors across Z.
const leftFingers={index:[.55,1.05,.72],middle:[.62,1.12,.8],ring:[.67,1.16,.85],pinky:[.72,1.18,.88],thumb:[.3,.5,.4]};
const define=data=>Object.freeze({fov:68,adsViewFov:50,reloadNode:'magazine',reloadPalmOffset:[0,-.05,0],basis:[0,0,0],rightRotation:[-1.9,0,0],leftRotation:[0,0,-Math.PI/2],rightFingers,leftFingers,rightSplay:{index:[.3,0,0]},recoilRotation:[.065,.006,.012],swayRotation:[.0017,.0022,.001],sprintRotation:[-.32,.22,.38],...data});
export const FIRST_PERSON_CALIBRATION=Object.freeze({
 ar:define({rightRotation:[-1.4125,0,0],rightSplay:{index:[-0.59,0,0]},rightPalm:[0.023,-0.038,0.095],rightFingers:{...rightFingers,index:[0.89, 1.7, 1.4225]},scale:1.35,hip:[.19,-.22,-.64],hipRotation:[.015,.16,-.025],grip:[0,-.065,.11],supportNode:'railbottom',support:[0,-.025,-.1573],sight:[0,.065,.0114],muzzle:[0,.0055,-.2892],adsDepth:-.65}),
 shotgun:define({rightRotation:[-2.0625,0,0],rightSplay:{index:[-0.6,0,0]},rightPalm:[0.022,-0.006,0.19],rightFingers:{...rightFingers,index:[0, 1.725, 1.8],middle:[.65,1.1,.8]},leftFingers:{...leftFingers,index:[.45,.95,.65],middle:[.5,1,.7]},scale:1.3,hip:[.20,-.23,-.66],hipRotation:[.015,.17,-.025],grip:[0,-.025,.21],reloadNode:'lifter',supportNode:'pump',support:[0,-.005,-.1358],sight:[0,.073,.0223],muzzle:[0,.0407,-.455],adsDepth:-.69,recoilRotation:[.115,.008,.018]}),
 smg:define({rightRotation:[-2.05,0,0],rightSplay:{index:[1,0,0]},rightPalm:[0.023,-0.041,-0.008],rightFingers:{...rightFingers,index:[1.8, 0.1975, 1.65]},leftFingers:{...leftFingers,index:[.65,1.15,.8],middle:[.7,1.2,.85]},scale:1.45,hip:[.18,-.22,-.56],hipRotation:[.015,.14,-.025],grip:[0,-.067,.012],supportNode:'attachbottomrail',support:[0,-.02,-.1087],sight:[0,.058,.0603],muzzle:[0,.0225,-.1766],adsDepth:-.62,recoilRotation:[.045,.008,.013]}),
 sniper:define({rightRotation:[-1.8,0,0],rightSplay:{index:[-0.365,0,0]},rightPalm:[0.021,-0.033,0.15],rightFingers:{...rightFingers,index:[0.765, 1.8, 1.4875]},leftFingers:{...leftFingers,index:[.48,1,.68]},scale:1.25,hip:[.20,-.23,-.70],hipRotation:[.01,.15,-.02],grip:[0,-.06,.15],supportNode:'attachbottomrail',support:[0,-.024,-.251],sight:[0,.09,.0771],muzzle:[0,.0172,-.3744],adsDepth:-.73,recoilRotation:[.13,.006,.012]})
});
export function firstPersonCalibration(id){return FIRST_PERSON_CALIBRATION[id]||FIRST_PERSON_CALIBRATION.ar;}
export function adsGripPosition(c){return [(c.grip[0]-c.sight[0])*c.scale,(c.grip[1]-c.sight[1])*c.scale,c.adsDepth];}
