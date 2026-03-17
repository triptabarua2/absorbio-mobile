/**
 * index.tsx — Absorbio Home Screen
 * Full feature parity with web BlackholeHome.jsx
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Easing,
  StyleSheet, Dimensions, Modal, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  Canvas, Circle, Path, Skia,
  RadialGradient, vec, Shadow,
} from '@shopify/react-native-skia';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useAuth } from '@/lib/auth-context';
import { saveUserData } from '@/lib/firebase-db';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User, Gem, Coins, CalendarDays, Settings as SettingsIcon,
  Palette, ChevronLeft, ChevronRight, Infinity as InfinityIcon,
  Swords, Timer, Lock, X, Trophy, Gift, ShoppingBag,
} from 'lucide-react-native';

const { width: W, height: H } = Dimensions.get('window');

const THEMES = ['Space', 'Neon', 'Dark', 'Sunset', 'Cosmic'] as const;
type Theme = typeof THEMES[number];
const THEME_UNLOCKS: Record<Theme, number> = { Space:1, Neon:5, Dark:10, Sunset:25, Cosmic:50 };
const THEME_BG: Record<Theme, [string,string]> = {
  Space:  ['#2a0f4f','#050015'],
  Neon:   ['#001122','#002233'],
  Dark:   ['#111111','#000000'],
  Sunset: ['#ff9966','#1a0026'],
  Cosmic: ['#0ea5e9','#000814'],
};
const MODES = ['Infinity','Survival','Time'] as const;
type Mode = typeof MODES[number];
const MODE_DESC: Record<Mode,string> = {
  Infinity:'Endless play', Survival:'Last player wins', Time:'5 minute play',
};

// ─── Animated Space Background ────────────────────────────────────────────────

function SpaceBackground({ theme }: { theme: Theme }) {
  const [, setTick] = useState(0);
  const stars = useRef(
    Array.from({ length: 100 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5, speed: Math.random() * 0.5 + 0.1,
      alpha: Math.random(),
    }))
  );

  useEffect(() => {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      stars.current.forEach(s => {
        s.x -= s.speed;
        if (s.x < 0) { s.x = W; s.y = Math.random() * H; }
        s.alpha = Math.max(0.2, Math.min(1, s.alpha + (Math.random() - 0.5) * 0.05));
      });
      setTick(t => t + 1);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { alive = false; };
  }, []);

  const [c1, c2] = THEME_BG[theme];
  const bgPath = Skia.Path.Make();
  bgPath.addRect({ x: 0, y: 0, width: W, height: H });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Canvas style={{ flex: 1 }}>
        <Path path={bgPath}>
          <RadialGradient c={vec(W / 2, H / 2)} r={W} colors={[c1, c2]} />
        </Path>
        {stars.current.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={Math.max(0.5, s.r)}
            color={`rgba(255,255,255,${s.alpha.toFixed(2)})`} />
        ))}
      </Canvas>
    </View>
  );
}

// ─── Spinning Ring ─────────────────────────────────────────────────────────────

function SpinRing({ size, duration, reverse = false, color = 'rgba(255,255,255,0.8)', dashed = false, style: extraStyle }: {
  size: number; duration: number; reverse?: boolean; color?: string; dashed?: boolean; style?: object;
}) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'] });
  const r = size / 2;
  return (
    <Animated.View style={[{
      position: 'absolute',
      width: size, height: size, borderRadius: r,
      borderWidth: dashed ? 1.5 : 2,
      borderColor: color,
      borderStyle: dashed ? 'dashed' : 'solid',
      top: -(size - 40) / 2, left: -(size - 40) / 2,
      transform: [{ rotate }],
    }, extraStyle]} />
  );
}

// ─── useLoop animations ────────────────────────────────────────────────────────

function useLoopAnim(duration: number) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(a, { toValue: 0, duration, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ])).start();
  }, []);
  return a;
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();

  const [level,      setLevel]      = useState(1);
  const [xp,         setXp]         = useState(0);
  const [balance,    setBalance]    = useState(0);
  const [xpNeeded,   setXpNeeded]   = useState(200);
  const [themeIndex, setThemeIndex] = useState(0);
  const [modeIndex,  setModeIndex]  = useState(0);
  const [stats,      setStats]      = useState<Record<string,number>>({});

  const [profilePopup, setProfilePopup] = useState(false);
  const [modeModal,    setModeModal]    = useState(false);
  const [eventPopup,   setEventPopup]   = useState(false);
  const [shapePopup,   setShapePopup]   = useState(false);
  const [isStarting,   setIsStarting]   = useState(false);
  const [appLoaded,    setAppLoaded]    = useState(false);

  const loaderOpacity = useRef(new Animated.Value(1)).current;
  const breathAnim = useLoopAnim(2000);
  const floatAnim  = useLoopAnim(3000);

  const theme  = THEMES[themeIndex];
  const mode   = MODES[modeIndex];
  const isThemeUnlocked = level >= THEME_UNLOCKS[theme];

  const breathScale = breathAnim.interpolate({ inputRange:[0,1], outputRange:[0.95,1.10] });
  const floatY      = floatAnim.interpolate({ inputRange:[0,1], outputRange:[-8,8] });

  // Load
  useEffect(() => {
    (async () => {
      const [sl, sx, st, ss] = await Promise.all([
        AsyncStorage.getItem('collector_level'),
        AsyncStorage.getItem('collector_xp'),
        AsyncStorage.getItem('theme'),
        AsyncStorage.getItem('bh_stats'),
      ]);
      const lvl = parseInt(sl||'1')||1;
      const xpV = parseInt(sx||'0')||0;
      setLevel(lvl); setXp(xpV);
      setXpNeeded(200+40*lvl*lvl*lvl);
      if (st!==null) { const ti=Number(st); if(lvl>=THEME_UNLOCKS[THEMES[ti]||'Space']) setThemeIndex(ti); }
      if (ss) setStats(JSON.parse(ss));
      setTimeout(() => {
        Animated.timing(loaderOpacity,{toValue:0,duration:600,useNativeDriver:true}).start(()=>setAppLoaded(true));
      }, 1400);
    })();
  }, []);

  useEffect(() => {
    if (userData) {
      setLevel(userData.level||1); setXp(userData.xp||0); setBalance(userData.coins||0);
    }
  }, [userData]);

  useEffect(() => {
    if (xp >= xpNeeded) {
      const nl=level+1, nx=xp-xpNeeded;
      setLevel(nl); setXp(nx); setXpNeeded(200+40*nl*nl*nl);
    }
  }, [xp,xpNeeded,level]);

  useEffect(() => {
    AsyncStorage.setItem('collector_level',String(level));
    AsyncStorage.setItem('collector_xp',String(xp));
    if (user) saveUserData(user.uid,{level,xp,coins:balance});
  }, [level,xp,balance]);

  useEffect(() => {
    if (level >= THEME_UNLOCKS[theme]) AsyncStorage.setItem('theme',String(themeIndex));
  }, [themeIndex,level]);

  const handlePlay = () => {
    if (!isThemeUnlocked) return;
    setIsStarting(true);
    setTimeout(() => {
      setIsStarting(false);
      router.push({ pathname:'/(tabs)/game', params:{mode:mode.toLowerCase(), theme} });
    }, 2500);
  };

  const formatTime = (s: number) => {
    if (!s) return '0s';
    const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
    const p=[]; if(h)p.push(`${h}h`); if(m)p.push(`${m}m`); if(sec||!p.length)p.push(`${sec}s`);
    return p.join(' ');
  };

  const xpPct = Math.min((xp/xpNeeded)*100, 100);

  if (loading) return (
    <View style={[S.root,{justifyContent:'center',alignItems:'center'}]}>
      <ActivityIndicator size="large" color="#a855f7" />
    </View>
  );

  if (!user && !userData) return (
    <View style={[S.root,{justifyContent:'center',alignItems:'center'}]}>
      <TouchableOpacity style={S.signInBtn} onPress={()=>router.push('/login')}>
        <Text style={S.signInText}>SIGN IN TO VOID</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={S.root}>
      <SpaceBackground theme={theme} />

      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">

        {/* ── TOP BAR ── */}
        <View style={S.topBar} pointerEvents="box-none">
          <TouchableOpacity style={S.profilePill} onPress={()=>setProfilePopup(true)}>
            <View style={S.avatarCircle}>
              <User size={18} color="#9ca3af" />
              <View style={S.avatarDot} />
            </View>
            <View style={{width:72}}>
              <Text style={S.levelText}>Lv. {level}</Text>
              <View style={S.xpTrack}>
                <View style={[S.xpFill,{width:`${xpPct}%` as any}]} />
              </View>
            </View>
          </TouchableOpacity>
          <View style={S.topRight}>
            <View style={[S.currencyPill,{borderColor:'rgba(96,165,250,0.3)'}]}>
              <Gem size={14} color="#60a5fa" /><Text style={S.currencyText}>0</Text>
            </View>
            <View style={[S.currencyPill,{borderColor:'rgba(234,179,8,0.3)'}]}>
              <Coins size={14} color="#eab308" /><Text style={S.currencyText}>{balance}</Text>
              <View style={S.currencyDot} />
            </View>
          </View>
        </View>

        {/* ── TITLE ── */}
        <View style={S.titleWrap} pointerEvents="none">
          <View style={S.titleRow}>
            <Text style={S.titleTxt}>BLACKH</Text>
            <View style={S.titleHole}>
              <View style={S.titleHoleCore} />
              <SpinRing size={52} duration={2000} color="rgba(56,189,248,0.9)" style={{top:-6,left:-6}} />
              <SpinRing size={44} duration={1500} reverse color="rgba(168,85,247,0.8)" style={{top:-2,left:-2}} />
            </View>
            <Text style={S.titleTxt}>LE</Text>
          </View>
          <Text style={S.titleSub}>SPACE COLLECTOR</Text>
        </View>

        {/* ── CENTER ROW ── */}
        <View style={S.centerRow} pointerEvents="box-none">
          {/* Event */}
          <TouchableOpacity style={S.sideBtn} onPress={()=>setEventPopup(true)}>
            <View style={[S.sideBtnIcon,{backgroundColor:'rgba(99,102,241,0.85)'}]}>
              <CalendarDays size={20} color="#fff" />
              <View style={S.badge}><Text style={S.badgeTxt}>!</Text></View>
            </View>
            <Text style={S.sideBtnLbl}>Event</Text>
          </TouchableOpacity>

          {/* Floating player */}
          <Animated.View style={{transform:[{translateY:floatY}]}}>
            <Animated.View style={[S.playerBall,{transform:[{scale:breathScale}]}]}>
              <View style={S.playerCore} />
              <SpinRing size={80}  duration={15000} color="rgba(255,255,255,0.85)" style={{top:-20,left:-20}} />
              <SpinRing size={92}  duration={10000} reverse color="rgba(200,200,200,0.6)" dashed style={{top:-26,left:-26}} />
              <SpinRing size={104} duration={20000} color="rgba(255,255,255,0.35)" dashed style={{top:-32,left:-32}} />
              <Text style={S.playerYou}>you</Text>
            </Animated.View>
          </Animated.View>

          {/* Settings + Theme */}
          <View style={S.rightCol}>
            <TouchableOpacity style={S.sideBtn} onPress={()=>router.push('/(tabs)/settings')}>
              <View style={S.sideBtnGray}><SettingsIcon size={20} color="#d1d5db" /></View>
              <Text style={S.sideBtnLbl}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.sideBtn,{marginTop:16}]} onPress={()=>setThemeIndex(i=>(i+1)%THEMES.length)}>
              <View style={[S.sideBtnGray,{borderColor:'rgba(168,85,247,0.4)'}]}>
                <Palette size={20} color="#a855f7" />
                {!isThemeUnlocked && <View style={S.lockBadge}><Lock size={8} color="#fff" /></View>}
              </View>
              <Text style={[S.sideBtnLbl, !isThemeUnlocked && S.sideBtnLocked]}>
                {isThemeUnlocked ? theme : `🔒 Lv ${THEME_UNLOCKS[theme]}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── BOTTOM BAR ── */}
        <View style={S.bottomBar} pointerEvents="box-none">
          {/* Nav pills */}
          <View style={S.navRow}>
            {([
              {icon:<ShoppingBag size={13} color="#22d3ee"/>, label:'Shape', onPress:()=>setShapePopup(true)},
              {icon:<Trophy size={13} color="#facc15"/>,      label:'Ranks', onPress:()=>router.push('/(tabs)/leaderboard')},
              {icon:<Gift size={13} color="#f472b6"/>,        label:'Loot',  onPress:()=>router.push('/(tabs)/rewards')},
              {icon:<ShoppingBag size={13} color="#22d3ee"/>, label:'Shop',  onPress:()=>router.push('/(tabs)/shop')},
            ] as const).map(item=>(
              <TouchableOpacity key={item.label} style={S.navPill} onPress={item.onPress}>
                {item.icon}
                <Text style={S.navLbl}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Mode + Play */}
          <View style={S.playCol}>
            <View style={S.modePill}>
              <TouchableOpacity onPress={()=>setModeIndex(i=>(i-1+MODES.length)%MODES.length)} style={{padding:4}}>
                <ChevronLeft size={18} color="#9ca3af" />
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>setModeModal(true)} style={S.modeCenter}>
                <Text style={S.modeLblTiny}>MODE</Text>
                <Text style={S.modeName}>{mode}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>setModeIndex(i=>(i+1)%MODES.length)} style={{padding:4}}>
                <ChevronRight size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[S.playBtn, !isThemeUnlocked && S.playBtnLocked]}
              onPress={handlePlay} activeOpacity={isThemeUnlocked?0.85:1}
            >
              <View style={S.playHole}>
                <View style={S.playHoleCore} />
                {isThemeUnlocked && (
                  <>
                    <SpinRing size={36} duration={2000} color="rgba(255,255,255,0.9)" style={{top:-8,left:-8}} />
                    <SpinRing size={44} duration={2500} reverse color="rgba(168,85,247,0.8)" dashed style={{top:-12,left:-12}} />
                    <View style={S.playTri} />
                  </>
                )}
                {!isThemeUnlocked && <Lock size={14} color="#6b7280" />}
              </View>
              <Text style={[S.playTxt, !isThemeUnlocked&&{color:'#6b7280'}]}>
                {isThemeUnlocked?'PLAY':'LOCKED'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── ENTERING VOID ── */}
      {isStarting && (
        <View style={S.enterOverlay}>
          <View style={S.enterBall}>
            <View style={S.enterCore} />
            <SpinRing size={96}  duration={800}  color="rgba(34,211,238,0.9)" style={{top:-28,left:-28}} />
            <SpinRing size={116} duration={1200} reverse color="rgba(168,85,247,0.9)" dashed style={{top:-38,left:-38}} />
            <View style={S.enterDot} />
          </View>
          <Text style={S.enterTxt}>ENTERING VOID...</Text>
        </View>
      )}

      {/* ── APP LOADER ── */}
      {!appLoaded && (
        <Animated.View style={[S.appLoader,{opacity:loaderOpacity}]}>
          <View style={S.enterBall}>
            <View style={S.enterCore} />
            <SpinRing size={96}  duration={800}  color="rgba(34,211,238,0.9)" style={{top:-28,left:-28}} />
            <SpinRing size={116} duration={1200} reverse color="rgba(168,85,247,0.9)" dashed style={{top:-38,left:-38}} />
            <View style={S.enterDot} />
          </View>
          <Text style={S.initTxt}>INITIALIZING...</Text>
        </Animated.View>
      )}

      {/* ── PROFILE POPUP ── */}
      <Modal visible={profilePopup} transparent animationType="fade" onRequestClose={()=>setProfilePopup(false)}>
        <View style={S.backdrop}>
          <ScrollView style={{width:'100%'}} contentContainerStyle={{alignItems:'center',paddingVertical:20}}>
            <View style={S.profileCard}>
              <View style={S.profileAvatar}><User size={30} color="#9ca3af" /></View>
              <Text style={S.profileLvl}>Lv. {level}</Text>
              <View style={S.profileXpRow}>
                <Text style={S.profileXpLbl}>XP</Text>
                <Text style={S.profileXpLbl}>{xp} / {xpNeeded}</Text>
              </View>
              <View style={S.profileXpTrack}>
                <View style={[S.profileXpFill,{width:`${xpPct}%` as any}]} />
              </View>
              <View style={S.statsBox}>
                <Text style={S.statsTitle}>PLAYER STATS</Text>
                {([
                  ['Total Score',  (stats.totalScore||0).toLocaleString(), '#fff'],
                  ['Total Kills',   stats.totalKills||0, '#fff'],
                  ['Total Mass',    stats.totalMass||0, '#fff'],
                  ['Best Mass',     stats.bestMass||0, '#4ade80'],
                  ['Highest Time',  formatTime(stats.highestTime||0), '#facc15'],
                  ['Total Played',  formatTime(stats.totalPlayedTime||0), '#22d3ee'],
                  ['Total Games',   stats.totalGames||0, '#fff'],
                  ['Total Wins',    stats.totalWins||0, '#f472b6'],
                ] as [string,any,string][]).map(([l,v,c])=>(
                  <View key={l} style={S.statRow}>
                    <Text style={S.statLbl}>{l}:</Text>
                    <Text style={[S.statVal,{color:c}]}>{String(v)}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={S.closeBtn} onPress={()=>setProfilePopup(false)}>
                <Text style={S.closeBtnTxt}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── MODE MODAL ── */}
      <Modal visible={modeModal} transparent animationType="fade" onRequestClose={()=>setModeModal(false)}>
        <View style={S.backdrop}>
          <TouchableOpacity style={S.modeModalX} onPress={()=>setModeModal(false)}>
            <X size={24} color="#9ca3af" />
          </TouchableOpacity>
          <Text style={S.modeModalTitle}>SELECT MODE</Text>
          <View style={S.modeCards}>
            {MODES.map((m,idx)=>{
              const sel=modeIndex===idx;
              return (
                <TouchableOpacity key={m} style={[S.modeCard,sel&&S.modeCardSel]}
                  onPress={()=>{setModeIndex(idx);setModeModal(false);}}>
                  {sel&&<View style={S.modeGlow}/>}
                  <View style={S.modeIconWrap}>
                    <View style={S.modeIconCore}/>
                    <SpinRing size={60} duration={sel?4000:8000}
                      color={sel?'rgba(168,85,247,0.9)':'rgba(107,114,128,0.5)'}
                      style={{top:-10,left:-10}} />
                    <View style={{position:'absolute'}}>
                      {m==='Infinity'&&<InfinityIcon size={22} color={sel?'#fff':'#9ca3af'}/>}
                      {m==='Survival'&&<Swords       size={22} color={sel?'#fff':'#9ca3af'}/>}
                      {m==='Time'    &&<Timer        size={22} color={sel?'#fff':'#9ca3af'}/>}
                    </View>
                    {sel&&<View style={S.modeActiveDot}/>}
                  </View>
                  <Text style={[S.modeCardName,sel&&{color:'#fff'}]}>{m}</Text>
                  <Text style={[S.modeCardDesc,sel&&{color:'#c4b5fd'}]}>{MODE_DESC[m]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* ── EVENT / SHAPE ── */}
      <Modal visible={eventPopup||shapePopup} transparent animationType="fade"
        onRequestClose={()=>{setEventPopup(false);setShapePopup(false);}}>
        <View style={S.backdrop}>
          <View style={[S.smallCard,{borderColor:shapePopup?'rgba(236,72,153,0.4)':'rgba(168,85,247,0.4)'}]}>
            <Text style={[S.smallTitle,{color:shapePopup?'#f472b6':'#c4b5fd'}]}>
              {shapePopup?'SHAPES':'SPECIAL EVENT'}
            </Text>
            <View style={S.smallBadge}><Text style={S.smallBadgeTxt}>Coming Soon 🚀</Text></View>
            <Text style={S.smallSub}>{shapePopup?'Unlock epic shapes!':'Stay tuned for rewards!'}</Text>
            <TouchableOpacity style={[S.smallBtn,{backgroundColor:shapePopup?'#db2777':'#7c3aed'}]}
              onPress={()=>{setEventPopup(false);setShapePopup(false);}}>
              <Text style={S.smallBtnTxt}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex:1, backgroundColor:'#050015' },
  signInBtn: { backgroundColor:'#7c3aed', paddingHorizontal:32, paddingVertical:16, borderRadius:20, elevation:8 },
  signInText: { color:'#fff', fontWeight:'900', fontSize:16, letterSpacing:3 },

  // Top bar
  topBar: {
    position:'absolute', top:0, left:0, right:0,
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingHorizontal:16, paddingTop: Platform.OS==='ios'?50:36, paddingBottom:8,
  },
  profilePill: {
    flexDirection:'row', alignItems:'center', gap:8,
    backgroundColor:'rgba(0,0,0,0.5)', paddingLeft:6, paddingRight:14, paddingVertical:6,
    borderRadius:40, borderWidth:1, borderColor:'rgba(168,85,247,0.3)',
  },
  avatarCircle: {
    width:40, height:40, borderRadius:20,
    backgroundColor:'#1f2937', borderWidth:2, borderColor:'#a855f7',
    alignItems:'center', justifyContent:'flex-end', overflow:'hidden',
  },
  avatarDot: {
    position:'absolute', top:2, right:2, width:10, height:10, borderRadius:5,
    backgroundColor:'#ef4444', borderWidth:1.5, borderColor:'#1f2937',
  },
  levelText: { color:'#fff', fontWeight:'900', fontSize:13, letterSpacing:1 },
  xpTrack: { height:6, backgroundColor:'#1f2937', borderRadius:3, overflow:'hidden', marginTop:3, borderWidth:1, borderColor:'#374151' },
  xpFill: { height:'100%', backgroundColor:'#a855f7', borderRadius:3 },
  topRight: { flexDirection:'row', gap:8 },
  currencyPill: {
    flexDirection:'row', alignItems:'center', gap:5,
    backgroundColor:'rgba(0,0,0,0.5)', paddingHorizontal:12, paddingVertical:6,
    borderRadius:40, borderWidth:1,
  },
  currencyText: { color:'#fff', fontWeight:'700', fontSize:13 },
  currencyDot: {
    position:'absolute', top:-4, right:-4, width:10, height:10, borderRadius:5,
    backgroundColor:'#ef4444', borderWidth:1, borderColor:'#000',
  },

  // Title
  titleWrap: { position:'absolute', top:'8%', left:0, right:0, alignItems:'center' },
  titleRow: { flexDirection:'row', alignItems:'center' },
  titleTxt: { fontSize:50, fontWeight:'900', fontStyle:'italic', color:'#7dd3fc', letterSpacing:-2,
    textShadowColor:'rgba(56,189,248,0.7)', textShadowRadius:10 },
  titleHole: { width:48, height:48, marginHorizontal:4, marginBottom:4, alignItems:'center', justifyContent:'center' },
  titleHoleCore: { width:32, height:32, borderRadius:16, backgroundColor:'#000',
    shadowColor:'#38bdf8', shadowOffset:{width:0,height:0}, shadowRadius:15, shadowOpacity:0.8, elevation:10,
    position:'absolute' },
  titleSub: { fontSize:9, fontWeight:'900', color:'rgba(103,232,249,0.8)', letterSpacing:8, marginTop:-4 },

  // Center
  centerRow: {
    position:'absolute', top:'36%', left:0, right:0,
    flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20,
  },
  sideBtn: { alignItems:'center', gap:4 },
  sideBtnIcon: { width:40, height:40, borderRadius:12, alignItems:'center', justifyContent:'center', elevation:5 },
  badge: { position:'absolute', top:-6, right:-6, width:16, height:16, borderRadius:8,
    backgroundColor:'#ef4444', borderWidth:1, borderColor:'#000', alignItems:'center', justifyContent:'center' },
  badgeTxt: { fontSize:8, color:'#fff', fontWeight:'900' },
  sideBtnGray: { width:40, height:40, borderRadius:20, backgroundColor:'rgba(0,0,0,0.5)',
    borderWidth:1, borderColor:'#4b5563', alignItems:'center', justifyContent:'center' },
  lockBadge: { position:'absolute', top:-4, right:-4, backgroundColor:'#dc2626', borderRadius:6, padding:2, borderWidth:1, borderColor:'#000' },
  sideBtnLbl: { fontSize:9, color:'#fff', fontWeight:'700', backgroundColor:'rgba(0,0,0,0.5)', paddingHorizontal:5, paddingVertical:2, borderRadius:4 },
  sideBtnLocked: { color:'#f87171', borderWidth:1, borderColor:'rgba(239,68,68,0.3)', borderRadius:4, paddingHorizontal:3 },
  rightCol: { alignItems:'center' },
  playerBall: { width:80, height:80, alignItems:'center', justifyContent:'center' },
  playerCore: { position:'absolute', width:40, height:40, borderRadius:20, backgroundColor:'#000',
    shadowColor:'#fff', shadowOffset:{width:0,height:0}, shadowRadius:20, shadowOpacity:0.5, elevation:10 },
  playerYou: { position:'absolute', color:'#fff', fontWeight:'700', fontSize:11, letterSpacing:2, opacity:0.9 },

  // Bottom
  bottomBar: {
    position:'absolute', bottom:0, left:0, right:0,
    flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end',
    paddingHorizontal:16, paddingBottom: Platform.OS==='ios'?90:72,
  },
  navRow: { flexDirection:'row', gap:6 },
  navPill: { flexDirection:'row', alignItems:'center', gap:5,
    backgroundColor:'rgba(255,255,255,0.1)', paddingHorizontal:10, paddingVertical:8,
    borderRadius:40, borderWidth:1, borderColor:'rgba(255,255,255,0.2)' },
  navLbl: { color:'#fff', fontWeight:'600', fontSize:11, letterSpacing:0.5 },
  playCol: { alignItems:'flex-end', gap:8 },
  modePill: { flexDirection:'row', alignItems:'center',
    backgroundColor:'rgba(0,0,0,0.5)', borderRadius:10,
    borderWidth:1, borderColor:'rgba(168,85,247,0.4)',
    paddingHorizontal:4, paddingVertical:4 },
  modeCenter: { alignItems:'center', width:80 },
  modeLblTiny: { fontSize:7, color:'#a855f7', fontWeight:'700', letterSpacing:2 },
  modeName: { fontSize:13, color:'#fff', fontWeight:'900', letterSpacing:0.5 },
  playBtn: {
    flexDirection:'row', alignItems:'center', gap:12,
    paddingHorizontal:28, paddingVertical:10, borderRadius:14, overflow:'hidden',
    backgroundColor:'#5b21b6', borderBottomWidth:4, borderBottomColor:'#3b0764',
    shadowColor:'#a855f7', shadowOffset:{width:0,height:0}, shadowRadius:14, shadowOpacity:0.7, elevation:8,
  },
  playBtnLocked: { backgroundColor:'#1f2937', borderBottomColor:'#111827', shadowOpacity:0 },
  playHole: { width:32, height:32, alignItems:'center', justifyContent:'center' },
  playHoleCore: { position:'absolute', width:26, height:26, borderRadius:13, backgroundColor:'#000',
    shadowColor:'#ec4899', shadowOffset:{width:0,height:0}, shadowRadius:8, shadowOpacity:0.8, elevation:5 },
  playTri: { position:'absolute', width:0, height:0,
    borderTopWidth:6, borderTopColor:'transparent',
    borderBottomWidth:6, borderBottomColor:'transparent',
    borderLeftWidth:10, borderLeftColor:'#fff', marginLeft:2 },
  playTxt: { color:'#fff', fontWeight:'900', fontSize:18, letterSpacing:4 },

  // Entering void
  enterOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor:'#000',
    alignItems:'center', justifyContent:'center', zIndex:200 },
  enterBall: { width:96, height:96, alignItems:'center', justifyContent:'center' },
  enterCore: { position:'absolute', width:56, height:56, borderRadius:28, backgroundColor:'#000',
    shadowColor:'#a855f7', shadowOffset:{width:0,height:0}, shadowRadius:40, shadowOpacity:0.9, elevation:10 },
  enterDot: { width:8, height:8, borderRadius:4, backgroundColor:'#fff',
    shadowColor:'#fff', shadowOffset:{width:0,height:0}, shadowRadius:10, shadowOpacity:1 },
  enterTxt: { marginTop:48, fontSize:14, fontWeight:'900', color:'#67e8f9',
    letterSpacing:8, textShadowColor:'#a855f7', textShadowRadius:12 },
  appLoader: { ...StyleSheet.absoluteFillObject, backgroundColor:'#000',
    alignItems:'center', justifyContent:'center', zIndex:300 },
  initTxt: { marginTop:48, fontSize:12, fontWeight:'900', color:'#a78bfa',
    letterSpacing:8, textShadowColor:'#7c3aed', textShadowRadius:8 },

  // Modals
  backdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.85)', alignItems:'center', justifyContent:'center', padding:16 },
  profileCard: { backgroundColor:'#0f172a', borderRadius:20, padding:24, width:320,
    borderWidth:1, borderColor:'rgba(168,85,247,0.4)',
    shadowColor:'#a855f7', shadowOffset:{width:0,height:0}, shadowRadius:30, shadowOpacity:0.3 },
  profileAvatar: { width:64, height:64, borderRadius:32, backgroundColor:'#1f2937',
    borderWidth:2, borderColor:'#a855f7', alignSelf:'center',
    alignItems:'center', justifyContent:'flex-end', overflow:'hidden', marginBottom:8 },
  profileLvl: { color:'#fff', fontWeight:'900', fontSize:22, letterSpacing:3, textAlign:'center' },
  profileXpRow: { flexDirection:'row', justifyContent:'space-between', marginTop:10, marginBottom:4 },
  profileXpLbl: { color:'#c4b5fd', fontWeight:'700', fontSize:9, letterSpacing:2 },
  profileXpTrack: { height:8, backgroundColor:'#1e293b', borderRadius:4, overflow:'hidden',
    borderWidth:1, borderColor:'#374151', marginBottom:16 },
  profileXpFill: { height:'100%', backgroundColor:'#a855f7', borderRadius:4 },
  statsBox: { backgroundColor:'rgba(0,0,0,0.4)', borderRadius:14, padding:14,
    borderWidth:1, borderColor:'rgba(255,255,255,0.05)', gap:7 },
  statsTitle: { color:'#c4b5fd', fontWeight:'900', fontSize:9, letterSpacing:3,
    textAlign:'center', borderBottomWidth:1, borderColor:'rgba(168,85,247,0.2)',
    paddingBottom:8, marginBottom:4 },
  statRow: { flexDirection:'row', justifyContent:'space-between' },
  statLbl: { color:'#9ca3af', fontSize:11, fontWeight:'700' },
  statVal: { fontSize:12, fontWeight:'700' },
  closeBtn: { marginTop:16, backgroundColor:'#7c3aed', paddingVertical:12,
    borderRadius:12, alignItems:'center', elevation:5 },
  closeBtnTxt: { color:'#fff', fontWeight:'900', fontSize:15, letterSpacing:3 },

  // Mode modal
  modeModalX: { position:'absolute', top:16, right:16, backgroundColor:'rgba(255,255,255,0.1)', padding:8, borderRadius:20 },
  modeModalTitle: { color:'#fff', fontWeight:'900', fontSize:26, letterSpacing:4, marginBottom:24,
    textShadowColor:'#a855f7', textShadowRadius:10 },
  modeCards: { flexDirection:'row', gap:12 },
  modeCard: { width:110, alignItems:'center', paddingVertical:18, paddingHorizontal:8,
    borderRadius:20, borderWidth:2, borderColor:'#374151', backgroundColor:'rgba(17,24,39,0.7)', overflow:'hidden' },
  modeCardSel: { borderColor:'#a855f7', backgroundColor:'rgba(88,28,135,0.4)',
    shadowColor:'#a855f7', shadowOffset:{width:0,height:0}, shadowRadius:20, shadowOpacity:0.5, elevation:10 },
  modeGlow: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(168,85,247,0.12)' },
  modeIconWrap: { width:60, height:60, alignItems:'center', justifyContent:'center', marginBottom:12 },
  modeIconCore: { position:'absolute', width:40, height:40, borderRadius:20, backgroundColor:'#000', elevation:3 },
  modeActiveDot: { position:'absolute', top:2, right:2, width:10, height:10, borderRadius:5,
    backgroundColor:'#4ade80', shadowColor:'#4ade80', shadowRadius:8, elevation:5 },
  modeCardName: { color:'#d1d5db', fontWeight:'900', fontSize:14, letterSpacing:1, marginBottom:4 },
  modeCardDesc: { color:'#6b7280', fontSize:9, textAlign:'center', fontWeight:'600' },

  // Event/shape popup
  smallCard: { backgroundColor:'rgba(15,23,42,0.97)', width:270, padding:24,
    borderRadius:20, borderWidth:2, alignItems:'center', gap:12,
    shadowColor:'#a855f7', shadowOffset:{width:0,height:0}, shadowRadius:20, shadowOpacity:0.3 },
  smallTitle: { fontSize:17, fontWeight:'900', letterSpacing:3 },
  smallBadge: { backgroundColor:'rgba(0,0,0,0.5)', paddingHorizontal:12, paddingVertical:6,
    borderRadius:10, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  smallBadgeTxt: { color:'#fff', fontWeight:'700', fontSize:12 },
  smallSub: { color:'#6b7280', fontSize:11 },
  smallBtn: { width:'100%', paddingVertical:10, borderRadius:12, alignItems:'center' },
  smallBtnTxt: { color:'#fff', fontWeight:'900', fontSize:14, letterSpacing:2 },
});
