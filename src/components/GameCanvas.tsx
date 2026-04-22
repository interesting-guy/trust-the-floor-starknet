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

    const W = canvas.width, H = canvas.height;

    const BASE_GRAVITY = 0.55;
    const JUMP_FORCE   = -13;
    const SPEED        = 4;
    const DEATH_FRAMES = 130;
    const LEVEL_FLASH_FRAMES = 60;

    let deathCount   = 0;
    let currentLevel = 1;
    let levelFlash   = 0;
    let tick         = 0;   // increments every draw frame — drives all visual effects
    let animFrame    = 0;   // stickman run frame 0-3
    let animTimer    = 0;   // ticks since last frame advance

    // ── Star field — generated once, fixed positions ─────────────────────────────
    interface Star { x:number; y:number; r:number; phase:number; blue:boolean }
    const stars: Star[] = [];
    for(let i=0;i<150;i++){
      stars.push({ x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.2+0.3,
                   phase:Math.random()*Math.PI*2, blue:Math.random()>0.65 });
    }
    const nebulae = [
      {x:180,y:140,rx:130,ry:65,  color:'rgba(90,20,140,0.07)'},
      {x:660,y:290,rx:110,ry:55,  color:'rgba(20,50,130,0.06)'},
      {x:420,y:70, rx:90, ry:42,  color:'rgba(110,25,90,0.05)'},
    ];

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
          {id:'g1', x:0,  y:450,w:400,h:20,type:'ground'},
          {id:'d1', x:160,y:290,w:180,h:18,type:'death'},
          {id:'gh1',x:400,y:450,w:110,h:20,type:'ghost'},
          {id:'g2', x:510,y:450,w:390,h:20,type:'ground'},
          {id:'s1', x:540,y:370,w:140,h:18,type:'safe'},
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
        tip:['jump HERE  \u2192  (trust the arrow!)',''],
        flag:{x:20,y:450}, playerStart:{x:840,y:400},
        platforms:[
          {id:'g1',x:660,y:450,w:240,h:20,type:'ground'},
          {id:'s1',x:490,y:450,w:170,h:20,type:'safe'},
          {id:'g2',x:300,y:450,w:190,h:20,type:'ground'},
          {id:'s2',x:130,y:450,w:170,h:20,type:'safe'},
          {id:'g3',x:0,  y:450,w:130,h:20,type:'ground'},
          {id:'d1',x:490,y:290,w:170,h:18,type:'death'},
          {id:'d2',x:130,y:290,w:170,h:18,type:'death'},
          {id:'d3',x:30, y:330,w:90, h:16,type:'death'},
          {id:'dec1',x:350,y:170,w:80,h:16,type:'death'},
          {id:'dec2',x:180,y:200,w:60,h:16,type:'death'},
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
      // Deep space
      ctx.fillStyle='#020010';
      ctx.fillRect(0,0,W,H);

      // Nebula blobs
      for(const n of nebulae){
        ctx.save();
        ctx.scale(1, n.ry/n.rx);
        const g=ctx.createRadialGradient(n.x, n.y*n.rx/n.ry, 0, n.x, n.y*n.rx/n.ry, n.rx);
        g.addColorStop(0, n.color);
        g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g;
        ctx.beginPath();
        ctx.arc(n.x, n.y*n.rx/n.ry, n.rx, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }

      // Stars with gentle twinkle
      for(const s of stars){
        const bright = 0.4+0.6*(0.5+0.5*Math.sin(tick*0.03+s.phase));
        ctx.globalAlpha = bright*(0.35+(s.r-0.3)/1.2*0.65);
        ctx.fillStyle = s.blue ? '#bbddff' : '#ffffff';
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1;
    }

    // ── Asteroid-style helper — craters on surface ───────────────────────────────
    function craters(p: any, yFrac: number){
      ctx.fillStyle='rgba(0,0,0,0.30)';
      const step=Math.max(20, p.w/Math.max(1, (p.w/24)|0));
      for(let i=(p.x+step*0.55)|0; i<p.x+p.w-8; i+=step){
        ctx.beginPath(); ctx.arc(i, p.y+p.h*yFrac, 2, 0, Math.PI*2); ctx.fill();
      }
    }

    function drawGround(p: any){
      ctx.fillStyle='#2a1f3d'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#6b4fa0'; ctx.fillRect(p.x,p.y,p.w,2);
      craters(p, 0.62);
    }

    function drawDeath(p: any){
      const pulse=0.7+0.3*Math.sin(tick*0.06);
      const g=ctx.createLinearGradient(p.x,p.y,p.x,p.y+p.h);
      g.addColorStop(0,`rgb(0,${(180+75*pulse)|0},40)`); g.addColorStop(1,'#001500');
      ctx.fillStyle=g; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.shadowColor='#00ff41'; ctx.shadowBlur=10*pulse;
      ctx.fillStyle=`rgba(80,255,80,${0.7+0.3*pulse})`;
      for(let i=p.x+8;i<p.x+p.w-4;i+=12){
        ctx.beginPath(); ctx.moveTo(i,p.y); ctx.lineTo(i-3,p.y-5); ctx.lineTo(i+3,p.y-5); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle=`rgba(0,255,65,${0.5+0.5*pulse})`; ctx.lineWidth=1;
      ctx.strokeRect(p.x,p.y,p.w,p.h); ctx.shadowBlur=0;
    }

    function drawSafe(p: any){
      ctx.fillStyle='#1a0000'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.shadowColor='#ff4400'; ctx.shadowBlur=6;
      const sw=14;
      for(let i=p.x;i<p.x+p.w;i+=sw){
        const g=ctx.createLinearGradient(i+sw/2,p.y,i+sw/2,p.y-6);
        g.addColorStop(0,'#ff4400'); g.addColorStop(1,'#ff8800');
        ctx.fillStyle=g;
        ctx.beginPath(); ctx.moveTo(i,p.y); ctx.lineTo(i+sw/2,p.y-6);
        ctx.lineTo(Math.min(i+sw,p.x+p.w),p.y); ctx.closePath(); ctx.fill();
      }
      ctx.shadowBlur=0;
    }

    function drawGroundFlipped(p: any){
      ctx.fillStyle='#2a1f3d'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#6b4fa0'; ctx.fillRect(p.x,p.y+p.h-2,p.w,2);
      craters(p, 0.38);
    }

    function drawDeathFlipped(p: any){
      const pulse=0.7+0.3*Math.sin(tick*0.06);
      const g=ctx.createLinearGradient(p.x,p.y,p.x,p.y+p.h);
      g.addColorStop(0,'#001500'); g.addColorStop(1,`rgb(0,${(180+75*pulse)|0},40)`);
      ctx.fillStyle=g; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.shadowColor='#00ff41'; ctx.shadowBlur=10*pulse;
      ctx.fillStyle=`rgba(80,255,80,${0.7+0.3*pulse})`;
      for(let i=p.x+8;i<p.x+p.w-4;i+=12){
        ctx.beginPath(); ctx.moveTo(i,p.y+p.h); ctx.lineTo(i-3,p.y+p.h+5); ctx.lineTo(i+3,p.y+p.h+5); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle=`rgba(0,255,65,${0.5+0.5*pulse})`; ctx.lineWidth=1;
      ctx.strokeRect(p.x,p.y,p.w,p.h); ctx.shadowBlur=0;
    }

    function drawSafeFlipped(p: any){
      ctx.fillStyle='#1a0000'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.shadowColor='#ff4400'; ctx.shadowBlur=6;
      const sw=14;
      for(let i=p.x;i<p.x+p.w;i+=sw){
        const g=ctx.createLinearGradient(i+sw/2,p.y+p.h,i+sw/2,p.y+p.h+6);
        g.addColorStop(0,'#ff4400'); g.addColorStop(1,'#ff8800');
        ctx.fillStyle=g;
        ctx.beginPath(); ctx.moveTo(i,p.y+p.h); ctx.lineTo(i+sw/2,p.y+p.h+6);
        ctx.lineTo(Math.min(i+sw,p.x+p.w),p.y+p.h); ctx.closePath(); ctx.fill();
      }
      ctx.shadowBlur=0;
    }

    function drawPassthrough(p: any){
      ctx.fillStyle='#2a1f3d'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#6b4fa0'; ctx.fillRect(p.x,p.y,p.w,2);
    }

    function drawGhost(p: any){
      // Very faint shimmer — barely-visible hint that something is there
      const alpha=0.10+0.05*Math.sin(tick*0.04+p.x*0.01);
      ctx.globalAlpha=alpha; ctx.fillStyle='#8888ff';
      const step=Math.max(18,(p.w/6)|0);
      for(let i=(p.x+step*0.5)|0; i<p.x+p.w; i+=step){
        ctx.beginPath(); ctx.arc(i,p.y+2,1.5,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1;
    }

    function drawVanish(p: any){
      if(p.disabled) return;
      const t=vanishTimers[p.id]||0, maxT=48;
      const alpha=t>0?Math.max(0,1-t/maxT):1;
      ctx.globalAlpha=alpha;
      ctx.fillStyle='#3a1060'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#9944cc'; ctx.fillRect(p.x,p.y,p.w,2);
      if(t>20){
        ctx.strokeStyle='rgba(180,80,255,0.7)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(p.x+p.w*0.3,p.y); ctx.lineTo(p.x+p.w*0.4,p.y+p.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x+p.w*0.7,p.y); ctx.lineTo(p.x+p.w*0.6,p.y+p.h); ctx.stroke();
      }
      ctx.globalAlpha=1;
    }

    function drawCracked(p: any){
      ctx.fillStyle='#2a1020'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#662244'; ctx.fillRect(p.x,p.y,p.w,2);
      ctx.strokeStyle='rgba(200,60,100,0.6)'; ctx.lineWidth=2;
      for(let i=0;i<4;i++){
        const cx2=p.x+(i+1)*p.w/5;
        ctx.beginPath(); ctx.moveTo(cx2,p.y);
        ctx.lineTo(cx2+rnd(-6,6),p.y+p.h/2);
        ctx.lineTo(cx2+rnd(-6,6),p.y+p.h); ctx.stroke();
      }
      ctx.shadowColor='#ff4488'; ctx.shadowBlur=4;
      ctx.fillStyle='#ff4488'; ctx.font='10px monospace';
      ctx.fillText('UNSAFE?',p.x+4,p.y-4); ctx.shadowBlur=0;
    }

    function drawSpikeTrap(p: any){
      ctx.fillStyle='#2a1f3d'; ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#6b4fa0'; ctx.fillRect(p.x,p.y,p.w,2);
      const t=spikeTimers[p.id]||0, maxT=72;
      if(p.spiked){
        ctx.shadowColor='#ff4400'; ctx.shadowBlur=8;
        const sw=14;
        for(let i=p.x;i<p.x+p.w;i+=sw){
          const g=ctx.createLinearGradient(i+sw/2,p.y,i+sw/2,p.y-14);
          g.addColorStop(0,'#ff2200'); g.addColorStop(1,'#ff8800');
          ctx.fillStyle=g;
          ctx.beginPath(); ctx.moveTo(i,p.y); ctx.lineTo(i+sw/2,p.y-14);
          ctx.lineTo(Math.min(i+sw,p.x+p.w),p.y); ctx.closePath(); ctx.fill();
        }
        ctx.shadowBlur=0;
      } else if(t>0){
        const prog=Math.min(t/maxT,1), sh=prog*14, sw=14;
        for(let i=p.x;i<p.x+p.w;i+=sw){
          ctx.fillStyle=`rgba(255,${(68+100*prog)|0},0,${0.3+0.7*prog})`;
          ctx.beginPath(); ctx.moveTo(i,p.y); ctx.lineTo(i+sw/2,p.y-sh);
          ctx.lineTo(Math.min(i+sw,p.x+p.w),p.y); ctx.closePath(); ctx.fill();
        }
      }
      craters(p, 0.62);
    }

    function drawCheckpoint(p: any){
      const cx2=p.x+p.w/2, cy2=p.y+p.h/2;
      const pulse=0.5+0.5*Math.sin(tick*0.05);
      // Dark red pulsing aura
      const aura=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,28);
      aura.addColorStop(0,`rgba(180,0,0,${0.35*pulse})`);
      aura.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=aura; ctx.fillRect(cx2-28,cy2-28,56,56);
      // Star with slow wobble
      const rot=Math.sin(tick*0.04)*0.2;
      ctx.save(); ctx.translate(cx2,cy2); ctx.rotate(rot);
      ctx.shadowColor='#cc6600'; ctx.shadowBlur=12;
      ctx.fillStyle='#ffdd00'; ctx.strokeStyle='#cc6600'; ctx.lineWidth=2;
      const spikes=5, or=14, ir=6;
      ctx.beginPath();
      for(let i=0;i<spikes*2;i++){
        const r=i%2===0?or:ir, angle=(i*Math.PI/spikes)-Math.PI/2;
        if(i===0) ctx.moveTo(r*Math.cos(angle),r*Math.sin(angle));
        else ctx.lineTo(r*Math.cos(angle),r*Math.sin(angle));
      }
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur=0;
      ctx.fillStyle='#220000'; ctx.font='bold 7px monospace'; ctx.textAlign='center';
      ctx.fillText('SAVE',0,3);
      ctx.restore(); ctx.textAlign='left';
    }

    function drawPlatform(p: any){
      if(p.disabled) return;
      const flipped=!!(levelData.gravityFlipX && p.x>=levelData.gravityFlipX);
      switch(p.type){
        case 'ground':      flipped?drawGroundFlipped(p):drawGround(p);   break;
        case 'death':       flipped?drawDeathFlipped(p):drawDeath(p);     break;
        case 'safe':        flipped?drawSafeFlipped(p):drawSafe(p);       break;
        case 'ghost':       drawGhost(p);                                   break;
        case 'passthrough': drawPassthrough(p);                            break;
        case 'vanish':      drawVanish(p);                                 break;
        case 'cracked':     drawCracked(p);                                break;
        case 'spikeTrap':   drawSpikeTrap(p);                              break;
        case 'checkpoint':  drawCheckpoint(p);                             break;
      }
    }

    function drawFlagInverted(f: any){
      if(!f) return;
      const ceilY=20, pulse=0.7+0.3*Math.sin(tick*0.04), size=16+4*pulse;
      ctx.strokeStyle='#334466'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(f.x,ceilY); ctx.lineTo(f.x,ceilY+60); ctx.stroke();
      ctx.shadowColor='#00ffff'; ctx.shadowBlur=14*pulse;
      const pg=ctx.createRadialGradient(f.x,ceilY+60,0,f.x,ceilY+60,size);
      pg.addColorStop(0,'rgba(0,255,255,0.95)');
      pg.addColorStop(0.5,'rgba(0,180,255,0.4)');
      pg.addColorStop(1,'rgba(0,80,200,0)');
      ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(f.x,ceilY+60,size,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(200,255,255,${0.8+0.2*pulse})`;
      ctx.beginPath(); ctx.arc(f.x,ceilY+60,3,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle='rgba(0,255,255,0.8)'; ctx.font='bold 8px monospace';
      ctx.textAlign='center'; ctx.fillText('END',f.x,ceilY+76); ctx.textAlign='left';
    }

    function drawFlag(f: any){
      if(!f) return;
      if(levelData.gravityFlipX && f.x>=levelData.gravityFlipX){ drawFlagInverted(f); return; }
      const pulse=0.7+0.3*Math.sin(tick*0.04), size=16+4*pulse;
      ctx.strokeStyle='#334466'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(f.x,f.y-60); ctx.stroke();
      ctx.shadowColor='#00ffff'; ctx.shadowBlur=14*pulse;
      const pg=ctx.createRadialGradient(f.x,f.y-60,0,f.x,f.y-60,size);
      pg.addColorStop(0,'rgba(0,255,255,0.95)');
      pg.addColorStop(0.5,'rgba(0,180,255,0.4)');
      pg.addColorStop(1,'rgba(0,80,200,0)');
      ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(f.x,f.y-60,size,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(200,255,255,${0.8+0.2*pulse})`;
      ctx.beginPath(); ctx.arc(f.x,f.y-60,3,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle='rgba(0,255,255,0.8)'; ctx.font='bold 8px monospace';
      ctx.textAlign='center'; ctx.fillText('END',f.x,f.y-44); ctx.textAlign='left';
    }

    function drawStick(x: number, y: number, dead: boolean){
      const cx=x+8, hy=y;
      ctx.lineCap='round'; ctx.lineWidth=2.5;
      if(!dead){ ctx.shadowColor='rgba(160,160,255,0.5)'; ctx.shadowBlur=5; }
      ctx.strokeStyle=dead?'#ff4444':'#ddeeff';

      // Head
      ctx.beginPath(); ctx.arc(cx,hy+6,6,0,Math.PI*2); ctx.stroke();
      // Body
      ctx.beginPath(); ctx.moveTo(cx,hy+12); ctx.lineTo(cx,hy+26); ctx.stroke();

      let lax:number,lay:number,rax:number,ray:number;
      let llx:number,lly:number,rlx:number,rly:number;

      if(dead){
        // X eyes
        ctx.lineWidth=1.5;
        ([[cx-4,hy+3,cx-2,hy+5],[cx-2,hy+3,cx-4,hy+5],
          [cx+2,hy+3,cx+4,hy+5],[cx+4,hy+3,cx+2,hy+5]] as number[][]).forEach(([x1,y1,x2,y2])=>{
          ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        });
        ctx.lineWidth=2.5;
        // Crumpled limbs
        lax=cx-10; lay=hy+12; rax=cx+8;  ray=hy+10;
        llx=cx-8;  lly=hy+36; rlx=cx+10; rly=hy+34;
      } else {
        const isJumping=!player.onGround && Math.abs(player.vy)>1;
        const isMoving =Math.abs(player.vx)>0;

        if(isJumping){
          // Arms up, legs tucked
          lax=cx-10; lay=hy+8;  rax=cx+10; ray=hy+8;
          llx=cx-4;  lly=hy+38; rlx=cx+4;  rly=hy+38;
        } else if(isMoving){
          // 4-frame run cycle
          switch(animFrame){
            case 0: // left arm fwd, right leg fwd
              lax=cx-12; lay=hy+14; rax=cx+6;  ray=hy+22;
              llx=cx-8;  lly=hy+36; rlx=cx+10; rly=hy+31; break;
            case 2: // right arm fwd, left leg fwd
              lax=cx-6;  lay=hy+22; rax=cx+12; ray=hy+14;
              llx=cx-10; lly=hy+31; rlx=cx+8;  rly=hy+36; break;
            default: // neutral frames 1 & 3
              lax=cx-9; lay=hy+20; rax=cx+9; ray=hy+20;
              llx=cx-5; lly=hy+36; rlx=cx+5; rly=hy+36; break;
          }
        } else {
          // Standing
          lax=cx-9; lay=hy+22; rax=cx+9; ray=hy+22;
          llx=cx-7; lly=hy+36; rlx=cx+7; rly=hy+36;
        }
      }

      ctx.beginPath(); ctx.moveTo(cx,hy+16); ctx.lineTo(lax,lay); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,hy+16); ctx.lineTo(rax,ray); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,hy+26); ctx.lineTo(llx,lly); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,hy+26); ctx.lineTo(rlx,rly); ctx.stroke();
      ctx.shadowBlur=0; ctx.lineWidth=1;
    }

    function drawApples(){
      for(const a of apples){
        // Comet tail below (apples fly upward, tail trails down)
        const tailLen=a.r*3.5;
        const tg=ctx.createLinearGradient(a.x,a.y,a.x,a.y+tailLen);
        tg.addColorStop(0,`rgba(255,${(80+60*(0.5+0.5*Math.sin(tick*0.1+a.x)))|0},0,0.65)`);
        tg.addColorStop(1,'rgba(200,40,0,0)');
        ctx.fillStyle=tg;
        ctx.beginPath(); ctx.ellipse(a.x,a.y+tailLen/2,a.r*0.45,tailLen/2,0,0,Math.PI*2); ctx.fill();
        // Glowing core
        ctx.shadowColor='#ff6600'; ctx.shadowBlur=12;
        const cg=ctx.createRadialGradient(a.x,a.y,0,a.x,a.y,a.r);
        cg.addColorStop(0,'#ffffff'); cg.addColorStop(0.3,'#ffcc00'); cg.addColorStop(1,'#ff3300');
        ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(a.x,a.y,a.r,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
      }
    }

    function drawHUD(){
      ctx.font='13px monospace';
      // Deaths — red glow
      ctx.shadowColor='#ff2222'; ctx.shadowBlur=7;
      ctx.fillStyle='#ff7777';
      ctx.fillText('deaths: '+deathCount, 12, 22);
      ctx.shadowBlur=0;
      // Level — blue glow
      ctx.textAlign='right';
      ctx.shadowColor='#3366ff'; ctx.shadowBlur=7;
      ctx.fillStyle='#8899ff';
      ctx.fillText('level '+currentLevel+'/10', W-12, 22);
      ctx.shadowBlur=0; ctx.textAlign='left';

      const tip=levelData.tip;
      if(tip&&tip[0]){
        ctx.font='12px monospace'; ctx.fillStyle='#445566';
        const tw=ctx.measureText(tip[0]).width;
        ctx.fillText(tip[0], W/2-tw/2, 22);
        if(tip[1]){
          ctx.font='11px monospace'; ctx.fillStyle='#334455';
          const tw2=ctx.measureText(tip[1]).width;
          ctx.fillText(tip[1], W/2-tw2/2, 38);
        }
      }

      if(currentLevel===6&&postFirstDeath){
        ctx.fillStyle='rgba(255,100,100,0.6)'; ctx.font='italic 13px monospace';
        ctx.fillText('something feels... off', 12, H-16);
      }

      if(currentLevel===8){
        ctx.shadowColor='#ff6600'; ctx.shadowBlur=6;
        ctx.fillStyle='#ff6600'; ctx.font='bold 13px monospace';
        ctx.fillText('jump HERE \u2192', 370, 275);
        ctx.strokeStyle='#ff6600'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(490,269); ctx.lineTo(512,269); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(512,269); ctx.lineTo(506,264); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(512,269); ctx.lineTo(506,274); ctx.stroke();
        ctx.shadowBlur=0;
      }

      if(currentLevel===10&&controlSwapTimer>0){
        ctx.fillStyle='rgba(255,80,80,0.85)'; ctx.font='bold 15px monospace';
        ctx.textAlign='center';
        ctx.fillText('\u26a0 CONTROLS SWAPPED ('+Math.ceil(controlSwapTimer/60)+'s)', W/2, H-18);
        ctx.textAlign='left';
      }

      if(gravityFlipped){
        ctx.shadowColor='#aa44ff'; ctx.shadowBlur=6;
        ctx.fillStyle='rgba(180,100,255,0.8)'; ctx.font='12px monospace';
        ctx.fillText('\u2195 gravity inverted', 12, H-16);
        ctx.shadowBlur=0;
      }
    }

    function drawDeathScreen(){
      ctx.fillStyle='rgba(0,0,10,0.82)'; ctx.fillRect(0,0,W,H);
      ctx.font='bold 48px monospace'; ctx.textAlign='center';
      // Glitch: chromatic aberration offset copies
      ctx.fillStyle='rgba(255,0,0,0.45)';
      ctx.fillText(deathMsg, W/2-2, H/2-20);
      ctx.fillStyle='rgba(0,80,255,0.45)';
      ctx.fillText(deathMsg, W/2+2, H/2-19);
      // Main text with glow
      ctx.shadowColor='#ff0000'; ctx.shadowBlur=10;
      ctx.fillStyle='#ff4444';
      ctx.fillText(deathMsg, W/2, H/2-20);
      ctx.shadowBlur=0;
      ctx.fillStyle='#445566'; ctx.font='16px monospace';
      ctx.fillText('restarting level...', W/2, H/2+30);
      ctx.textAlign='left';
    }

    function drawLevelWon(){
      ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,W,H);
      ctx.shadowColor='#00ff88'; ctx.shadowBlur=16;
      ctx.fillStyle='#aaffaa'; ctx.font='bold 42px monospace'; ctx.textAlign='center';
      ctx.fillText('NICE!', W/2, H/2);
      ctx.shadowBlur=0;
      ctx.fillStyle='#667788'; ctx.font='18px monospace';
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

      // Stickman run animation
      if(Math.abs(player.vx)>0){
        animTimer++;
        if(animTimer>=8){ animTimer=0; animFrame=(animFrame+1)%4; }
      } else {
        animTimer=0; animFrame=0;
      }

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
          const prevTop=player.y-player.vy;
          if(player.x+player.w>p.x&&player.x<p.x+p.w&&
             prevTop>=botY-8&&player.y<=botY){
            if(player.vy<=0){ player.y=botY; player.vy=0; player.onGround=true; }
          }
        }
      }

      // Apples / meteors
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
      tick++;  // drives all pulsing/animation effects
      ctx.clearRect(0,0,W,H);
      drawBG();
      for(const p of levelData.platforms) drawPlatform(p);
      drawFlag(levelData.flag);
      drawApples();
      drawStick(player.x,player.y,player.dead);
      drawHUD();
      if(player.dead) drawDeathScreen();
      if(levelWon&&!gameWon) drawLevelWon();
      drawLevelFlash();
    }

    // ── Key listeners ────────────────────────────────────────────────────────────

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
      style={{ border: '2px solid #1a0a3a', background: '#020010', display: 'block' }}
    />
  );
}
