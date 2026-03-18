/**
 * game.tsx  — Absorbio Blackhole Game (React Native Skia port)
 * Full feature parity with the web version (BlackholeGame.jsx).
 * Engine logic is a near-verbatim copy; rendering is rebuilt in Skia.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  TouchableOpacity, PanResponder,
} from 'react-native';
import {
  Canvas, Circle, Path, Group, Rect, Text as SkiaText,
  useFont, vec, Shadow, BlurMask, Skia, Paint, FillType,
  RadialGradient, LinearGradient,
} from '@shopify/react-native-skia';
import { useAuth } from '@/lib/auth-context';
import { updateStats } from '@/lib/firebase-db';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Trophy, AlertTriangle, Zap, Magnet, X } from 'lucide-react-native';

// ─── Constants ──────────────────────────────────────────────────────────────

const NEON: [string, string][] = [
  ['#00f5ff', '#00c3ff'], ['#ff00ff', '#ff4dff'], ['#00ff88', '#00cc66'],
  ['#ff8800', '#ffaa33'], ['#ff0033', '#ff3366'], ['#7c3aed', '#a855f7'],
];

// ─── Joystick ───────────────────────────────────────────────────────────────

interface JoyData { x: number; y: number; active: boolean }

function Joystick({
  side, onMove, size = 130,
}: {
  side: 'left' | 'right';
  onMove: (d: JoyData) => void;
  size?: number;
}) {
  const R      = size / 2;
  const knobR  = R * 0.38;
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => {
      setKnob(k => ({ ...k, active: true }));
      onMove({ x: 0, y: 0, active: true });
    },
    onPanResponderMove: (_, { dx, dy }) => {
      const dist    = Math.sqrt(dx * dx + dy * dy);
      const clamped = Math.min(dist, R);
      const ang     = Math.atan2(dy, dx);
      // deadzone 12 px (matches web)
      const dead = 12;
      if (dist < dead) { onMove({ x: 0, y: 0, active: true }); return; }
      const mapped = (clamped - dead) / (R - dead);
      const nx = Math.cos(ang) * mapped;
      const ny = Math.sin(ang) * mapped;
      setKnob({ x: Math.cos(ang) * (clamped / R), y: Math.sin(ang) * (clamped / R), active: true });
      onMove({ x: nx, y: ny, active: true });
    },
    onPanResponderRelease: () => {
      setKnob({ x: 0, y: 0, active: false });
      onMove({ x: 0, y: 0, active: false });
    },
  })).current;

  return (
    <View
      {...pan.panHandlers}
      style={[joyStyles.area, side === 'left' ? { left: 0 } : { right: 0 }]}
    >
      <View style={[joyStyles.base, {
        width: R * 2, height: R * 2, borderRadius: R,
        opacity: knob.active ? 0.75 : 0.3,
      }]}>
        <View style={[joyStyles.knob, {
          width: knobR * 2, height: knobR * 2, borderRadius: knobR,
          transform: [
            { translateX: knob.x * (R - knobR) },
            { translateY: knob.y * (R - knobR) },
          ],
        }]} />
      </View>
    </View>
  );
}

const joyStyles = StyleSheet.create({
  area: {
    position: 'absolute', width: '50%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  base: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  knob: { backgroundColor: 'rgba(168,85,247,0.85)', position: 'absolute' },
});

// ─── GameScreen ──────────────────────────────────────────────────────────────

interface GameScreenProps {
  mode?: 'infinity' | 'survival' | 'time';
  onExit?: () => void;
  addCoins?: (n: number) => void;
  setXp?: (fn: (prev: number) => number) => void;
  balance?: number;
}

const THEME_BG_COLORS: Record<string, [string, string]> = {
  Space:  ['#2a0f4f', '#050015'],
  Neon:   ['#001122', '#002233'],
  Dark:   ['#111111', '#000000'],
  Sunset: ['#ff9966', '#1a0026'],
  Cosmic: ['#0ea5e9', '#000814'],
};

export default function GameScreen({
  mode: initMode = 'infinity',
  onExit = () => {},
  addCoins = () => {},
  setXp = () => {},
  balance = 0,
}: GameScreenProps) {

  // ── Read route params (mode & theme from home screen) ──
  const params = useLocalSearchParams<{ mode?: string; theme?: string }>();
  const resolvedMode = (params.mode as 'infinity' | 'survival' | 'time') || initMode;
  const resolvedTheme = params.theme || 'Space';

  const dims = Dimensions.get('window');
  const W    = dims.width;
  const H    = dims.height;
  const { user, userData, refreshUserData } = useAuth();

  // Use resolvedMode as the actual game mode
  const activeMode = resolvedMode;

  // ── UI state (rendered every frame via frameTick) ──
  const [frameTick, setFrameTick]           = useState(0);
  const [gameState, setGameState]           = useState<'playing' | 'gameover'>('playing');
  const [score, setScore]                   = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [mass, setMass]                     = useState(5);
  const [instability, setInstability]       = useState(0);
  const [leaderboard, setLeaderboard]       = useState<any[]>([]);
  const [aliveCount, setAliveCount]         = useState(0);
  const [isWin, setIsWin]                   = useState(false);
  const [deathFeed, setDeathFeed]           = useState<any[]>([]);
  const [eventText, setEventText]           = useState<string | null>(null);
  const [xpEarned, setXpEarned]             = useState(0);
  const [reviveTimer, setReviveTimer]       = useState(6);
  const [revived, setRevived]               = useState(false);
  const [rocketActive, setRocketActive]     = useState(false);
  const [rocketCooldown, setRocketCooldown] = useState(0);
  const [rocketTimer2, setRocketTimer2]     = useState(0);
  const [rocketClickCount, setRocketClickCount] = useState(0);
  const [showExitPopup, setShowExitPopup]   = useState(false);
  const [gems, setGems]                     = useState(balance || 0);

  const font     = useFont(require('@/assets/fonts/SpaceMono-Regular.ttf'), 11);
  const fontSm   = useFont(require('@/assets/fonts/SpaceMono-Regular.ttf'), 9);
  const rafRef   = useRef<number | null>(null);
  const evTORef  = useRef<any>(null);
  const onExitRef = useRef(onExit);
  useEffect(() => { onExitRef.current = onExit; }, [onExit]);
  useEffect(() => { setGems(balance || 0); }, [balance]);

  // ── Orientation lock ──
  useFocusEffect(
    React.useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }, [])
  );

  // ─── Engine ref (matches web engine.current exactly) ─────────────────────

  const eng = useRef({
    mode: resolvedMode as 'infinity' | 'survival' | 'time',
    controlType: 'dual',
    swapStick: false,
    moveStick: { x: 0, y: 0, active: false, baseX: 0, baseY: 0 },
    aimStick:  { x: 0, y: 0, active: false, baseX: 0, baseY: 0 },
    inventory: { magnet: 0, speed: 0, double: 0 },
    survival: {
      active: false, phase: 'idle' as 'idle'|'preview'|'shrinking',
      currentRadius: 0, targetRadius: 0,
      centerX: 0, centerY: 0, nextCenterX: 0, nextCenterY: 0,
      previewTime: 900, timer: 0, shrinkSpeed: 0.5,
    },
    timeModeDuration: 300, timeRemaining: 0,
    lastSecond: 0, lastTimerUpdate: 0,
    swirlAngle: 0,
    rocketActive: false, rocketTimer: 0, rocketCooldown: 0,
    rocketClickCount: 0, instabilityFreezeTimer: 0, instabilitySlowMult: 1,
    width: W, height: H, worldSize: 8000,
    player: {
      x: 4000, y: 4000, targetX: 4000, targetY: 4000,
      radius: 10, mass: 5, speed: 3.5, instability: 0,
      spawnShield: 0, directionAngle: 0, moving: false, ringColor: '#fff',
    },
    objects:    [] as any[],
    bots:       [] as any[],
    dangerZones:[] as any[],
    zoneCount: 5, zoneEventActive: false, zoneSpawnIndex: 0, zoneLife: 0,
    blackHoles: [] as any[],
    blackHoleActive: false, blackHoleLife: 0,
    currentEvent: null as null|string,
    nextEventTime: Date.now() + 50000, eventEndTime: 0,
    powerups:   [] as any[],
    magnetTimer: 0, speedTimer: 0, doubleScoreTimer: 0,
    gameTick: 0, coins: [] as any[], coinSpawnTimer: 0,
    botKills: 0, startTime: 0, isDead: false,
    score: 0, coinsCollected: 0, lastInputTime: 0,
    magnetWaves: [] as any[],
    timeScale: 1, zoom: 1, targetZoom: 1,
    stars: [] as any[], lbTimer: 0, topLeader: '',
    visibleObjCount: 0,
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const generateCollectorName = () => 'Collector-' + Math.floor(100 + Math.random() * 900);

  const respawnBot = (bot: any, isInit = false) => {
    if (!eng.current) return;
    if (eng.current.mode === 'survival' && !isInit) return;
    const worldSize = eng.current.worldSize;
    const angle = Math.random() * Math.PI * 2;
    let dist; const safeZone = 300;
    do { dist = Math.random() * (worldSize / 2 - 100); } while (dist < safeZone);
    bot.x = worldSize/2 + Math.cos(angle)*dist;
    bot.y = worldSize/2 + Math.sin(angle)*dist;
    bot.targetX = bot.x; bot.targetY = bot.y;
    bot.mass = 15 + Math.random() * 25;
    bot.radius = Math.max(8, 8 + Math.pow(bot.mass, 0.32) * 1.5);
    bot.speed = 3.5; bot.state = 'farm';
    bot.stateTimer = 300 + Math.random() * 300;
    bot.fearTimer = 0; bot.score = 0;
    bot.massInstability = 0; bot.instability = 0;
    bot.instabilityThreshold = 100000 + Math.random() * 400000;
    bot.alive = true;
    const colors = ['#22d3ee','#f43f5e','#facc15','#4ade80','#a78bfa'];
    bot.color = colors[Math.floor(Math.random() * colors.length)];
  };

  const generateNextZone = () => {
    const s = eng.current.survival;
    s.targetRadius = s.currentRadius * 0.75;
    const maxOffset = s.currentRadius - s.targetRadius;
    const angle = Math.random() * Math.PI * 2;
    const dist  = Math.random() * maxOffset;
    s.nextCenterX = s.centerX + Math.cos(angle) * dist;
    s.nextCenterY = s.centerY + Math.sin(angle) * dist;
    s.phase = 'preview'; s.timer = s.previewTime;
  };

  // ─── Spawn functions ─────────────────────────────────────────────────────

  const spawnObject = useCallback(() => {
    const worldSize = eng.current.worldSize;
    const radius    = 6 + Math.random() * 18;
    const pair      = NEON[Math.floor(Math.random() * NEON.length)];
    const rareChance = Math.random();
    let massMultiplier = 1;
    if (rareChance > 0.96) massMultiplier = 4;
    else if (rareChance > 0.85) massMultiplier = 2;
    eng.current.objects.push({
      x: radius + Math.random() * (worldSize - radius * 2),
      y: radius + Math.random() * (worldSize - radius * 2),
      radius, mass: radius * massMultiplier,
      color1: pair[0], color2: pair[1], type: 'food',
      category: radius > 14 ? 'medium' : massMultiplier >= 3 ? 'rare' : 'small',
      vx: (Math.random()-0.5)*1, vy: (Math.random()-0.5)*1,
      pulse: Math.random()*Math.PI,
      rotation: Math.random()*Math.PI*2,
      rotationSpeed: (Math.random()>0.5?1:-1)*(0.01+Math.random()*0.08),
      rare: massMultiplier > 1,
    });
  }, []);

  const spawnObjectNear = useCallback((nearX: number, nearY: number) => {
    const worldSize = eng.current.worldSize;
    const worldCenter = worldSize / 2;
    const maxWorldRadius = worldSize / 2 - 100;
    let x, y, attempts = 0;
    do {
      const angle = Math.random()*Math.PI*2;
      const dist  = 300 + Math.random()*1000;
      x = nearX + Math.cos(angle)*dist;
      y = nearY + Math.sin(angle)*dist;
      const d = Math.sqrt((x-worldCenter)**2 + (y-worldCenter)**2);
      if (d <= maxWorldRadius) break;
      attempts++;
    } while (attempts < 10);
    const dx = x! - worldCenter, dy = y! - worldCenter;
    if (Math.sqrt(dx*dx+dy*dy) > maxWorldRadius) {
      const a = Math.atan2(dy, dx);
      x = worldCenter + Math.cos(a)*(maxWorldRadius*Math.random());
      y = worldCenter + Math.sin(a)*(maxWorldRadius*Math.random());
    }
    const radius = 6+Math.random()*18;
    const pair   = NEON[Math.floor(Math.random()*NEON.length)];
    const rc     = Math.random();
    let mm = 1; if (rc>0.96) mm=4; else if (rc>0.85) mm=2;
    eng.current.objects.push({
      x: x!, y: y!, radius, mass: radius*mm,
      color1: pair[0], color2: pair[1], type: 'food',
      category: radius>14?'medium':mm>=3?'rare':'small',
      vx:(Math.random()-0.5)*1, vy:(Math.random()-0.5)*1,
      pulse:Math.random()*Math.PI, rotation:Math.random()*Math.PI*2,
      rotationSpeed:(Math.random()>0.5?1:-1)*(0.01+Math.random()*0.08),
      rare: mm>1,
    });
  }, []);

  const spawnObjectClose = useCallback((nearX: number, nearY: number) => {
    const worldSize = eng.current.worldSize;
    const worldCenter = worldSize/2, maxR = worldSize/2-100;
    const angle = Math.random()*Math.PI*2, dist = 400+Math.random()*800;
    let x = nearX+Math.cos(angle)*dist, y = nearY+Math.sin(angle)*dist;
    const dx=x-worldCenter, dy=y-worldCenter;
    if (Math.sqrt(dx*dx+dy*dy)>maxR) {
      const a=Math.atan2(dy,dx); x=worldCenter+Math.cos(a)*maxR*0.9; y=worldCenter+Math.sin(a)*maxR*0.9;
    }
    const radius=6+Math.random()*18, pair=NEON[Math.floor(Math.random()*NEON.length)];
    const rc=Math.random(); let mm=1; if(rc>0.96) mm=4; else if(rc>0.85) mm=2;
    eng.current.objects.push({
      x,y,radius,mass:radius*mm,color1:pair[0],color2:pair[1],type:'food',
      category:radius>14?'medium':mm>=3?'rare':'small',
      vx:(Math.random()-0.5)*1,vy:(Math.random()-0.5)*1,
      pulse:Math.random()*Math.PI,rotation:Math.random()*Math.PI*2,
      rotationSpeed:(Math.random()>0.5?1:-1)*(0.01+Math.random()*0.08), rare:mm>1,
    });
  }, []);

  const spawnObjectGlobal = useCallback(() => {
    const worldSize=eng.current.worldSize, radius=6+Math.random()*18;
    const pair=NEON[Math.floor(Math.random()*NEON.length)];
    const rc=Math.random(); let mm=1; if(rc>0.96) mm=4; else if(rc>0.85) mm=2;
    eng.current.objects.push({
      x:radius+Math.random()*(worldSize-radius*2),
      y:radius+Math.random()*(worldSize-radius*2),
      radius, mass:radius*mm, color1:pair[0],color2:pair[1],type:'food',
      category:radius>14?'medium':mm>=3?'rare':'small',
      vx:(Math.random()-0.5)*1,vy:(Math.random()-0.5)*1,
      pulse:Math.random()*Math.PI,rotation:Math.random()*Math.PI*2,
      rotationSpeed:(Math.random()>0.5?1:-1)*(0.01+Math.random()*0.08),rare:mm>1,
    });
  }, []);

  const spawnObjectInZone = useCallback(() => {
    const s=eng.current.survival; if(!s.active) return;
    const radius=6+Math.random()*18;
    const pair=NEON[Math.floor(Math.random()*NEON.length)];
    const angle=Math.random()*Math.PI*2, dist=Math.random()*Math.max(0,s.currentRadius-radius-20);
    eng.current.objects.push({
      x:s.centerX+Math.cos(angle)*dist, y:s.centerY+Math.sin(angle)*dist,
      radius, mass:radius, color1:pair[0], color2:pair[1], type:'food',
      vx:(Math.random()-0.5)*0.8, vy:(Math.random()-0.5)*0.8,
      pulse:Math.random()*Math.PI, rotation:Math.random()*Math.PI*2,
      rotationSpeed:(Math.random()>0.5?1:-1)*(0.01+Math.random()*0.08),rare:false,
    });
  }, []);

  const spawnPowerup = useCallback(() => {
    const worldSize=eng.current.worldSize;
    const types=['magnet','speed','double'];
    const type=types[Math.floor(Math.random()*types.length)];
    eng.current.powerups.push({
      x:15+Math.random()*(worldSize-30), y:15+Math.random()*(worldSize-30),
      radius:15, type, pulse:0,
    });
  }, []);

  const spawnCoin = useCallback(() => {
    const worldSize=eng.current.worldSize, r=8+Math.random()*6;
    eng.current.coins.push({
      x:r+Math.random()*(worldSize-r*2), y:r+Math.random()*(worldSize-r*2),
      radius:r, value:1, pulse:Math.random()*Math.PI, rotation:Math.random()*Math.PI*2,
    });
  }, []);

  // ─── Init Game ────────────────────────────────────────────────────────────

  const initGame = useCallback((m: 'infinity'|'survival'|'time' = resolvedMode) => {
    const e = eng.current;
    e.mode = m; e.startTime = Date.now(); e.lastInputTime = Date.now();
    e.lastSecond = Date.now(); e.lastTimerUpdate = Date.now();
    e.width = W; e.height = H;
    e.zoneEventActive=false; e.zoneSpawnIndex=0; e.zoneLife=0; e.dangerZones=[];
    e.blackHoles=[]; e.blackHoleActive=false; e.blackHoleLife=0;
    e.currentEvent=null; e.nextEventTime=Date.now()+50000; e.eventEndTime=0;
    e.powerups=[]; e.magnetTimer=0; e.speedTimer=0; e.doubleScoreTimer=0;
    e.gameTick=0; e.zoom=1; e.targetZoom=1;
    e.coins=[]; e.coinSpawnTimer=0; e.magnetWaves=[]; e.coinsCollected=0;
    e.botKills=0; e.isDead=false; e.score=0; e.swirlAngle=0;
    e.rocketActive=false; e.rocketTimer=0; e.rocketCooldown=0; e.rocketClickCount=0;
    e.visibleObjCount=0; e.instabilityFreezeTimer=0; e.instabilitySlowMult=1;

    setXpEarned(0);
    const worldSize=e.worldSize, centerX=worldSize/2, centerY=worldSize/2;
    const angle=Math.random()*Math.PI*2, dist=Math.random()*(worldSize/2-50);
    const spawnX=centerX+Math.cos(angle)*dist, spawnY=centerY+Math.sin(angle)*dist;
    e.player={
      x:spawnX,y:spawnY,targetX:spawnX,targetY:spawnY,
      radius:10,mass:5,speed:3.5,instability:0,spawnShield:120,
      directionAngle:0,moving:false,ringColor:'#ffffff',
    };
    const botCount = m==='survival' ? 50 : 25;
    e.bots = Array.from({length:botCount}).map((_,i)=>{
      const bot={id:i, name:generateCollectorName(), isBot:true, alive:true,
        mass:20, radius:12, speed:3.5, state:'farm', stateTimer:300,
        fearTimer:0, score:0, massInstability:0, instability:0,
        instabilityThreshold:100000+Math.random()*400000,
      };
      respawnBot(bot, true); return bot;
    });
    e.objects=[];
    e.inventory={magnet:0,speed:0,double:0};
    const starCount=W<900?120:200;
    e.stars=Array.from({length:starCount}).map(()=>({
      x:Math.random()*worldSize, y:Math.random()*worldSize,
      size:Math.random()*1.5, alpha:0.3+Math.random()*0.7,
    }));
    for(let i=0;i<1100;i++) spawnObject();
    for(let i=0;i<19;i++)   spawnPowerup();
    for(let i=0;i<80;i++)   spawnCoin();
    if(evTORef.current) clearTimeout(evTORef.current);
    setEventText(null);
    e.survival.active=false; e.timeRemaining=0;
    if(m==='time') e.timeRemaining=e.timeModeDuration;
    if(m==='survival'){
      const s=e.survival; s.active=true; s.phase='preview';
      s.currentRadius=worldSize/2-100; s.centerX=worldSize/2; s.centerY=worldSize/2;
      s.timer=s.previewTime; s.shrinkSpeed=0.5;
      generateNextZone();
      e.bots.forEach(bot=>{
        const a=Math.random()*Math.PI*2, d=Math.random()*(s.currentRadius-200);
        bot.x=s.centerX+Math.cos(a)*d; bot.y=s.centerY+Math.sin(a)*d;
        bot.targetX=bot.x; bot.targetY=bot.y;
      });
      const pa=Math.random()*Math.PI*2, pd=Math.random()*(s.currentRadius-300);
      e.player.x=s.centerX+Math.cos(pa)*pd; e.player.y=s.centerY+Math.sin(pa)*pd;
      e.player.targetX=e.player.x; e.player.targetY=e.player.y;
    }
    setIsWin(false); setDeathFeed([]); setAliveCount(e.bots.length+1);
    setScore(0); setCoinsCollected(0); setMass(5); setInstability(0);
    setReviveTimer(6); setRevived(false); setRocketActive(false);
    setRocketCooldown(0); setRocketTimer2(0); setRocketClickCount(0);
    setGameState('playing');
  }, [W, H, resolvedMode, spawnObject, spawnPowerup, spawnCoin]);

  // ─── updateEngine (ported from web BlackholeGame.jsx) ────────────────────

  const updateEngine = useCallback(() => {
    if (gameState !== 'playing') return;
    const e=eng.current;
    const {player,objects,bots,dangerZones,powerups,blackHoles,coins,worldSize,timeScale}=e;
    const centerX=worldSize/2, centerY=worldSize/2;

    const triggerGameOver=(isWinCond=false)=>{
      if(e.isDead) return;
      e.isDead=true;
      let xpR=0;
      xpR+=e.botKills*20;
      xpR+=Math.floor((Date.now()-e.startTime)/60000)*15;
      if(e.mode==='survival'&&isWinCond) xpR+=80;
      xpR+=Math.floor(e.score/500)*5;
      setXpEarned(xpR); setXp(prev=>prev+xpR);
      if(isWinCond) setIsWin(true);
      addCoins(e.coinsCollected);
      // save stats
      if(user) updateStats(user.uid, xpR, e.coinsCollected).catch(()=>{});
      setReviveTimer(6); setRevived(false);
      setGameState('gameover');
    };

    // Time mode countdown
    if(e.mode==='time'){
      const now=Date.now();
      if(!e.lastSecond) e.lastSecond=now;
      if(now-e.lastSecond>=1000){ e.timeRemaining--; e.lastSecond=now; }
      if(e.timeRemaining<=0){ triggerGameOver(); return; }
    }

    // Coin spawn
    e.coinSpawnTimer++;
    if(e.coinSpawnTimer>300){ e.coinSpawnTimer=0; if(e.coins.length<120) spawnCoin(); }

    e.gameTick++;
    if(e.gameTick%600===0) spawnPowerup();

    // Random events (not survival)
    if(e.mode!=='survival'){
      const now=Date.now();
      if(!e.currentEvent && now>e.nextEventTime){
        const dur=40000+Math.random()*20000;
        e.eventEndTime=now+dur;
        if(Math.random()>0.5){
          e.currentEvent='zone'; e.zoneEventActive=true;
          e.zoneLife=e.eventEndTime; e.zoneSpawnIndex=0; e.dangerZones=[];
          setEventText('⚠️ Danger Zone Incoming!');
          evTORef.current=setTimeout(()=>setEventText(null),4000);
        } else {
          e.currentEvent='blackhole'; e.blackHoleActive=true;
          e.blackHoleLife=e.eventEndTime;
          const margin=800;
          e.blackHoles=[{
            x:margin+Math.random()*(worldSize-margin*2),
            y:margin+Math.random()*(worldSize-margin*2),
            radius:160, pullRadius:650, particles:[], rings:[],
          }];
          setEventText('🌀 Black Hole Appeared!');
          evTORef.current=setTimeout(()=>setEventText(null),4000);
        }
      }
      if(e.currentEvent && Date.now()>e.eventEndTime){
        e.currentEvent=null; e.zoneEventActive=false; e.blackHoleActive=false;
        e.dangerZones=[]; e.blackHoles=[];
        e.nextEventTime=Date.now()+240000+Math.random()*60000;
      }
    }

    if(e.blackHoleActive && Date.now()>e.blackHoleLife){
      e.blackHoleActive=false; e.blackHoles=[]; e.currentEvent=null;
    }

    // Danger zone spawning
    if(e.zoneEventActive){
      if(e.zoneSpawnIndex<5 && e.gameTick%120===0){
        let valid=false, attempts=0, x=0, y=0;
        const baseRadius=300+Math.random()*200, safeMapR=(worldSize/2)-baseRadius-50;
        while(!valid&&attempts<100){
          const a=Math.random()*Math.PI*2, d=Math.random()*safeMapR;
          x=centerX+Math.cos(a)*d; y=centerY+Math.sin(a)*d; valid=true;
          for(const z of e.dangerZones){
            const dd=Math.sqrt((z.x-x)**2+(z.y-y)**2);
            if(dd<z.baseRadius+baseRadius+800){valid=false;break;}
          }
          attempts++;
        }
        e.dangerZones.push({
          x,y,baseRadius,pulse:Math.random()*Math.PI*2,pulseSpeed:0.04,damageTimer:0,
          vx:(Math.random()-0.5)*0.7,vy:(Math.random()-0.5)*0.7,
        });
        e.zoneSpawnIndex++;
      }
      if(Date.now()>e.zoneLife){
        e.zoneEventActive=false; e.dangerZones=[]; e.currentEvent=null;
      }
    }

    if(player.spawnShield>0) player.spawnShield--;

    // Timer-based powerups
    const now=Date.now();
    if(!e.lastTimerUpdate) e.lastTimerUpdate=now;
    const delta=now-e.lastTimerUpdate;
    if(delta>=16){
      const step=delta/16;
      if(e.magnetTimer>0)       e.magnetTimer-=step;
      if(e.speedTimer>0)        e.speedTimer-=step;
      if(e.doubleScoreTimer>0)  e.doubleScoreTimer-=step;
      if(e.rocketTimer>0){
        e.rocketTimer-=step;
        const mc=player.mass*0.002*(step/60);
        player.mass=Math.max(5,player.mass-mc);
        player.radius=Math.max(10,8+Math.pow(player.mass,0.32)*1.67);
        e.score+=Math.floor(mc*2); setScore(e.score);
        if(e.rocketTimer<=0){e.rocketTimer=0;e.rocketActive=false;setRocketActive(false);}
      }
      if(e.rocketCooldown>0){
        e.rocketCooldown-=step;
        if(e.rocketCooldown<0) e.rocketCooldown=0;
        setRocketCooldown(Math.ceil(e.rocketCooldown/60));
      }
      if(e.instabilityFreezeTimer>0){
        e.instabilityFreezeTimer-=step;
        if(e.instabilityFreezeTimer<=0){e.instabilityFreezeTimer=0;e.instabilitySlowMult=1;}
      }
      e.lastTimerUpdate=now;
    }

    // Magnet effect
    if(e.magnetTimer>0){
      if(e.gameTick%15===0) e.magnetWaves.push({x:player.x,y:player.y,radius:0,maxRadius:500,alpha:0.6});
      objects.forEach(obj=>{
        const dx=player.x-obj.x, dy=player.y-obj.y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<500){obj.x+=dx*0.02*timeScale;obj.y+=dy*0.02*timeScale;}
      });
    }

    // Powerup collection
    for(let i=powerups.length-1;i>=0;i--){
      const p=powerups[i];
      const dx=player.x-p.x, dy=player.y-p.y;
      if(Math.sqrt(dx*dx+dy*dy)<player.radius+p.radius){
        if(p.type==='magnet') e.magnetTimer=600;
        if(p.type==='speed')  e.speedTimer=400;
        if(p.type==='double') e.doubleScoreTimer=600;
        powerups.splice(i,1);
      }
    }

    // Player speed
    const calcPlayerSpeed=(mass:number)=>{
      if(mass<=10000) return 3.5;
      return Math.max(2.85,3.5-Math.log10(mass/10000)*0.3);
    };
    let baseSpeed=calcPlayerSpeed(player.mass);
    if(e.speedTimer>0) baseSpeed*=1.8;
    player.speed=baseSpeed;

    // Player movement
    const move=e.moveStick, aim=e.aimStick;
    if(aim.active){
      const mag=Math.sqrt(aim.x**2+aim.y**2);
      if(mag>0.2) player.directionAngle=Math.atan2(aim.y,aim.x);
    }
    const moveMag=Math.sqrt(move.x**2+move.y**2);
    player.moving=move.active&&moveMag>0.1;
    if(player.moving){
      player.x+=Math.cos(player.directionAngle)*player.speed*moveMag*timeScale;
      player.y+=Math.sin(player.directionAngle)*player.speed*moveMag*timeScale;
    }

    // Danger zones
    dangerZones.forEach(zone=>{
      zone.x+=zone.vx*timeScale; zone.y+=zone.vy*timeScale;
      const zdx=zone.x-centerX,zdy=zone.y-centerY,zd=Math.sqrt(zdx*zdx+zdy*zdy);
      if(zd>(worldSize/2)-zone.baseRadius){
        const a=Math.atan2(zdy,zdx);
        zone.x=centerX+Math.cos(a)*((worldSize/2)-zone.baseRadius);
        zone.y=centerY+Math.sin(a)*((worldSize/2)-zone.baseRadius);
        zone.vx*=-1; zone.vy*=-1;
      }
      zone.pulse+=zone.pulseSpeed;
      const cr=zone.baseRadius+Math.sin(zone.pulse)*40;
      const pdx=player.x-zone.x,pdy=player.y-zone.y;
      if(Math.sqrt(pdx*pdx+pdy*pdy)<cr){
        player.mass-=player.mass*0.002; if(player.mass<5) player.mass=5;
        player.radius=Math.max(10,8+Math.pow(player.mass,0.32)*1.67);
      }
      bots.forEach(bot=>{
        if(!bot.alive) return;
        const bdx=bot.x-zone.x,bdy=bot.y-zone.y;
        if(Math.sqrt(bdx*bdx+bdy*bdy)<cr){
          bot.mass-=bot.mass*0.002; if(bot.mass<10) bot.mass=10;
          bot.radius=Math.max(8,8+Math.pow(bot.mass,0.32)*1.5);
        }
      });
    });

    // Black holes
    blackHoles.forEach(bh=>{
      if(bh.particles.length<60){
        bh.particles.push({angle:Math.random()*Math.PI*2,distance:bh.pullRadius,
          speed:1+Math.random()*2,size:1.5+Math.random()*2,trail:[]});
      }
      bh.particles.forEach((p:any)=>{
        p.angle+=0.05*timeScale; p.distance-=p.speed*timeScale;
        const px=bh.x+Math.cos(p.angle)*p.distance, py=bh.y+Math.sin(p.angle)*p.distance;
        p.trail.push({x:px,y:py}); if(p.trail.length>6) p.trail.shift();
        if(p.distance<10){p.distance=bh.pullRadius;p.trail=[];}
      });
      if(!bh.rings) bh.rings=[];
      if(bh.rings.length<5) bh.rings.push({radius:bh.pullRadius,speed:2+Math.random()*2});
      bh.rings.forEach((ring:any)=>{
        ring.radius-=ring.speed*timeScale;
        if(ring.radius<bh.radius) ring.radius=bh.pullRadius;
      });
      const dpx=bh.x-player.x,dpy=bh.y-player.y,dpd=Math.sqrt(dpx*dpx+dpy*dpy);
      if(dpd<bh.pullRadius){
        const force=Math.pow((bh.pullRadius-dpd)/bh.pullRadius,2);
        player.x+=dpx*force*0.015*timeScale; player.y+=dpy*force*0.015*timeScale;
        if(move.active){
          player.x+=move.x*force*1.8; player.y+=move.y*force*1.8;
        }
        if(dpd<bh.radius){
          player.mass-=player.mass*0.003;
          player.radius=Math.max(10,8+Math.pow(player.mass,0.32)*1.67);
          if(player.mass<=5) triggerGameOver();
        }
      }
      bots.forEach(bot=>{
        if(!bot.alive) return;
        const bdx=bh.x-bot.x,bdy=bh.y-bot.y,bd=Math.sqrt(bdx*bdx+bdy*bdy);
        if(bd<bh.pullRadius){
          const f=(bh.pullRadius-bd)/bh.pullRadius;
          bot.x+=bdx*f*0.02*timeScale; bot.y+=bdy*f*0.02*timeScale;
          if(bd<bh.radius){
            bot.mass-=bot.mass*0.04;
            bot.radius=Math.max(8,8+Math.pow(bot.mass,0.32)*1.5);
            bot.speed*=0.97;
            if(bot.mass<=8){
              bot.alive=false;
              if(e.mode!=='survival') setTimeout(()=>respawnBot(bot),3000);
            }
          }
        }
      });
      for(let i=objects.length-1;i>=0;i--){
        const o=objects[i];
        const odx=bh.x-o.x,ody=bh.y-o.y,od=Math.sqrt(odx*odx+ody*ody);
        if(od<bh.pullRadius){const f=(bh.pullRadius-od)/bh.pullRadius;o.x+=odx*f*0.05;o.y+=ody*f*0.05;}
        if(od<bh.radius){objects.splice(i,1);spawnObject();}
      }
    });

    // World boundary
    const dcx=player.x-centerX, dcy=player.y-centerY;
    const dcDist=Math.sqrt(dcx*dcx+dcy*dcy);
    const maxRadius=worldSize/2-player.radius;
    if(dcDist>maxRadius){
      const a=Math.atan2(dcy,dcx);
      player.x=centerX+Math.cos(a)*maxRadius;
      player.y=centerY+Math.sin(a)*maxRadius;
      player.instability+=1.4;
    }

    // Leaderboard update
    e.lbTimer+=1;
    if(e.lbTimer>30){
      e.lbTimer=0;
      const all=[{name:'You',mass:player.mass,score:e.score,isPlayer:true},
        ...bots.filter(b=>b.alive).map(b=>({name:b.name,mass:b.mass,score:b.score||0,isPlayer:false}))];
      const getSortVal=(x:any)=>{
        if(e.mode==='infinity') return (x.mass+x.score)/2;
        if(e.mode==='time')     return x.mass;
        return x.score;
      };
      const sorted=all.sort((a,b)=>getSortVal(b)-getSortVal(a));
      e.topLeader=sorted[0]?.name;
      setLeaderboard(sorted.slice(0,10));
    }

    // Bot AI
    const isPlayerIdle=(Date.now()-e.lastInputTime)>2000;
    bots.forEach(bot=>{
      if(!bot.alive) return;
      const calcBotSpeed=(mass:number)=>mass<=10000?3.5:Math.max(2.7,3.5-Math.log10(mass/10000)*0.3);
      const botBaseSpeed=calcBotSpeed(bot.mass);
      const detRange=bot.radius*8;
      const dpx=player.x-bot.x, dpy=player.y-bot.y;
      const dpDist=Math.sqrt(dpx*dpx+dpy*dpy);

      bot.stateTimer=(bot.stateTimer||0)-delta;
      if(bot.stateTimer<=0){
        const states=['farm','huntPlayer','huntBot'];
        bot.state=states[Math.floor(Math.random()*states.length)];
        bot.stateTimer=5000+Math.random()*5000;
      }

      let isEscaping=false;
      const detRangeSq=detRange*detRange;
      let nearestDanger=null, minThreatSq=detRangeSq, threatDx=0, threatDy=0;
      const pdxD=player.x-bot.x, pdyD=player.y-bot.y, pDistSq=pdxD*pdxD+pdyD*pdyD;
      if(pDistSq<minThreatSq&&player.radius>bot.radius&&player.spawnShield<=0){
        minThreatSq=pDistSq;nearestDanger=player;threatDx=pdxD;threatDy=pdyD;
      }
      bots.forEach(other=>{
        if(other===bot||!other.alive||other.radius<=bot.radius) return;
        const bdx=other.x-bot.x,bdy=other.y-bot.y,bds=bdx*bdx+bdy*bdy;
        if(bds<minThreatSq){minThreatSq=bds;nearestDanger=other;threatDx=bdx;threatDy=bdy;}
      });
      if(nearestDanger){
        bot.fearTimer=(bot.fearTimer||0)+delta;
        if(bot.fearTimer>200){
          if(!bot.escapeLockTimer||bot.escapeLockTimer<=0) bot.escapeLockTimer=1500;
          bot.escapeDx=threatDx; bot.escapeDy=threatDy;
        }
      } else { bot.fearTimer=0; }
      if(bot.escapeLockTimer>0){
        bot.escapeLockTimer-=delta; isEscaping=true;
        bot.targetX=bot.x-bot.escapeDx; bot.targetY=bot.y-bot.escapeDy;
        bot.speed=botBaseSpeed+0.6;
      }
      if(!isEscaping){
        if(isPlayerIdle&&player.spawnShield<=0){bot.targetX=player.x;bot.targetY=player.y;bot.speed=botBaseSpeed+1.5;}
        else if(bot.state==='huntPlayer'&&dpDist<detRange&&bot.radius>player.radius&&player.spawnShield<=0){
          bot.targetX=player.x;bot.targetY=player.y;bot.speed=botBaseSpeed+0.1;
        } else if(bot.state==='huntBot'){
          let nearest=null,minD=Infinity;
          bots.forEach(o=>{
            if(o===bot||!o.alive||bot.radius<=o.radius) return;
            const d=(o.x-bot.x)**2+(o.y-bot.y)**2;
            if(d<minD){minD=d;nearest=o;}
          });
          if(nearest){bot.targetX=(nearest as any).x;bot.targetY=(nearest as any).y;bot.speed=botBaseSpeed+0.1;}
          else bot.state='farm';
        }
        if(bot.state==='farm'||(bot.state==='huntPlayer'&&(dpDist>=detRange||bot.radius<=player.radius))){
          let nearestFood=null,minFoodD=Infinity,nearestCoin=null,coinD=Infinity;
          coins.forEach(c=>{
            const d=(c.x-bot.x)**2+(c.y-bot.y)**2;
            if(d<coinD){coinD=d;nearestCoin=c;}
          });
          if(nearestCoin&&coinD<detRangeSq){bot.targetX=(nearestCoin as any).x;bot.targetY=(nearestCoin as any).y;bot.speed=botBaseSpeed;}
          else {
            for(const o of objects){const d=(o.x-bot.x)**2+(o.y-bot.y)**2;if(d<minFoodD){minFoodD=d;nearestFood=o;}}
            if(nearestFood){bot.targetX=(nearestFood as any).x;bot.targetY=(nearestFood as any).y;bot.speed=botBaseSpeed;}
          }
        }
      }
      const mdx=bot.targetX-bot.x,mdy=bot.targetY-bot.y,md=Math.sqrt(mdx*mdx+mdy*mdy);
      if(md>2){bot.x+=mdx/md*bot.speed*timeScale;bot.y+=mdy/md*bot.speed*timeScale;}
      const bdx=bot.x-centerX,bdy=bot.y-centerY,bd=Math.sqrt(bdx*bdx+bdy*bdy);
      const maxBotR=worldSize/2-bot.radius;
      if(bd>maxBotR-200){bot.targetX=centerX;bot.targetY=centerY;bot.speed=botBaseSpeed+1.0;}

      // Bot mass instability
      bot.instabilityThreshold=bot.instabilityThreshold||(100000+Math.random()*400000);
      if(bot.mass>100000){
        const ov=bot.mass-100000, gr=0.02+(ov/bot.instabilityThreshold)*0.08;
        bot.massInstability=(bot.massInstability||0)+gr;
      } else { bot.massInstability=Math.max(0,(bot.massInstability||0)-0.05); }
      if((bot.massInstability||0)>=100&&bot.alive){
        bot.alive=false;
        const foodMass=bot.mass*0.4, foodCount=Math.min(20,Math.max(5,Math.floor(foodMass/50)));
        const mPerF=foodMass/foodCount;
        for(let f=0;f<foodCount;f++){
          const a=Math.random()*Math.PI*2, d=Math.random()*bot.radius*3;
          const pair=NEON[Math.floor(Math.random()*NEON.length)];
          const r=Math.min(45,Math.max(8,Math.pow(mPerF,0.32)*1.67));
          objects.push({
            x:bot.x+Math.cos(a)*d,y:bot.y+Math.sin(a)*d,radius:r,mass:mPerF,
            color1:'#FFD700',color2:'#FFA500',type:'food',category:'rare',
            vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,
            pulse:Math.random()*Math.PI,rotation:Math.random()*Math.PI*2,
            rotationSpeed:(Math.random()>0.5?1:-1)*(0.01+Math.random()*0.08),
            rare:true,deathFood:true,expireAt:Date.now()+50000,
          });
        }
        const id=Date.now()+Math.random();
        setDeathFeed(prev=>[{id,text:`${bot.name} collapsed from instability!`},...prev.slice(0,4)]);
        setTimeout(()=>setDeathFeed(prev=>prev.filter(f=>f.id!==id)),2000);
        if(e.mode!=='survival') setTimeout(()=>respawnBot(bot),3000);
      }
      bot.instability=bot.instability||0;
      if(bd>maxBotR){
        const a=Math.atan2(bdy,bdx);
        bot.x=centerX+Math.cos(a)*maxBotR; bot.y=centerY+Math.sin(a)*maxBotR;
        bot.instability+=1.12;
      } else { bot.instability=Math.max(0,bot.instability-0.5); }
      if(bot.instability>=100&&bot.alive){
        bot.alive=false;
        if(e.mode!=='survival') setTimeout(()=>respawnBot(bot),3000);
      }
      // Bot vs bot eating
      bots.forEach(other=>{
        if(other===bot||!other.alive) return;
        const odx=bot.x-other.x,ody=bot.y-other.y;
        if(Math.sqrt(odx*odx+ody*ody)<bot.radius+other.radius*0.8){
          if(bot.radius>other.radius){
            bot.score=(bot.score||0)+Math.floor(other.mass);
            bot.mass+=other.mass;
            bot.radius=Math.max(8,8+Math.pow(bot.mass,0.32)*1.5);
            other.alive=false;
            if(e.mode!=='survival') setTimeout(()=>respawnBot(other),3000);
          }
        }
      });
    });

    // Object updates
    for(let i=objects.length-1;i>=0;i--){
      const o=objects[i];
      if(o.deathFood&&o.expireAt&&Date.now()>o.expireAt){objects.splice(i,1);continue;}
      o.x+=o.vx*timeScale; o.y+=o.vy*timeScale; o.pulse+=0.05; o.rotation+=o.rotationSpeed;
      let eatenByBot=false;
      bots.forEach(bot=>{
        if(!bot.alive||eatenByBot) return;
        const bdx=bot.x-o.x,bdy=bot.y-o.y;
        if(Math.sqrt(bdx*bdx+bdy*bdy)<bot.radius+o.radius*0.5){
          let smul=o.deathFood?5:o.rare?3:2, mfrac=o.deathFood?3.0:o.rare?2.0:1.5;
          bot.mass+=o.mass*mfrac; bot.radius=Math.max(8,8+Math.pow(bot.mass,0.32)*1.5);
          bot.score=(bot.score||0)+Math.floor(o.mass*mfrac*smul);
          objects.splice(i,1); spawnObjectNear(bot.x,bot.y); eatenByBot=true;
        }
      });
      if(eatenByBot) continue;
      const odx=player.x-o.x,ody=player.y-o.y,odist=Math.sqrt(odx*odx+ody*ody);
      if(odist>0&&odist<player.radius*4&&e.magnetTimer<=0){
        const pull=(player.radius*4-odist)/(player.radius*4);
        o.x+=odx/odist*pull*4; o.y+=ody/odist*pull*4;
      }
      if(odist<player.radius+o.radius*0.5){
        let gm=player.mass<15?2:player.mass<30?1.5:1;
        let smul=o.deathFood?5:o.rare?3:2;
        let mfrac=o.deathFood?3.0:o.rare?2.0:1.5;
        player.mass+=o.mass*gm*mfrac;
        player.radius=Math.max(10,8+Math.pow(player.mass,0.32)*1.67);
        let finalScore=o.mass*gm*smul;
        if(e.doubleScoreTimer>0) finalScore*=2;
        objects.splice(i,1); e.score+=Math.floor(finalScore); setScore(e.score);
        spawnObjectNear(player.x,player.y);
      }
    }

    // Coin collection
    for(let i=coins.length-1;i>=0;i--){
      const c=coins[i];
      const dx=player.x-c.x,dy=player.y-c.y;
      if(Math.sqrt(dx*dx+dy*dy)<player.radius+c.radius){
        let v=c.value; if(e.doubleScoreTimer>0) v*=2;
        e.coinsCollected+=v; setCoinsCollected(cv=>cv+v); coins.splice(i,1);
      }
    }
    bots.forEach(bot=>{
      if(!bot.alive) return;
      for(let i=coins.length-1;i>=0;i--){
        const c=coins[i];
        if(Math.sqrt((bot.x-c.x)**2+(bot.y-c.y)**2)<bot.radius+c.radius){
          bot.mass+=2; bot.radius=Math.max(8,8+Math.pow(bot.mass,0.32)*1.5); coins.splice(i,1);
        }
      }
    });

    // Player vs bots
    bots.forEach(bot=>{
      if(!bot.alive) return;
      const dx=player.x-bot.x,dy=player.y-bot.y;
      if(Math.sqrt(dx*dx+dy*dy)<player.radius+bot.radius*0.8){
        if(player.spawnShield>0) return;
        if(player.radius>bot.radius){
          e.botKills++;
          player.mass+=bot.mass;
          player.radius=Math.max(10,8+Math.pow(player.mass,0.32)*1.67);
          let fs=bot.mass; if(e.doubleScoreTimer>0) fs*=2;
          e.score+=Math.floor(fs); setScore(e.score);
          bot.alive=false;
          if(e.mode!=='survival') setTimeout(()=>respawnBot(bot),3000);
          else {
            const id=Date.now()+Math.random();
            setDeathFeed(prev=>[{id,text:`You eliminated ${bot.name}`},...prev.slice(0,4)]);
            setTimeout(()=>setDeathFeed(prev=>prev.filter(f=>f.id!==id)),2000);
          }
        } else if(bot.radius>player.radius){ triggerGameOver(); }
      }
    });

    // Survival mode
    if(e.mode==='survival'){
      const s=e.survival;
      if(s.phase==='preview'){s.timer--;if(s.timer<=0)s.phase='shrinking';}
      if(s.phase==='shrinking'){
        if(s.currentRadius<800)  s.shrinkSpeed=1.2;
        if(s.currentRadius<400)  s.shrinkSpeed=2.5;
        if(s.currentRadius>s.targetRadius){
          s.currentRadius-=s.shrinkSpeed;
          s.centerX+=(s.nextCenterX-s.centerX)*0.01;
          s.centerY+=(s.nextCenterY-s.centerY)*0.01;
        } else {
          s.currentRadius=s.targetRadius; s.centerX=s.nextCenterX; s.centerY=s.nextCenterY;
          if(s.currentRadius>250) generateNextZone();
          else {s.targetRadius=120;s.shrinkSpeed=2.5;s.phase='shrinking';}
        }
      }
      const dx=player.x-s.centerX,dy=player.y-s.centerY;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist>s.currentRadius){
        player.mass-=Math.max(0.15,(dist-s.currentRadius)*0.004);
        player.radius=Math.max(10,8+Math.pow(player.mass,0.32)*1.67);
        if(player.mass<=3){triggerGameOver();return;}
      }
      bots.forEach(bot=>{
        if(!bot.alive) return;
        const bdx=bot.x-s.centerX,bdy=bot.y-s.centerY;
        const bd=Math.sqrt(bdx*bdx+bdy*bdy);
        if(bd>s.currentRadius){
          bot.targetX=s.centerX;bot.targetY=s.centerY;bot.speed=4.5;
          bot.mass-=Math.max(0.1,(bd-s.currentRadius)*0.003);
          bot.radius=Math.max(8,8+Math.pow(bot.mass,0.32)*1.5);
          if(bot.mass<=8){
            bot.alive=false;
            const id=Date.now()+Math.random();
            setDeathFeed(prev=>[{id,text:`${bot.name} eliminated`},...prev.slice(0,4)]);
            setTimeout(()=>setDeathFeed(prev=>prev.filter(f=>f.id!==id)),2000);
          }
        }
      });
      e.objects=objects.filter(o=>{
        const dx=o.x-s.centerX,dy=o.y-s.centerY;
        return Math.sqrt(dx*dx+dy*dy)<=s.currentRadius+50;
      });
      if(e.objects.length<400){
        const sa=s.currentRadius<600?20:s.currentRadius<1000?10:5;
        for(let i=0;i<sa;i++) spawnObjectInZone();
      }
      const alive=bots.filter(b=>b.alive).length+(e.isDead?0:1);
      setAliveCount(alive);
      if(bots.filter(b=>b.alive).length===0&&!e.isDead) triggerGameOver(true);
    }

    // Instability growth
    let ig=e.mode==='survival'?0.7:e.mode==='time'?0.3:0.4, ir=0.12;
    if(e.instabilityFreezeTimer>0){/* frozen */}
    else if(player.mass>50000){
      const ov=player.mass-50000;
      player.instability+=(0.01+(ov/500000)*ig)*e.instabilitySlowMult;
    } else {
      player.instability=Math.max(0,player.instability-ir);
    }
    setRocketTimer2(Math.ceil(e.rocketTimer/60));
    if(player.instability>=100) triggerGameOver();

    // Magnet wave update
    for(let i=e.magnetWaves.length-1;i>=0;i--){
      const w=e.magnetWaves[i]; w.radius+=12; w.alpha-=0.01;
      if(w.radius>w.maxRadius||w.alpha<=0) e.magnetWaves.splice(i,1);
    }

    // Object spawn top-up (non-survival)
    if(e.mode!=='survival'){
      if(e.gameTick%30===0){
        const vw=(e.width/e.zoom)/2+60, vh=(e.height/e.zoom)/2+60;
        e.visibleObjCount=objects.filter(o=>Math.abs(o.x-player.x)<vw&&Math.abs(o.y-player.y)<vh).length;
      }
      if(e.visibleObjCount<25){
        const need=Math.min(25-e.visibleObjCount,4);
        for(let i=0;i<need;i++){spawnObjectClose(player.x,player.y);e.visibleObjCount++;}
      } else if(objects.length<1100){
        for(let i=0;i<5;i++){
          if(Math.random()<0.8) spawnObjectGlobal();
          else {
            const alive=bots.filter(b=>b.alive);
            if(alive.length>0){const rb=alive[Math.floor(Math.random()*alive.length)];spawnObjectNear(rb.x,rb.y);}
            else spawnObjectGlobal();
          }
        }
      }
    }

    e.targetZoom=Math.min(1.2,Math.max(0.15,55/player.radius));
    e.zoom+=(e.targetZoom-e.zoom)*0.05;
    e.swirlAngle+=0.05;

    setMass(Math.floor(player.mass));
    setInstability(player.instability);
  }, [
    gameState, spawnObject, spawnObjectNear, spawnObjectClose, spawnObjectGlobal,
    spawnObjectInZone, spawnPowerup, spawnCoin, addCoins, setXp, user,
  ]);

  // ─── Game loop ────────────────────────────────────────────────────────────

  const gameLoop = useCallback(() => {
    updateEngine();
    setFrameTick(n => n + 1);
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [updateEngine]);

  useEffect(() => {
    initGame(resolvedMode);
  }, []);

  useEffect(() => {
    if (gameState === 'playing') {
      rafRef.current = requestAnimationFrame(gameLoop);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gameState, gameLoop]);

  useEffect(() => {
    if (gameState !== 'gameover') return;
    const timer = setInterval(() => {
      setReviveTimer(t => { if (t <= 0) { clearInterval(timer); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleRocketClick = () => {
    const e = eng.current;
    if (e.rocketCooldown > 0 || e.rocketActive || e.player.mass < 20000) return;
    e.rocketActive = true; e.rocketTimer = 720; e.rocketCooldown = 2700;
    e.speedTimer = 720; e.doubleScoreTimer = 480;
    setRocketActive(true);
    const nc = e.rocketClickCount + 1; e.rocketClickCount = nc;
    if (nc >= 4) {
      e.player.instability = 0; e.instabilityFreezeTimer = 9000;
      e.instabilitySlowMult = 1; e.rocketClickCount = 0;
      setInstability(0); setRocketClickCount(0);
    } else {
      e.instabilitySlowMult = Math.max(0.25, 1 - nc * 0.25);
      setRocketClickCount(nc);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const useShopPower = (type: 'magnet' | 'speed' | 'double') => {
    const e = eng.current;
    const timerProp = type === 'double' ? 'doubleScoreTimer' : `${type}Timer` as any;
    if (e[timerProp] > 0 || e.inventory[type] <= 0) return;
    e.inventory[type] -= 1;
    if (type === 'magnet') e.magnetTimer = 600;
    if (type === 'speed')  e.speedTimer = 400;
    if (type === 'double') e.doubleScoreTimer = 600;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFrameTick(n => n + 1);
  };

  const revivePlayer = () => {
    if (revived) return;
    const p = eng.current.player;
    p.mass = p.mass / 2; p.radius = Math.max(10, 8 + Math.pow(p.mass, 0.32) * 1.67);
    p.spawnShield = 300; eng.current.isDead = false;
    setRevived(true); setGameState('playing');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ─── Skia Rendering ───────────────────────────────────────────────────────
  // Snapshot engine state for this frame
  const e       = eng.current;
  const player  = e.player;
  const zoom    = e.zoom;
  // world → screen coordinate helpers
  const sx = (wx: number) => (wx - player.x) * zoom + W / 2;
  const sy = (wy: number) => (wy - player.y) * zoom + H / 2;
  const sr = (r: number)  => r * zoom;

  const worldSize   = e.worldSize;
  const worldSX     = sx(worldSize / 2);
  const worldSY     = sy(worldSize / 2);
  const worldSR     = sr(worldSize / 2);

  // Background colors by theme (dynamic — passed from home screen)
  const bgColors: [string, string] = THEME_BG_COLORS[resolvedTheme] ?? ['#2a0f4f', '#050015'];

  // Orbit rings (background decoration)
  const time        = performance.now() * 0.0005;
  const orbitSpacing = 800;
  const orbitRings: React.ReactElement[] = [];
  const oStartX = Math.floor((player.x - W / zoom) / orbitSpacing) * orbitSpacing;
  const oStartY = Math.floor((player.y - H / zoom) / orbitSpacing) * orbitSpacing;
  for (let ox = oStartX - orbitSpacing; ox < player.x + W / zoom + orbitSpacing; ox += orbitSpacing) {
    for (let oy = oStartY - orbitSpacing; oy < player.y + H / zoom + orbitSpacing; oy += orbitSpacing) {
      const id = Math.abs(Math.round(ox * 13 + oy * 7));
      const sizeMod = ((id % 300) + 250) * zoom;
      const rotAngle = time * ((id % 10) / 10 - 0.5) * 0.4;
      const oPath = Skia.Path.Make();
      oPath.addCircle(sx(ox), sy(oy), sizeMod);
      orbitRings.push(
        <Group key={`orb-${ox}-${oy}`} origin={vec(sx(ox), sy(oy))} transform={[{ rotate: rotAngle }]}>
          <Path path={oPath}>
            <Paint style="stroke" strokeWidth={1.5} color="rgba(255,255,255,0.14)" />
          </Path>
        </Group>
      );
    }
  }

  // Stars
  const starElements: React.ReactElement[] = [];
  const viewW = W / zoom + 200, viewH = H / zoom + 200;
  e.stars.forEach((star: any, i: number) => {
    if (Math.abs(star.x - player.x) > viewW || Math.abs(star.y - player.y) > viewH) return;
    const twinkle   = Math.sin(time * (3 + (i % 4)) + star.x);
    const currAlpha = star.alpha * (0.2 + ((twinkle + 1) / 2) * 0.8);
    starElements.push(
      <Circle key={`star-${i}`} cx={sx(star.x)} cy={sy(star.y)} r={Math.max(0.5, star.size * zoom)}
        color={`rgba(255,255,255,${currAlpha.toFixed(2)})`} />
    );
  });

  // World border overlay (darken outside world circle)
  const overlayPath = Skia.Path.Make();
  overlayPath.addRect({ x: 0, y: 0, width: W, height: H });
  overlayPath.addCircle(worldSX, worldSY, worldSR);
  overlayPath.setFillType(FillType.EvenOdd);
  const borderPath = Skia.Path.Make();
  borderPath.addCircle(worldSX, worldSY, worldSR);

  // Survival zone overlay
  let survivalOverlay: ReturnType<typeof Skia.Path.Make> | null = null;
  let survivalBorderPath: ReturnType<typeof Skia.Path.Make> | null = null;
  let survivalNextPath: ReturnType<typeof Skia.Path.Make> | null = null;
  if (e.mode === 'survival' && e.survival.active) {
    const s = e.survival;
    survivalOverlay = Skia.Path.Make();
    survivalOverlay.addRect({ x: 0, y: 0, width: W, height: H });
    survivalOverlay.addCircle(sx(s.centerX), sy(s.centerY), sr(s.currentRadius));
    survivalOverlay.setFillType(FillType.EvenOdd);
    survivalBorderPath = Skia.Path.Make();
    survivalBorderPath.addCircle(sx(s.centerX), sy(s.centerY), sr(s.currentRadius));
    if (s.phase === 'preview') {
      survivalNextPath = Skia.Path.Make();
      survivalNextPath.addCircle(sx(s.nextCenterX), sy(s.nextCenterY), sr(s.targetRadius));
    }
  }

  // Danger zone paths
  const dangerZoneElements: React.ReactElement[] = e.dangerZones.map((zone: any, i: number) => {
    const cr = zone.baseRadius + Math.sin(zone.pulse) * 40;
    const intensity = (Math.sin(zone.pulse) + 1) / 2;
    const p = Skia.Path.Make(); p.addCircle(sx(zone.x), sy(zone.y), sr(cr));
    return (
      <Group key={`dz-${i}`}>
        <Path path={p} color={`rgba(255,0,0,${(0.1 + intensity * 0.2).toFixed(2)})`} />
        <Path path={p}><Paint style="stroke" strokeWidth={3} color={`rgba(255,0,0,${(0.3+intensity*0.4).toFixed(2)})`} /></Path>
      </Group>
    );
  });

  // Black hole rendering
  const blackHoleElements: React.ReactElement[] = e.blackHoles.map((bh: any, i: number) => {
    const bhx = sx(bh.x), bhy = sy(bh.y), bhr = sr(bh.radius), bhpr = sr(bh.pullRadius);
    const ringElems = (bh.rings || []).map((ring: any, ri: number) => {
      const rp = Skia.Path.Make(); rp.addCircle(bhx, bhy, sr(ring.radius));
      return (
        <Path key={`bhr-${ri}`} path={rp}>
          <Paint style="stroke" strokeWidth={2} color={`rgba(99,102,241,${(ring.radius/bh.pullRadius*0.4).toFixed(2)})`} />
        </Path>
      );
    });
    // Particle trails
    const particleElems = (bh.particles || []).flatMap((p: any, pi: number) =>
      p.trail.map((t: any, ti: number) => {
        const alpha = ti / p.trail.length;
        return <Circle key={`bhp-${pi}-${ti}`} cx={sx(t.x)} cy={sy(t.y)}
          r={Math.max(0.5, p.size * alpha * zoom)} color={`rgba(168,85,247,${alpha.toFixed(2)})`} />;
      })
    );
    const bhCenter = Skia.Path.Make(); bhCenter.addCircle(bhx, bhy, bhr);
    return (
      <Group key={`bh-${i}`}>
        {ringElems}
        {particleElems}
        <Path path={bhCenter}>
          <RadialGradient c={vec(bhx, bhy)} r={bhr} colors={['#000000','#050505','#1e1b4b']} positions={[0,0.5,1]} />
        </Path>
        <Circle cx={bhx} cy={bhy} r={bhpr * 0.15} color="transparent">
          <Shadow dx={0} dy={0} blur={40} color="#a855f7" />
        </Circle>
      </Group>
    );
  });

  // Magnet waves
  const magnetWaveElements: React.ReactElement[] = e.magnetWaves.map((wave: any, i: number) => {
    const wp = Skia.Path.Make(); wp.addCircle(sx(wave.x), sy(wave.y), sr(wave.radius));
    return (
      <Path key={`mw-${i}`} path={wp}>
        <Paint style="stroke" strokeWidth={4} color={`rgba(236,72,153,${wave.alpha.toFixed(2)})`}>
          <Shadow dx={0} dy={0} blur={20} color="#ec4899" />
        </Paint>
      </Path>
    );
  });

  // Food / objects
  const foodElements: React.ReactElement[] = [];
  e.objects.forEach((obj: any, i: number) => {
    if (Math.abs(obj.x - player.x) > viewW || Math.abs(obj.y - player.y) > viewH) return;
    const oscx = sx(obj.x), oscy = sy(obj.y);
    const r    = sr(obj.radius + Math.sin(obj.pulse) * 1.5);
    if (r < 0.5) return;
    const elems: React.ReactElement[] = [];
    // Base gradient (planet)
    const basePath = Skia.Path.Make(); basePath.addCircle(oscx, oscy, r);
    elems.push(
      <Path key="base" path={basePath}>
        <RadialGradient
          c={vec(oscx - r * 0.3, oscy - r * 0.35)} r={r}
          colors={[obj.color1, obj.color2, '#000000']} positions={[0, 0.5, 1]}
        />
      </Path>
    );
    // Shine
    const shinePath = Skia.Path.Make(); shinePath.addCircle(oscx, oscy, r);
    elems.push(
      <Path key="shine" path={shinePath} opacity={0.45}>
        <RadialGradient
          c={vec(oscx - r * 0.35, oscy - r * 0.38)} r={r * 0.55}
          colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
        />
      </Path>
    );
    // Ring for rare
    if (obj.rare) {
      const ringPath = Skia.Path.Make(); ringPath.addCircle(oscx, oscy, r * 1.7);
      elems.push(
        <Group key="ring" origin={vec(oscx, oscy)} transform={[{ rotate: obj.rotation * 0.5 }, { scaleY: 0.35 }]}>
          <Path path={ringPath} opacity={0.6}>
            <Paint style="stroke" strokeWidth={r * 0.18} color={obj.color1} />
          </Path>
        </Group>
      );
    }
    // Death food pulsing ring
    if (obj.deathFood) {
      const dfr = r + sr(4 + Math.sin(obj.pulse * 4) * 3);
      const dfPath = Skia.Path.Make(); dfPath.addCircle(oscx, oscy, dfr);
      elems.push(
        <Path key="df" path={dfPath}>
          <Paint style="stroke" strokeWidth={2}
            color={`rgba(255,215,0,${(0.4 + Math.sin(obj.pulse * 4) * 0.3).toFixed(2)})`} />
        </Path>
      );
    }
    foodElements.push(<Group key={`food-${i}`}>{elems}</Group>);
  });

  // Coins
  const coinElements: React.ReactElement[] = e.coins.map((coin: any, i: number) => {
    if (Math.abs(coin.x - player.x) > viewW || Math.abs(coin.y - player.y) > viewH) return null!;
    const cr = sr(coin.radius + Math.sin(coin.pulse) * 1.5);
    const ccx = sx(coin.x), ccy = sy(coin.y);
    return (
      <Group key={`coin-${i}`}>
        <Circle cx={ccx} cy={ccy} r={cr} color="#facc15">
          <Shadow dx={0} dy={0} blur={12} color="#facc15" />
        </Circle>
        {font && <SkiaText x={ccx - 4} y={ccy + 4} text="C" font={font} color="#000" />}
      </Group>
    );
  }).filter(Boolean);

  // Powerups
  const powerupElements: React.ReactElement[] = e.powerups.map((p: any, i: number) => {
    if (Math.abs(p.x - player.x) > viewW || Math.abs(p.y - player.y) > viewH) return null!;
    const r = sr(p.radius + Math.sin(p.pulse) * 2);
    const px2 = sx(p.x), py2 = sy(p.y);
    const color = p.type==='magnet'?'#ec4899':p.type==='speed'?'#06b6d4':'#f97316';
    const innerPath = Skia.Path.Make(); innerPath.addCircle(px2, py2, r * 0.7);
    return (
      <Group key={`pu-${i}`}>
        <Circle cx={px2} cy={py2} r={r} color={color} opacity={0.3}>
          <Shadow dx={0} dy={0} blur={15} color={color} />
        </Circle>
        <Path path={innerPath}>
          <RadialGradient c={vec(px2, py2)} r={r * 0.7} colors={['#000000', color]} />
        </Path>
      </Group>
    );
  }).filter(Boolean);

  // Bots
  const botElements: React.ReactElement[] = e.bots.filter((b: any) => b.alive).map((bot: any, i: number) => {
    if (Math.abs(bot.x - player.x) > viewW + 200 || Math.abs(bot.y - player.y) > viewH + 200) return null!;
    const bcx = sx(bot.x), bcy = sy(bot.y), br = sr(bot.radius);
    if (br < 1) return null!;
    const isLeader = e.topLeader === bot.name;
    const color = bot.color || '#ff00ff';
    // Rotating arc path
    const arcPath = Skia.Path.Make();
    arcPath.addArc({ x: bcx - br + 6, y: bcy - br + 6, width: (br - 6) * 2, height: (br - 6) * 2 }, 0, 288);
    const botBodyPath = Skia.Path.Make(); botBodyPath.addCircle(bcx, bcy, br);
    const botBorderPath = Skia.Path.Make(); botBorderPath.addCircle(bcx, bcy, br);
    return (
      <Group key={`bot-${i}`}>
        {/* Body gradient */}
        <Path path={botBodyPath}>
          <RadialGradient c={vec(bcx, bcy)} r={br} colors={['#000000','#050505', color]} positions={[0,0.6,1]} />
        </Path>
        {/* Rotating inner arc */}
        <Group origin={vec(bcx, bcy)} transform={[{ rotate: time }]}>
          <Path path={arcPath}>
            <Paint style="stroke" strokeWidth={2} color="rgba(255,255,255,0.09)" />
          </Path>
        </Group>
        {/* Border with glow */}
        <Path path={botBorderPath}>
          <Paint style="stroke" strokeWidth={isLeader ? 5 : 3} color={isLeader ? '#facc15' : color}>
            {isLeader && <Shadow dx={0} dy={0} blur={20} color="#facc15" />}
          </Paint>
        </Path>
        {/* Name tag */}
        {font && br > 10 && (
          <SkiaText x={bcx - 20} y={bcy - br - 6} text={bot.name?.slice(0,12)||''} font={fontSm || font}
            color={isLeader ? '#facc15' : 'rgba(255,255,255,0.75)'} />
        )}
      </Group>
    );
  }).filter(Boolean);

  // Player
  const psr      = sr(player.radius);
  const pcx      = W / 2, pcy = H / 2;
  const isPlayerLeader = e.topLeader === 'You';
  const playerPulseR = Math.max(0.5, psr - sr(8) + Math.sin(performance.now() * 0.004) * sr(5));
  const dirAngle = player.directionAngle;
  const arrowDist  = psr + sr(25);
  const arrowX     = pcx + Math.cos(dirAngle) * arrowDist;
  const arrowY     = pcy + Math.sin(dirAngle) * arrowDist;
  const arrowPath  = Skia.Path.Make();
  arrowPath.moveTo(10 * zoom, 0); arrowPath.lineTo(-6 * zoom, -6 * zoom); arrowPath.lineTo(-6 * zoom, 6 * zoom); arrowPath.close();
  const playerBodyPath = Skia.Path.Make(); playerBodyPath.addCircle(pcx, pcy, psr);
  const playerArcPath  = Skia.Path.Make();
  playerArcPath.addArc({ x: pcx - psr + 6, y: pcy - psr + 6, width: (psr - 6) * 2, height: (psr - 6) * 2 }, 0, 288);
  const playerOuterPath = Skia.Path.Make(); playerOuterPath.addCircle(pcx, pcy, psr + sr(25));
  const playerPulsePath = Skia.Path.Make(); playerPulsePath.addCircle(pcx, pcy, Math.max(0.5, playerPulseR));
  const playerBorderPath = Skia.Path.Make(); playerBorderPath.addCircle(pcx, pcy, psr);

  // ─── Return ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* ═══ Skia Canvas ═══ */}
      <Canvas style={styles.canvas}>
        {/* Background */}
        <Rect x={0} y={0} width={W} height={H}>
          <RadialGradient c={vec(W/2, H/2)} r={W} colors={bgColors} />
        </Rect>

        {/* Orbit rings */}
        {orbitRings}

        {/* Stars */}
        {starElements}

        {/* World border overlay (darken outside world) */}
        <Path path={overlayPath} color="rgba(0,0,0,0.6)" />

        {/* World border stroke */}
        <Path path={borderPath}>
          <Paint style="stroke" strokeWidth={sr(20)} color="rgba(168,85,247,0.4)">
            <Shadow dx={0} dy={0} blur={30} color="#a855f7" />
          </Paint>
        </Path>

        {/* Survival zone overlay */}
        {survivalOverlay && <Path path={survivalOverlay} color="rgba(0,0,0,0.55)" />}
        {survivalBorderPath && (
          <Path path={survivalBorderPath}>
            <Paint style="stroke" strokeWidth={6} color="rgba(255,0,0,0.7)">
              <Shadow dx={0} dy={0} blur={30} color="red" />
            </Paint>
          </Path>
        )}
        {survivalNextPath && (
          <Path path={survivalNextPath}>
            <Paint style="stroke" strokeWidth={3} color="rgba(255,255,255,0.8)" strokeDashArray={[10,10]} />
          </Path>
        )}

        {/* Danger zones */}
        {dangerZoneElements}

        {/* Black holes */}
        {blackHoleElements}

        {/* Magnet waves */}
        {magnetWaveElements}

        {/* Food */}
        {foodElements}

        {/* Coins */}
        {coinElements}

        {/* Powerups */}
        {powerupElements}

        {/* Bots */}
        {botElements}

        {/* Player body */}
        <Path path={playerBodyPath}>
          <RadialGradient c={vec(pcx,pcy)} r={psr} colors={['#000000','#050505','#1e1b4b']} positions={[0,0.5,1]} />
        </Path>
        {/* Player rotating arcs */}
        <Group origin={vec(pcx, pcy)} transform={[{ rotate: time }]}>
          <Path path={playerArcPath}>
            <Paint style="stroke" strokeWidth={2} color="rgba(168,85,247,0.18)" />
          </Path>
        </Group>
        {/* Player outer circle */}
        <Path path={playerOuterPath}>
          <Paint style="stroke" strokeWidth={2} color="rgba(255,255,255,0.1)" />
        </Path>
        {/* Player pulse ring */}
        <Path path={playerPulsePath}>
          <Paint style="stroke" strokeWidth={3} color="rgba(255,255,255,0.08)" />
        </Path>
        {/* Player border */}
        <Path path={playerBorderPath}>
          <Paint style="stroke" strokeWidth={isPlayerLeader ? 6 : 4}
            color={player.spawnShield > 0 ? '#22d3ee' : isPlayerLeader ? '#facc15' : player.ringColor}>
            <Shadow dx={0} dy={0} blur={20} color={isPlayerLeader ? '#facc15' : '#a855f7'} />
          </Paint>
        </Path>
        {/* Direction arrow */}
        <Group transform={[{ translateX: arrowX }, { translateY: arrowY }, { rotate: dirAngle }]}>
          <Path path={arrowPath} color="#ffffff" />
        </Group>
      </Canvas>

      {/* ═══ HUD (React Native Views) ═══ */}
      {gameState === 'playing' && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">

          {/* Leaderboard */}
          <View style={[styles.leaderboard, { pointerEvents: 'none' }]}>
            <View style={styles.lbHeader}>
              <Trophy size={10} color="#eab308" />
              <Text style={styles.lbTitle}>LEADERBOARD</Text>
            </View>
            {leaderboard.slice(0, 8).map((p: any, i: number) => (
              <View key={i} style={styles.lbRow}>
                <Text style={[styles.lbRank, p.isPlayer && styles.lbYou]}>{i + 1}</Text>
                <Text style={[styles.lbName, p.isPlayer && styles.lbYou]} numberOfLines={1}>{p.name}</Text>
                <Text style={[styles.lbScore, p.isPlayer && styles.lbYou]}>
                  {e.mode === 'survival' ? `${Math.floor(p.score||0)}s` : `${Math.floor(p.mass)}m`}
                </Text>
              </View>
            ))}
          </View>

          {/* Score */}
          <View style={styles.scorePill} pointerEvents="none">
            <Text style={styles.scoreText}>⭐ {score}</Text>
          </View>

          {/* Coins */}
          <View style={styles.coinPill} pointerEvents="none">
            <Text style={styles.coinText}>🪙 {coinsCollected}</Text>
          </View>

          {/* Alive count (survival) */}
          {e.mode === 'survival' && (
            <View style={styles.alivePill} pointerEvents="none">
              <Text style={styles.aliveText}>👥 {aliveCount}/{e.bots.length + 1}</Text>
            </View>
          )}

          {/* Timer (time mode) */}
          {e.mode === 'time' && (
            <View style={[styles.timerPill, e.timeRemaining <= 10 && styles.timerUrgent]} pointerEvents="none">
              <Text style={[styles.timerText, e.timeRemaining <= 10 && styles.timerTextUrgent]}>
                ⏱ {e.timeRemaining}s
              </Text>
            </View>
          )}

          {/* Death feed (all modes) */}
          {deathFeed.length > 0 && (
            <View style={styles.deathFeed} pointerEvents="none">
              {deathFeed.map((f: any) => (
                <Text key={f.id} style={styles.deathFeedText}>{f.text}</Text>
              ))}
            </View>
          )}

          {/* Event text */}
          {eventText && (
            <View style={styles.eventBox} pointerEvents="none">
              <Text style={styles.eventText}>{eventText}</Text>
            </View>
          )}

          {/* Mass + Instability bar */}
          <View style={styles.massBar} pointerEvents="none">
            <View style={styles.massRow}>
              <Text style={styles.massLabel}>MASS</Text>
              <Text style={styles.massValue}>{mass}</Text>
            </View>
            <View style={styles.instabilityTrack}>
              <View style={[styles.instabilityFill, {
                width: `${Math.min(100, instability)}%` as any,
                backgroundColor: instability > 70 ? '#ef4444' : '#f97316',
              }]} />
            </View>
            <View style={styles.instabilityRow}>
              <AlertTriangle size={9} color={instability > 70 ? '#ef4444' : '#6b7280'} />
              <Text style={[styles.instabilityLabel, instability > 70 && styles.instabilityDanger]}>
                INSTABILITY {Math.floor(instability)}%
              </Text>
            </View>
          </View>

          {/* Minimap */}
          <View style={styles.minimap} pointerEvents="none">
            <Canvas style={{ width: 100, height: 100 }}>
              {/* Minimap background */}
              <Circle cx={50} cy={50} r={50} color="rgba(15,23,42,0.85)" />
              {/* World boundary */}
              <Circle cx={50} cy={50} r={50}>
                <Paint style="stroke" strokeWidth={1.5} color="#a855f7" />
              </Circle>
              {/* Food dots */}
              {e.objects.slice(0, 200).map((o: any, i: number) => {
                const mx = (o.x / worldSize) * 100, my = (o.y / worldSize) * 100;
                if (mx < 0 || mx > 100 || my < 0 || my > 100) return null;
                return <Circle key={i} cx={mx} cy={my} r={1} color={o.color1} />;
              })}
              {/* Bots */}
              {e.bots.filter((b: any) => b.alive).map((b: any, i: number) => {
                const isLdr = e.topLeader === b.name;
                return <Circle key={i} cx={(b.x/worldSize)*100} cy={(b.y/worldSize)*100}
                  r={isLdr ? 3 : 2} color={isLdr ? '#facc15' : b.color} />;
              })}
              {/* Player */}
              <Circle cx={(player.x/worldSize)*100} cy={(player.y/worldSize)*100} r={3.5} color="#ffffff" />
              {/* Survival circle */}
              {e.mode === 'survival' && e.survival.active && (
                <Circle cx={(e.survival.centerX/worldSize)*100} cy={(e.survival.centerY/worldSize)*100}
                  r={(e.survival.currentRadius/worldSize)*100}>
                  <Paint style="stroke" strokeWidth={2} color="red" />
                </Circle>
              )}
            </Canvas>
          </View>

          {/* Rocket Surge button */}
          {mass >= 20000 && (
            <TouchableOpacity
              style={[styles.rocketBtn, {
                opacity: rocketCooldown > 0 ? 0.5 : 1,
                backgroundColor: rocketActive ? 'rgba(34,211,238,0.3)' : 'rgba(249,115,22,0.9)',
                borderColor: rocketActive ? '#22d3ee' : '#fb923c',
              }]}
              onPress={handleRocketClick}
              activeOpacity={0.8}
            >
              <Text style={styles.rocketIcon}>🚀</Text>
              {rocketCooldown > 0 && <Text style={styles.rocketCd}>{rocketCooldown}s</Text>}
              {rocketActive && <Text style={styles.rocketActive}>{rocketTimer2}s</Text>}
              <Text style={styles.rocketLabel}>SURGE</Text>
              <View style={styles.rocketDots}>
                {[1,2,3,4].map(k => (
                  <View key={k} style={[styles.rocketDot, {
                    backgroundColor: k <= rocketClickCount ? '#fb923c' : '#374151',
                  }]} />
                ))}
              </View>
            </TouchableOpacity>
          )}

          {/* Power buttons */}
          <View style={styles.powerRow}>
            {(['magnet','speed','double'] as const).map(type => {
              const timer = type==='magnet' ? e.magnetTimer : type==='speed' ? e.speedTimer : e.doubleScoreTimer;
              const isActive   = timer > 0;
              const isDisabled = isActive || e.inventory[type] <= 0;
              const colors2 = {
                magnet: '#ec4899', speed: '#06b6d4', double: '#f97316',
              };
              const c = colors2[type];
              return (
                <TouchableOpacity key={type} onPress={() => useShopPower(type)}
                  disabled={isDisabled}
                  style={[styles.powerBtn, { borderColor: c, opacity: isDisabled ? 0.5 : 1,
                    backgroundColor: isActive ? `${c}33` : 'rgba(0,0,0,0.7)' }]}>
                  {type === 'magnet' && <Magnet size={14} color={c} />}
                  {type === 'speed'  && <Zap    size={14} color={c} />}
                  {type === 'double' && <X      size={14} color={c} />}
                  <Text style={[styles.powerBtnLabel, { color: c }]}>{type}</Text>
                  <Text style={[styles.powerBtnStock, { color: isActive ? '#4ade80' : '#facc15' }]}>
                    x{e.inventory[type]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Joysticks */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            <Joystick
              side={e.swapStick ? 'right' : 'left'}
              onMove={data => {
                e.moveStick = { ...data, baseX: 0, baseY: 0 };
                if (data.active) e.lastInputTime = Date.now();
              }}
            />
            <Joystick
              side={e.swapStick ? 'left' : 'right'}
              onMove={data => { e.aimStick = { ...data, baseX: 0, baseY: 0 }; }}
            />
          </View>

          {/* Exit popup */}
          {showExitPopup && (
            <View style={styles.overlay}>
              <View style={styles.exitCard}>
                <Text style={styles.exitTitle}>Exit Game?</Text>
                <Text style={styles.exitSub}>You will lose your progress.</Text>
                <View style={styles.exitRow}>
                  <TouchableOpacity style={styles.exitContinue} onPress={() => setShowExitPopup(false)}>
                    <Text style={styles.exitContinueText}>Continue</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.exitBtn} onPress={onExitRef.current}>
                    <Text style={styles.exitBtnText}>Exit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ═══ Game Over Screen ═══ */}
      {gameState === 'gameover' && (
        <View style={styles.overlay}>
          <View style={styles.gameOverCard}>
            <Text style={[styles.gameOverTitle, { color: isWin ? '#4ade80' : '#ef4444' }]}>
              {isWin ? 'YOU WIN' : 'GAME OVER'}
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Score</Text>
                <Text style={[styles.statVal, { color: '#a78bfa' }]}>{score}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Coins</Text>
                <Text style={[styles.statVal, { color: '#facc15' }]}>{coinsCollected}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>XP</Text>
                <Text style={[styles.statVal, { color: '#60a5fa' }]}>+{xpEarned}</Text>
              </View>
            </View>
            {reviveTimer > 0 && resolvedMode !== 'survival' && !revived && (
              <>
                <Text style={styles.reviveTimer}>{reviveTimer}</Text>
                {gems > 0 && (
                  <TouchableOpacity style={styles.reviveGem} onPress={revivePlayer}>
                    <Text style={styles.reviveBtnText}>REVIVE (💎 {gems})</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            <TouchableOpacity style={styles.restartBtn}
              onPress={() => initGame(resolvedMode)}>
              <Text style={styles.restartText}>PLAY AGAIN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={onExitRef.current}>
              <Text style={styles.backText}>BACK HOME</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#000' },
  canvas: { flex: 1 },

  // HUD
  leaderboard: {
    position: 'absolute', top: 8, left: 8,
    width: 110, backgroundColor: 'rgba(15,23,42,0.5)',
    borderRadius: 8, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  lbHeader:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingBottom: 3 },
  lbTitle:   { fontSize: 7, fontWeight: '800', color: '#d1d5db', letterSpacing: 1 },
  lbRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 1 },
  lbRank:    { fontSize: 7, color: '#9ca3af', width: 12, fontFamily: 'monospace' },
  lbName:    { fontSize: 7, color: '#9ca3af', flex: 1 },
  lbScore:   { fontSize: 7, color: '#a78bfa', fontFamily: 'monospace' },
  lbYou:     { color: '#facc15', fontWeight: '800' },

  scorePill: {
    position: 'absolute', top: 8, left: '30%',
    backgroundColor: 'rgba(15,23,42,0.8)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  scoreText: { color: '#a78bfa', fontWeight: '900', fontSize: 13, fontFamily: 'monospace' },

  coinPill: {
    position: 'absolute', top: 8, left: '44%',
    backgroundColor: 'rgba(234,179,8,0.15)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(234,179,8,0.3)',
  },
  coinText: { color: '#facc15', fontWeight: '700', fontSize: 13 },

  alivePill: {
    position: 'absolute', top: 8, left: '58%',
    backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  aliveText: { color: '#f87171', fontWeight: '700', fontSize: 13 },

  timerPill: {
    position: 'absolute', top: 8, left: '50%',
    backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)',
  },
  timerUrgent: { backgroundColor: 'rgba(239,68,68,0.3)', borderColor: '#ef4444' },
  timerText:   { color: '#60a5fa', fontWeight: '700', fontSize: 13 },
  timerTextUrgent: { color: '#f87171' },

  deathFeed: { position: 'absolute', top: 30, left: '20%', gap: 2 },
  deathFeedText: { fontSize: 8, color: '#f87171', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  eventBox: {
    position: 'absolute', top: '10%', alignSelf: 'center', left: '30%',
    backgroundColor: 'rgba(168,85,247,0.1)', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
  },
  eventText: { color: '#d8b4fe', fontWeight: '800', fontSize: 10, letterSpacing: 1 },

  massBar: {
    position: 'absolute', bottom: 50, right: 16, width: 140,
    backgroundColor: 'rgba(15,23,42,0.8)', padding: 10, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  massRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  massLabel:  { fontSize: 9, color: '#9ca3af', fontWeight: '800', letterSpacing: 1 },
  massValue:  { fontSize: 18, color: '#4ade80', fontWeight: '900' },
  instabilityTrack: { height: 6, backgroundColor: '#0f172a', borderRadius: 3, overflow: 'hidden', marginBottom: 3 },
  instabilityFill:  { height: '100%', borderRadius: 3 },
  instabilityRow:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  instabilityLabel: { fontSize: 8, color: '#6b7280', fontWeight: '700', letterSpacing: 1 },
  instabilityDanger:{ color: '#ef4444' },

  minimap: {
    position: 'absolute', top: 8, right: 8, width: 100, height: 100,
    borderRadius: 50, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(168,85,247,0.4)',
  },

  rocketBtn: {
    position: 'absolute', right: 16, top: '15%',
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, elevation: 8,
  },
  rocketIcon:   { fontSize: 20 },
  rocketCd:     { fontSize: 8, color: '#9ca3af', fontWeight: '900' },
  rocketActive: { fontSize: 8, color: '#22d3ee', fontWeight: '900' },
  rocketLabel:  { fontSize: 7, color: '#fed7aa', fontWeight: '800', letterSpacing: 2 },
  rocketDots:   { flexDirection: 'row', gap: 2, marginTop: 1 },
  rocketDot:    { width: 6, height: 4, borderRadius: 2 },

  powerRow: {
    position: 'absolute', bottom: 8, left: '50%', right: '0%',
    flexDirection: 'row', justifyContent: 'center', gap: 12,
  },
  powerBtn: {
    alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, minWidth: 52,
  },
  powerBtnLabel: { fontSize: 7, fontWeight: '800', letterSpacing: 1, marginTop: 1 },
  powerBtnStock: { fontSize: 8, fontWeight: '700' },

  // Overlays
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', alignItems: 'center',
  },
  exitCard: {
    backgroundColor: '#0f172a', borderRadius: 24, padding: 28, width: 300,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center',
  },
  exitTitle: { fontSize: 22, fontWeight: '900', color: '#facc15', marginBottom: 8 },
  exitSub:   { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginBottom: 20 },
  exitRow:   { flexDirection: 'row', gap: 12, width: '100%' },
  exitContinue: { flex: 1, backgroundColor: '#374151', padding: 14, borderRadius: 12, alignItems: 'center' },
  exitContinueText: { color: '#fff', fontWeight: '700' },
  exitBtn: { flex: 1, backgroundColor: '#dc2626', padding: 14, borderRadius: 12, alignItems: 'center' },
  exitBtnText: { color: '#fff', fontWeight: '700' },

  gameOverCard: {
    backgroundColor: '#0f172a', borderRadius: 20, padding: 24, width: 280,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center',
  },
  gameOverTitle: { fontSize: 28, fontWeight: '900', marginBottom: 16 },
  statsRow:  { flexDirection: 'row', gap: 10, marginBottom: 16, width: '100%' },
  statBox:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', padding: 12, borderRadius: 12, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 3 },
  statVal:   { fontSize: 20, fontWeight: '900' },
  reviveTimer: { fontSize: 36, color: '#ef4444', fontWeight: '900', marginBottom: 8 },
  reviveGem: {
    width: '100%', backgroundColor: '#7c3aed', padding: 14, borderRadius: 12,
    alignItems: 'center', marginBottom: 8,
  },
  reviveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  restartBtn: {
    width: '100%', backgroundColor: '#16a34a', padding: 14, borderRadius: 12,
    alignItems: 'center', marginBottom: 8,
  },
  restartText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backBtn: {
    width: '100%', backgroundColor: '#374151', padding: 14, borderRadius: 12,
    alignItems: 'center',
  },
  backText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
