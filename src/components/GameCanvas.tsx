import { useEffect, useRef } from 'react'

interface Props {
  onGameWon: (deaths: number, timeMs: number) => void
  gameKey: number
}

export function GameCanvas({ onGameWon, gameKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onGameWonRef = useRef(onGameWon)
  useEffect(() => { onGameWonRef.current = onGameWon }, [onGameWon])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!

    // ─────────────────────────────────────────────────────────────────────
    // Everything below is extracted verbatim from
    //   /Users/tusharkhatwani/trust-the-floor/index.html
    // Only three React-adapter changes are made:
    //   1. canvas/ctx come from the ref above (not getElementById)
    //   2. keydown/keyup listeners are registered here and cleaned up on unmount
    //   3. when gameWon fires, call onGameWonRef.current() instead of drawGameWon()
    // ─────────────────────────────────────────────────────────────────────

    const W = canvas.width, H = canvas.height;

    const BASE_GRAVITY = 0.55;
    const JUMP_FORCE   = -13;
    const SPEED        = 4;
    const DEATH_FRAMES = 130;
    const LEVEL_FLASH_FRAMES = 60;

    let deathCount   = 0;
    let currentLevel = 1;
    let levelFlash   = 0;

    const mockMessages = [
      "lol nope","bro really thought","skill issue","try again bestie",
      "the floor lied. again.","you fell for it AGAIN??","maybe try the spikes idk",
      "read the tip bro","the air was safe??","it was there tho",
      "timing issue","checkpoints lie too","your brain is cooked",
      "which way is down?","physics left the chat","you actually made it?? wait no",
    ];

    const keys: Record<string, boolean> = {};

    let player: any, deathTimer: number, deathMsg: string, levelWon: boolean, gameWon: boolean;
    let vanishTimers: Record<string,number> = {}, spikeTimers: Record<string,number> = {};
    let gravityFlipped = false;
    let controlsSwapped = false;
    let controlSwapTimer = 0;
    let apples: any[] = [], appleSpawnTimer = 0;
    let postFirstDeath = false;
    let levelData: any;

    // React adapter: track whether we've already fired the win callback
    let wonNotified = false;
    const startTime = Date.now();

    function rectOverlap(ax:number,ay:number,aw:number,ah:number,bx:number,by:number,bw:number,bh:number){
      return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;
    }
    function rnd(mn:number,mx:number){ return Math.random()*(mx-mn)+mn; }
    function pickMock(){ return mockMessages[Math.floor(Math.random()*mockMessages.length)]; }

    function getLevelData(n: number): any {
      switch(n){
      case 1: return {
        tip:['tip: green = good,  red = bad','(probably)'],
        flag:{x:855,y:450}, playerStart:{x:40,y:400},
        platforms:[
          // Continuous floor – player walks UNDER the green death block (it's high enough)
          {id:'g1', x:0,  y:450,w:400,h:20,type:'ground'},
          // Green death mid-air: bottom is at y+h=308, player top when walking=414 → safe to walk under, deadly to jump onto
          {id:'d1', x:160,y:290,w:180,h:18,type:'death'},
          // GAP 400-510: looks like a deadly drop, but ghost bridge is there
          {id:'gh1',x:400,y:450,w:110,h:20,type:'ghost'},
          // Floor resumes
          {id:'g2', x:510,y:450,w:390,h:20,type:'ground'},
          // Red spikes – safe elevated path after the gap
          {id:'s1', x:540,y:370,w:140,h:18,type:'safe'},
          // Second green death trap near the flag
          {id:'d2', x:710,y:310,w:120,h:18,type:'death'},
        ],
      };
      case 2: return {
        tip:['tip: watch your step',''],
        flag:{x:855,y:450}, playerStart:{x:30,y:400},
        platforms:[
          {id:'g1', x:0,  y:450,w:100,h:20,type:'ground'},
          {id:'pt1',x:100,y:450,w:120,h:20,type:'passthrough'},
          {id:'gh1',x:100,y:450,w:120,h:20,type:'ghost'},
          {id:'g2', x:220,y:450,w:60, h:20,type:'ground'},
          {id:'pt2',x:220,y:360,w:100,h:18,type:'passthrough'},
          {id:'gh2',x:340,y:360,w:100,h:16,type:'ghost'},
          {id:'g3', x:280,y:450,w:80, h:20,type:'ground'},
          {id:'gh3',x:360,y:450,w:120,h:20,type:'ghost'},
          {id:'g4', x:480,y:450,w:420,h:20,type:'ground'},
          {id:'pt3',x:550,y:350,w:180,h:18,type:'passthrough'},
          {id:'gh4',x:480,y:310,w:120,h:16,type:'ghost'},
        ],
      };
      case 3: return {
        tip:['tip: platforms are your friends',''],
        flag:{x:855,y:300}, playerStart:{x:30,y:400},
        platforms:[
          {id:'g1',x:0,  y:450,w:160,h:20,type:'ground'},
          {id:'g2',x:120,y:380,w:80, h:16,type:'ground'},
          {id:'v1',x:220,y:340,w:80, h:16,type:'vanish'},
          {id:'v2',x:340,y:300,w:80, h:16,type:'vanish'},
          {id:'v3',x:460,y:300,w:80, h:16,type:'vanish'},
          {id:'c1',x:570,y:300,w:100,h:16,type:'cracked'},
          {id:'g3',x:680,y:300,w:220,h:200,type:'ground'},
          {id:'g4',x:0,  y:480,w:900,h:20,type:'ground'},
        ],
      };
      case 4: return {
        tip:['tip: the floor looks safe here!',''],
        flag:{x:855,y:450}, playerStart:{x:30,y:400},
        platforms:[
          {id:'s0', x:0,  y:450,w:120,h:20,type:'safe'},
          {id:'st1',x:120,y:450,w:120,h:20,type:'spikeTrap'},
          {id:'st2',x:360,y:450,w:120,h:20,type:'spikeTrap'},
          {id:'st3',x:600,y:450,w:120,h:20,type:'spikeTrap'},
          {id:'s1', x:240,y:450,w:120,h:20,type:'safe'},
          {id:'s2', x:480,y:450,w:120,h:20,type:'safe'},
          {id:'s3', x:720,y:450,w:180,h:20,type:'safe'},
          {id:'s4', x:150,y:360,w:80, h:16,type:'death'},
          {id:'s5', x:380,y:360,w:80, h:16,type:'death'},
          {id:'s6', x:610,y:360,w:80, h:16,type:'death'},
          {id:'d1', x:300,y:340,w:60, h:16,type:'death'},
        ],
      };
      case 5: return {
        tip:['tip: checkpoints save your progress!',''],
        flag:{x:855,y:350}, playerStart:{x:30,y:400},
        platforms:[
          {id:'g1',x:0,  y:450,w:200,h:20,type:'ground'},
          {id:'d1',x:140,y:370,w:100,h:16,type:'death'},
          {id:'g2',x:200,y:450,w:110,h:20,type:'ground'},
          {id:'ck',x:320,y:350,w:30, h:30,type:'checkpoint'},
          {id:'g3',x:310,y:450,w:120,h:20,type:'ground'},
          {id:'s1',x:430,y:450,w:150,h:20,type:'safe'},
          {id:'g4',x:580,y:450,w:100,h:20,type:'ground'},
          {id:'d2',x:590,y:370,w:100,h:16,type:'death'},
          {id:'s2',x:480,y:360,w:100,h:16,type:'safe'},
          {id:'s3',x:600,y:300,w:130,h:16,type:'safe'},
          {id:'g5',x:680,y:450,w:220,h:20,type:'ground'},
          {id:'g6',x:730,y:350,w:170,h:20,type:'ground'},
        ],
      };
      case 6: return {
        tip:['tip: use arrow keys to move',''],
        flag:{x:855,y:450}, playerStart:{x:30,y:400},
        swapControls:true,
        platforms:[
          {id:'g1',x:0,  y:450,w:130,h:20,type:'ground'},
          {id:'g2',x:200,y:450,w:130,h:20,type:'ground'},
          {id:'g3',x:400,y:450,w:130,h:20,type:'ground'},
          {id:'g4',x:600,y:450,w:300,h:20,type:'ground'},
          {id:'s1',x:130,y:390,w:70, h:16,type:'safe'},
          {id:'s2',x:330,y:390,w:70, h:16,type:'safe'},
          {id:'s3',x:530,y:390,w:70, h:16,type:'safe'},
          {id:'d1',x:150,y:320,w:80, h:16,type:'death'},
        ],
      };
      case 7: return {
        tip:['tip: gravity works as expected :)',''],
        flag:{x:855,y:60}, playerStart:{x:30,y:400},
        gravityFlipX:450,
        platforms:[
          {id:'g1', x:0,  y:450,w:200,h:20,type:'ground'},
          {id:'s1', x:200,y:380,w:80, h:16,type:'safe'},
          {id:'g2', x:280,y:450,w:170,h:20,type:'ground'},
          {id:'d1', x:310,y:350,w:100,h:16,type:'death'},
          {id:'gc1',x:450,y:0,  w:450,h:20,type:'ground'},
          {id:'sc1',x:510,y:20, w:80, h:16,type:'safe'},
          {id:'dc1',x:660,y:20, w:100,h:16,type:'death'},
          {id:'sc2',x:770,y:20, w:120,h:16,type:'safe'},
        ],
      };
      case 8: return {
        // Gimmick: flag is on the LEFT (walk left, not right).
        // Tip arrow points at a death trap. Don't jump — just walk across the red spikes.
        // No gaps. Jumping = green death block. Walking on spikes = safe.
        tip:['jump HERE  \u2192  (trust the arrow!)',''],
        flag:{x:20,y:450}, playerStart:{x:840,y:400},
        platforms:[
          // Continuous floor: ground → red spikes → ground → red spikes → ground
          {id:'g1',x:660,y:450,w:240,h:20,type:'ground'},
          {id:'s1',x:490,y:450,w:170,h:20,type:'safe'},
          {id:'g2',x:300,y:450,w:190,h:20,type:'ground'},
          {id:'s2',x:130,y:450,w:170,h:20,type:'safe'},
          {id:'g3',x:0,  y:450,w:130,h:20,type:'ground'},
          // Green death blocks hovering at jump height directly above the spike sections
          {id:'d1',x:490,y:290,w:170,h:18,type:'death'},
          {id:'d2',x:130,y:290,w:170,h:18,type:'death'},
          // Extra green decoy near the flag for last-second panic
          {id:'d3',x:30, y:330,w:90, h:16,type:'death'},
          // Decorative: high-up green blocks (unreachable — visual decoys)
          {id:'dec1',x:350,y:170,w:80,h:16,type:'death'},
          {id:'dec2',x:180,y:200,w:60,h:16,type:'death'},
          // Decorative: low red platforms (safe to step on, visual variety)
          {id:'dec3',x:590,y:390,w:80,h:14,type:'safe'},
          {id:'dec4',x:250,y:395,w:70,h:14,type:'safe'},
        ],
      };
      case 9: return {
        tip:['tip: watch out for falling objects',''],
        flag:{x:800,y:300}, playerStart:{x:30,y:400},
        spawnApples:true,
        platforms:[
          {id:'g1',x:0,  y:450,w:200,h:20,type:'ground'},
          {id:'g2',x:260,y:450,w:180,h:20,type:'ground'},
          {id:'g3',x:500,y:450,w:400,h:20,type:'ground'},
          {id:'s1',x:200,y:390,w:60, h:16,type:'safe'},
          {id:'s2',x:440,y:390,w:60, h:16,type:'safe'},
          {id:'s3',x:550,y:350,w:75, h:16,type:'safe'},
          {id:'s4',x:700,y:300,w:130,h:16,type:'safe'},
          {id:'d1',x:300,y:360,w:100,h:16,type:'death'},
          {id:'d2',x:635,y:360,w:70, h:16,type:'death'},
          {id:'g4',x:712,y:370,w:188,h:16,type:'ground'},
        ],
      };
      case 10: return {
        tip:["tip: you've learned nothing",''],
        flag:{x:855,y:60}, playerStart:{x:30,y:400},
        spawnApples:true,
        gravityFlipX:550,
        tempSwapControls:true,
        platforms:[
          {id:'g1', x:0,  y:450,w:120,h:20,type:'ground'},
          {id:'gh1',x:120,y:450,w:80, h:20,type:'ghost'},
          {id:'g2', x:200,y:450,w:100,h:20,type:'ground'},
          {id:'v1', x:220,y:370,w:80, h:16,type:'vanish'},
          {id:'st1',x:300,y:450,w:100,h:20,type:'spikeTrap'},
          {id:'s1', x:320,y:385,w:80, h:16,type:'safe'},
          {id:'ck', x:390,y:355,w:30, h:30,type:'checkpoint'},
          {id:'g3', x:400,y:450,w:100,h:20,type:'ground'},
          {id:'d1', x:430,y:370,w:80, h:16,type:'death'},
          {id:'s2', x:500,y:450,w:60, h:20,type:'safe'},
          {id:'gc1',x:560,y:0,  w:340,h:20,type:'ground'},
          {id:'sc1',x:590,y:20, w:80, h:16,type:'safe'},
          {id:'dc1',x:730,y:20, w:80, h:16,type:'death'},
          {id:'sc2',x:820,y:20, w:100,h:16,type:'safe'},
        ],
      };
      default: return getLevelData(1);
      }
    }

    function loadLevel(n: number){
      currentLevel   = n;
      levelData      = getLevelData(n);
      levelWon       = false;
      gameWon        = false;
      deathTimer     = 0;
      deathMsg       = '';
      vanishTimers   = {};
      spikeTimers    = {};
      gravityFlipped = false;
      controlsSwapped= levelData.swapControls||false;
      controlSwapTimer=0;
      apples         = [];
      appleSpawnTimer= 0;
      postFirstDeath = false;
      levelFlash     = LEVEL_FLASH_FRAMES;
      for(const p of levelData.platforms){ p.disabled=false; p.spiked=false; }
      initPlayer();
    }

    function initPlayer(){
      player={
        x:levelData.playerStart.x, y:levelData.playerStart.y,
        w:16, h:36, vx:0, vy:0, onGround:false, dead:false,
      };
      deathTimer=0; deathMsg=''; levelWon=false;
      vanishTimers={}; spikeTimers={};
      apples=[]; appleSpawnTimer=0;
      gravityFlipped=false;
      if(levelData.swapControls) controlsSwapped=true;
      if(levelData.tempSwapControls){ controlsSwapped=false; controlSwapTimer=0; }
      for(const p of levelData.platforms){ p.disabled=false; p.spiked=false; }
    }

    loadLevel(1);

    // ── Drawing ──────────────────────────────────────────────────────────────────

    function drawBG(){
      ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=1;
      for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    }

    function drawGround(p: any){
      ctx.fillStyle='#3a3a5c'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#555580'; ctx.fillRect(p.x,p.y,p.w,3);
    }

    function drawDeath(p: any){
      const g=ctx.createLinearGradient(p.x,p.y,p.x,p.y+p.h);
      g.addColorStop(0,'#66ff66'); g.addColorStop(1,'#33cc33');
      ctx.fillStyle=g; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#88ff88';
      for(let i=p.x+8;i<p.x+p.w-4;i+=12){
        ctx.beginPath(); ctx.moveTo(i,p.y); ctx.lineTo(i-3,p.y-5); ctx.lineTo(i+3,p.y-5);
        ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle='#44ff44'; ctx.lineWidth=1; ctx.strokeRect(p.x,p.y,p.w,p.h);
    }

    function drawSafe(p: any){
      ctx.fillStyle='#660000'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#cc0000';
      const sw=14;
      for(let i=p.x;i<p.x+p.w;i+=sw){
        ctx.beginPath(); ctx.moveTo(i,p.y); ctx.lineTo(i+sw/2,p.y-6);
        ctx.lineTo(Math.min(i+sw,p.x+p.w),p.y); ctx.closePath(); ctx.fill();
      }
    }

    function drawGroundFlipped(p: any){
      ctx.fillStyle='#3a3a5c'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#555580'; ctx.fillRect(p.x,p.y+p.h-3,p.w,3);
    }

    function drawDeathFlipped(p: any){
      const g=ctx.createLinearGradient(p.x,p.y,p.x,p.y+p.h);
      g.addColorStop(0,'#33cc33'); g.addColorStop(1,'#66ff66');
      ctx.fillStyle=g; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#88ff88';
      for(let i=p.x+8;i<p.x+p.w-4;i+=12){
        ctx.beginPath(); ctx.moveTo(i,p.y+p.h); ctx.lineTo(i-3,p.y+p.h+5); ctx.lineTo(i+3,p.y+p.h+5);
        ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle='#44ff44'; ctx.lineWidth=1; ctx.strokeRect(p.x,p.y,p.w,p.h);
    }

    function drawSafeFlipped(p: any){
      ctx.fillStyle='#660000'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#cc0000';
      const sw=14;
      for(let i=p.x;i<p.x+p.w;i+=sw){
        ctx.beginPath(); ctx.moveTo(i,p.y+p.h); ctx.lineTo(i+sw/2,p.y+p.h+6);
        ctx.lineTo(Math.min(i+sw,p.x+p.w),p.y+p.h); ctx.closePath(); ctx.fill();
      }
    }

    function drawPassthrough(p: any){
      ctx.fillStyle='#3a3a5c'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#555580'; ctx.fillRect(p.x,p.y,p.w,3);
    }

    function drawVanish(p: any){
      if(p.disabled) return;
      const t=vanishTimers[p.id]||0, maxT=48;
      const alpha=t>0?Math.max(0,1-t/maxT):1;
      ctx.globalAlpha=alpha;
      ctx.fillStyle='#9966ff'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#bb88ff'; ctx.fillRect(p.x,p.y,p.w,3);
      if(t>20){
        ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(p.x+p.w*0.3,p.y); ctx.lineTo(p.x+p.w*0.4,p.y+p.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x+p.w*0.7,p.y); ctx.lineTo(p.x+p.w*0.6,p.y+p.h); ctx.stroke();
      }
      ctx.globalAlpha=1;
    }

    function drawCracked(p: any){
      ctx.fillStyle='#4a3a2c'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.strokeStyle='#111'; ctx.lineWidth=2;
      for(let i=0;i<4;i++){
        const cx2=p.x+(i+1)*p.w/5;
        ctx.beginPath(); ctx.moveTo(cx2,p.y);
        ctx.lineTo(cx2+rnd(-6,6),p.y+p.h/2);
        ctx.lineTo(cx2+rnd(-6,6),p.y+p.h); ctx.stroke();
      }
      ctx.fillStyle='#ff8800'; ctx.font='10px monospace';
      ctx.fillText('UNSAFE?',p.x+4,p.y-4);
    }

    function drawSpikeTrap(p: any){
      ctx.fillStyle='#3a3a5c'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#555580'; ctx.fillRect(p.x,p.y,p.w,3);
      const t=spikeTimers[p.id]||0, maxT=72;
      if(p.spiked){
        ctx.fillStyle='#cc0000';
        const sw=14;
        for(let i=p.x;i<p.x+p.w;i+=sw){
          ctx.beginPath(); ctx.moveTo(i,p.y); ctx.lineTo(i+sw/2,p.y-14);
          ctx.lineTo(Math.min(i+sw,p.x+p.w),p.y); ctx.closePath(); ctx.fill();
        }
      } else if(t>0){
        const prog=Math.min(t/maxT,1), sh=prog*14;
        ctx.fillStyle=`rgba(220,50,50,${prog})`;
        const sw=14;
        for(let i=p.x;i<p.x+p.w;i+=sw){
          ctx.beginPath(); ctx.moveTo(i,p.y); ctx.lineTo(i+sw/2,p.y-sh);
          ctx.lineTo(Math.min(i+sw,p.x+p.w),p.y); ctx.closePath(); ctx.fill();
        }
      }
    }

    function drawCheckpoint(p: any){
      const cx2=p.x+p.w/2, cy2=p.y+p.h/2;
      const glow=ctx.createRadialGradient(cx2,cy2,2,cx2,cy2,22);
      glow.addColorStop(0,'rgba(255,220,0,0.8)'); glow.addColorStop(1,'rgba(255,180,0,0)');
      ctx.fillStyle=glow; ctx.fillRect(p.x-12,p.y-12,p.w+24,p.h+24);
      ctx.fillStyle='#ffdd00'; ctx.strokeStyle='#ff8800'; ctx.lineWidth=2;
      const spikes=5, or=14, ir=6;
      ctx.beginPath();
      for(let i=0;i<spikes*2;i++){
        const r=i%2===0?or:ir, angle=(i*Math.PI/spikes)-Math.PI/2;
        if(i===0) ctx.moveTo(cx2+r*Math.cos(angle),cy2+r*Math.sin(angle));
        else ctx.lineTo(cx2+r*Math.cos(angle),cy2+r*Math.sin(angle));
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#222'; ctx.font='bold 7px monospace'; ctx.textAlign='center';
      ctx.fillText('SAVE',cx2,cy2+3); ctx.textAlign='left';
    }

    function drawPlatform(p: any){
      if(p.disabled) return;
      const flipped=!!(levelData.gravityFlipX && p.x>=levelData.gravityFlipX);
      switch(p.type){
        case 'ground':      flipped?drawGroundFlipped(p):drawGround(p);   break;
        case 'death':       flipped?drawDeathFlipped(p):drawDeath(p);     break;
        case 'safe':        flipped?drawSafeFlipped(p):drawSafe(p);       break;
        case 'ghost':                                                       break;
        case 'passthrough': drawPassthrough(p);                            break;
        case 'vanish':      drawVanish(p);                                 break;
        case 'cracked':     drawCracked(p);                                break;
        case 'spikeTrap':   drawSpikeTrap(p);                              break;
        case 'checkpoint':  drawCheckpoint(p);                             break;
      }
    }

    function drawFlagInverted(f: any){
      if(!f) return;
      // Hangs from ceiling (gc platforms at y:0-20 in flipped zones)
      const ceilY=20;
      ctx.strokeStyle='#aaa'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(f.x,ceilY); ctx.lineTo(f.x,ceilY+60); ctx.stroke();
      ctx.fillStyle='#ffdd00';
      ctx.beginPath(); ctx.moveTo(f.x,ceilY+60); ctx.lineTo(f.x+30,ceilY+50); ctx.lineTo(f.x,ceilY+40);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='#222'; ctx.font='bold 9px monospace';
      ctx.fillText('END',f.x+4,ceilY+57);
    }

    function drawFlag(f: any){
      if(!f) return;
      if(levelData.gravityFlipX && f.x>=levelData.gravityFlipX){ drawFlagInverted(f); return; }
      ctx.strokeStyle='#aaa'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(f.x,f.y-60); ctx.stroke();
      ctx.fillStyle='#ffdd00';
      ctx.beginPath(); ctx.moveTo(f.x,f.y-60); ctx.lineTo(f.x+30,f.y-50); ctx.lineTo(f.x,f.y-40);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='#222'; ctx.font='bold 9px monospace';
      ctx.fillText('END',f.x+4,f.y-48);
    }

    function drawStick(x: number, y: number, dead: boolean){
      const cx=x+8,hy=y;
      ctx.strokeStyle=dead?'#ff4444':'#e8e8e8'; ctx.lineWidth=2.5; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(cx,hy+6,6,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,hy+12); ctx.lineTo(cx,hy+26); ctx.stroke();
      if(dead){
        ctx.lineWidth=1.5;
        ([[cx-4,hy+3,cx-2,hy+5],[cx-2,hy+3,cx-4,hy+5],
         [cx+2,hy+3,cx+4,hy+5],[cx+4,hy+3,cx+2,hy+5]] as number[][]).forEach(([x1,y1,x2,y2])=>{
          ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        });
        ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(cx,hy+16); ctx.lineTo(cx-10,hy+12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx,hy+16); ctx.lineTo(cx+8,hy+10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx,hy+26); ctx.lineTo(cx-8,hy+36); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx,hy+26); ctx.lineTo(cx+10,hy+34); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(cx,hy+16); ctx.lineTo(cx-9,hy+22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx,hy+16); ctx.lineTo(cx+9,hy+22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx,hy+26); ctx.lineTo(cx-7,hy+36); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx,hy+26); ctx.lineTo(cx+7,hy+36); ctx.stroke();
      }
      ctx.lineWidth=1;
    }

    function drawApples(){
      for(const a of apples){
        ctx.fillStyle=a.color; ctx.beginPath(); ctx.arc(a.x,a.y,a.r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#228800'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(a.x,a.y-a.r); ctx.lineTo(a.x+3,a.y-a.r-5); ctx.stroke();
      }
    }

    function drawHUD(){
      ctx.fillStyle='#777'; ctx.font='13px monospace';
      ctx.fillText('deaths: '+deathCount, 12, 22);
      ctx.textAlign='right'; ctx.fillStyle='#777';
      ctx.fillText('level '+currentLevel+'/10', W-12, 22);
      ctx.textAlign='left';

      const tip=levelData.tip;
      if(tip&&tip[0]){
        ctx.font='12px monospace'; ctx.fillStyle='#666';
        const tw=ctx.measureText(tip[0]).width;
        ctx.fillText(tip[0], W/2-tw/2, 22);
        if(tip[1]){
          ctx.font='11px monospace'; ctx.fillStyle='#444';
          const tw2=ctx.measureText(tip[1]).width;
          ctx.fillText(tip[1], W/2-tw2/2, 38);
        }
      }

      if(currentLevel===6&&postFirstDeath){
        ctx.fillStyle='rgba(255,100,100,0.6)'; ctx.font='italic 13px monospace';
        ctx.fillText('something feels... off', 12, H-16);
      }

      if(currentLevel===8){
        // Arrow pointing right toward d1 death block (x:490-660, y:290)
        ctx.fillStyle='#ff6600'; ctx.font='bold 13px monospace';
        ctx.fillText('jump HERE \u2192', 370, 275);
        ctx.strokeStyle='#ff6600'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(490,269); ctx.lineTo(512,269); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(512,269); ctx.lineTo(506,264); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(512,269); ctx.lineTo(506,274); ctx.stroke();
      }

      if(currentLevel===10&&controlSwapTimer>0){
        ctx.fillStyle='rgba(255,80,80,0.85)'; ctx.font='bold 15px monospace';
        ctx.textAlign='center';
        ctx.fillText('\u26a0 CONTROLS SWAPPED ('+Math.ceil(controlSwapTimer/60)+'s)', W/2, H-18);
        ctx.textAlign='left';
      }

      if(gravityFlipped){
        ctx.fillStyle='rgba(180,100,255,0.7)'; ctx.font='12px monospace';
        ctx.fillText('\u2195 gravity inverted', 12, H-16);
      }
    }

    function drawDeathScreen(){
      ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#ff4444'; ctx.font='bold 48px monospace'; ctx.textAlign='center';
      ctx.fillText(deathMsg, W/2, H/2-20);
      ctx.fillStyle='#666'; ctx.font='16px monospace';
      ctx.fillText('restarting level...', W/2, H/2+30);
      ctx.textAlign='left';
    }

    function drawLevelWon(){
      ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#aaffaa'; ctx.font='bold 42px monospace'; ctx.textAlign='center';
      ctx.fillText('NICE!', W/2, H/2);
      ctx.fillStyle='#888'; ctx.font='18px monospace';
      if(currentLevel<10) ctx.fillText('loading level '+(currentLevel+1)+'...', W/2, H/2+46);
      ctx.textAlign='left';
    }

    function drawLevelFlash(){
      if(levelFlash<=0) return;
      const a=Math.min(1,levelFlash/20);
      ctx.fillStyle=`rgba(0,0,0,${a*0.78})`; ctx.fillRect(0,0,W,H);
      ctx.fillStyle=`rgba(255,220,80,${a})`; ctx.font='bold 64px monospace'; ctx.textAlign='center';
      ctx.fillText('LEVEL '+currentLevel, W/2, H/2);
      ctx.font='22px monospace'; ctx.fillStyle=`rgba(180,180,180,${a})`;
      const names=['Read The Tip','The Air Is Friendly','Now You See It','Be Patient They Said',
                   'Trust The Checkpoint','Mirror Brain','Which Way Is Down',
                   'Follow The Instructions','Apple Season','Everything Hurts'];
      ctx.fillText(names[currentLevel-1]||'', W/2, H/2+52);
      ctx.textAlign='left';
    }

    // ── Physics helpers ───────────────────────────────────────────────────────────

    function getPTop(p: any){ return p.type==='safe' ? p.y-6 : p.y; }
    function getPBot(p: any){ return p.y+p.h; }

    // ── Update ────────────────────────────────────────────────────────────────────

    function update(){
      if(levelFlash>0){ levelFlash--; return; }
      if(gameWon) return;

      if(levelWon){
        deathTimer--;
        if(deathTimer<=0){
          if(currentLevel>=10){
            gameWon=true;
            // React adapter: notify parent instead of drawing win screen on canvas
            if(!wonNotified){ wonNotified=true; onGameWonRef.current(deathCount, Date.now()-startTime); }
          }
          else { loadLevel(currentLevel+1); }
        }
        return;
      }

      if(player.dead){
        deathTimer--;
        if(deathTimer<=0) initPlayer();
        return;
      }

      // Control swap logic (level 6 permanent, level 10 timed)
      if(levelData.tempSwapControls && !levelData.swapControls){
        if(controlSwapTimer>0){
          controlSwapTimer--;
          if(controlSwapTimer===0) controlsSwapped=false;
        } else if(!controlsSwapped && player.x>240 && player.x<260){
          controlsSwapped=true; controlSwapTimer=180;
        }
      }

      const goL = controlsSwapped ? keys['ArrowRight'] : keys['ArrowLeft'];
      const goR = controlsSwapped ? keys['ArrowLeft']  : keys['ArrowRight'];

      if(goL)      player.vx=-SPEED;
      else if(goR) player.vx= SPEED;
      else         player.vx=0;

      const grav     = gravityFlipped ? -BASE_GRAVITY : BASE_GRAVITY;
      const jumpF    = gravityFlipped ? -JUMP_FORCE   : JUMP_FORCE;
      const jumpKey  = keys['Space']||keys['ArrowUp'];

      if(jumpKey && player.onGround){ player.vy=jumpF; player.onGround=false; }

      player.vy += grav;
      if(!gravityFlipped && player.vy>18) player.vy=18;
      if( gravityFlipped && player.vy<-18) player.vy=-18;

      player.x+=player.vx;
      player.y+=player.vy;
      player.x=Math.max(-10,Math.min(W-player.w+10,player.x));
      player.onGround=false;

      // Gravity flip trigger
      if(levelData.gravityFlipX && !gravityFlipped && player.x>levelData.gravityFlipX){
        gravityFlipped=true; player.vy=2;
      }

      // Platform collisions
      for(const p of levelData.platforms){
        if(p.disabled) continue;
        if(p.type==='passthrough') continue;

        const topY=getPTop(p), botY=getPBot(p);

        if(p.type==='death'||p.type==='checkpoint'){
          if(rectOverlap(player.x,player.y,player.w,player.h,p.x,p.y,p.w,p.h)){
            triggerDeath(); return;
          }
          continue;
        }

        if(p.type==='spikeTrap'){
          const feet=player.y+player.h;
          const onIt=player.x+player.w>p.x&&player.x<p.x+p.w&&
                     feet>=topY&&feet<=topY+10&&player.vy>=0;
          if(onIt){
            spikeTimers[p.id]=(spikeTimers[p.id]||0)+1;
            if(spikeTimers[p.id]>=72){ p.spiked=true; triggerDeath(); return; }
          } else {
            if(spikeTimers[p.id]>0) spikeTimers[p.id]=Math.max(0,spikeTimers[p.id]-2);
          }
        }

        if(!gravityFlipped){
          const prevBot=player.y+player.h-player.vy;
          const currBot=player.y+player.h;
          if(player.x+player.w>p.x&&player.x<p.x+p.w&&
             prevBot<=topY+8&&currBot>=topY){
            if(player.vy>=0){
              player.y=topY-player.h; player.vy=0; player.onGround=true;
              if(p.type==='vanish'){
                vanishTimers[p.id]=(vanishTimers[p.id]||0)+1;
                if(vanishTimers[p.id]>=48) p.disabled=true;
              }
            }
          }
        } else {
          // Flipped: land on underside of platform (ceiling walking)
          const prevTop=player.y-player.vy;
          if(player.x+player.w>p.x&&player.x<p.x+p.w&&
             prevTop>=botY-8&&player.y<=botY){
            if(player.vy<=0){ player.y=botY; player.vy=0; player.onGround=true; }
          }
        }
      }

      // Apples
      if(levelData.spawnApples){
        appleSpawnTimer++;
        if(appleSpawnTimer>80){
          appleSpawnTimer=0;
          const count=1+Math.floor(Math.random()*2);
          for(let i=0;i<count;i++){
            apples.push({
              x:rnd(30,W-30), y:H+20,
              r:rnd(8,13),
              vy:-rnd(2.5,5),
              color:Math.random()<0.5?'#ff4444':'#44cc44',
            });
          }
        }
        for(const a of apples) a.y+=a.vy;
        for(let i=apples.length-1;i>=0;i--) if(apples[i].y<-30) apples.splice(i,1);
        for(const a of apples){
          const dx=(player.x+8)-a.x, dy=(player.y+18)-a.y;
          if(Math.sqrt(dx*dx+dy*dy)<a.r+9){ triggerDeath(); return; }
        }
      }

      // Bounds death
      if(!gravityFlipped&&player.y>H+80){ triggerDeath(); return; }
      if( gravityFlipped&&player.y<-80) { triggerDeath(); return; }

      // Win check
      const f=levelData.flag;
      if(f&&rectOverlap(player.x,player.y,player.w,player.h,f.x-4,f.y-62,38,64)){
        levelWon=true; deathTimer=65;
      }
    }

    function triggerDeath(){
      if(player.dead) return;
      player.dead=true; deathTimer=DEATH_FRAMES;
      deathMsg=pickMock(); deathCount++;
      if(currentLevel===6) postFirstDeath=true;
    }

    function draw(){
      ctx.clearRect(0,0,W,H);
      drawBG();
      for(const p of levelData.platforms) drawPlatform(p);
      drawFlag(levelData.flag);
      drawApples();
      drawStick(player.x,player.y,player.dead);
      drawHUD();
      if(player.dead) drawDeathScreen();
      if(levelWon&&!gameWon) drawLevelWon();
      // gameWon: React WinScreen handles this — no canvas drawing needed
      drawLevelFlash();
    }

    // ── Key listeners (React adapter: register here, clean up on unmount) ────────

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if(['Space','ArrowUp','ArrowLeft','ArrowRight','ArrowDown'].includes(e.code)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // ── Main loop ────────────────────────────────────────────────────────────────

    let rafId: number;
    let alive = true;
    function loop(){ if(!alive) return; update(); draw(); rafId=requestAnimationFrame(loop); }
    rafId = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [gameKey]);

  return (
    <canvas
      ref={canvasRef}
      width={900}
      height={500}
      style={{ border: '2px solid #2a2a4a', background: '#0f0f23', display: 'block' }}
    />
  );
}
