// Native Soldier is 1.78 m tall; crouch and knee-slide poses keep the helmet
// below 1.3 m. Combat and scope queries share these posture-aware bounds.
export function characterHitHeight(player){return player.sliding||player.crouching?1.3:1.78;}
export function characterHitBounds(player){const height=characterHitHeight(player),[x,y,z]=player.p;return {min:[x-.43,y,z-.43],max:[x+.43,y+height,z+.43]};}
export function characterHeadshot(player,y){return y>player.p[1]+characterHitHeight(player)-.24;}
