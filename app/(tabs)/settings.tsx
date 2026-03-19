/**
 * settings.tsx — Absorbio Settings Screen
 * Full feature parity with web BlackholeHome settings panel
 *
 * Sections:
 *  1. Graphics Quality (Smooth / Standard / Ultra)
 *  2. Food Style (Planet / Classic)
 *  3. Controls (Simple / Dual)  +  Swap Sticks  +  Joystick Type  +  Joy Size
 *  4. HUD Customizer (drag-to-reposition every HUD element)
 *  5. Legal (About / Support / Privacy / Help / Security / Delete Data)
 *  6. Account (Profile, Notifications, Logout)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Switch,
  StyleSheet, Dimensions, Alert, Modal, PanResponder,
  Animated, Platform,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Settings as SettingsIcon, LogOut, User, Shield, Bell,
  CircleHelp, ChevronRight, Info, Mail, Trash2, X,
  Zap, Monitor, Shapes, ChevronLeft,
} from 'lucide-react-native';

const { width: W, height: H } = Dimensions.get('window');

// ─── Types / Defaults ────────────────────────────────────────────────────────

type GraphicsQ = 'Smooth' | 'Standard' | 'Ultra';
type ControlT  = 'simple' | 'dual';
type DualMode  = 'visible' | 'invisible' | 'touch_show';
type FoodStyle = 'planet' | 'old';

interface HudItem { x: number; y: number; scale: number }
interface HudConfig {
  leaderboard:  HudItem;
  minimap:      HudItem;
  massBar:      HudItem;
  deathFeed:    HudItem;
  scoreDisplay: HudItem;
  coinDisplay:  HudItem;
  aliveCount:   HudItem;
  eventText:    HudItem;
  timeDisplay:  HudItem;
  rocketBtn:    HudItem;
}

const DEFAULT_HUD: HudConfig = {
  leaderboard:  { x:2,  y:2,  scale:1 },
  minimap:      { x:80, y:4,  scale:1 },
  massBar:      { x:75, y:80, scale:1 },
  deathFeed:    { x:15, y:16, scale:1 },
  scoreDisplay: { x:28, y:2,  scale:1 },
  coinDisplay:  { x:41, y:2,  scale:1 },
  aliveCount:   { x:54, y:2,  scale:1 },
  eventText:    { x:45, y:12, scale:1 },
  timeDisplay:  { x:62, y:2,  scale:1 },
  rocketBtn:    { x:72, y:15, scale:1 },
};

interface JoyPos { left:{x:number;y:number}; right:{x:number;y:number} }
const DEFAULT_JOY_POS: JoyPos = { left:{x:25,y:75}, right:{x:75,y:75} };

// ─── HUD label config ─────────────────────────────────────────────────────────

const HUD_ITEMS: { key: keyof HudConfig; label: string; color: string; w: number; h: number }[] = [
  { key:'leaderboard',  label:'LEADERBOARD', color:'rgba(234,179,8,0.5)',   w:96,  h:96  },
  { key:'minimap',      label:'MINIMAP',     color:'rgba(168,85,247,0.5)', w:128, h:128 },
  { key:'massBar',      label:'MASS BAR',    color:'rgba(74,222,128,0.5)',  w:160, h:48  },
  { key:'deathFeed',    label:'DEATH FEED',  color:'rgba(239,68,68,0.5)',   w:144, h:64  },
  { key:'scoreDisplay', label:'⭐ SCORE',    color:'rgba(168,85,247,0.5)', w:96,  h:40  },
  { key:'coinDisplay',  label:'🪙 COINS',   color:'rgba(234,179,8,0.5)',   w:96,  h:40  },
  { key:'aliveCount',   label:'👥 ALIVE',   color:'rgba(239,68,68,0.5)',   w:96,  h:40  },
  { key:'eventText',    label:'EVENT MSG',   color:'rgba(34,211,238,0.5)', w:128, h:32  },
  { key:'timeDisplay',  label:'⏱ TIME',     color:'rgba(59,130,246,0.5)', w:96,  h:40  },
  { key:'rocketBtn',    label:'SURGE',       color:'rgba(249,115,22,0.5)', w:56,  h:56  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadSetting<T>(key: string, fallback: T): Promise<T> {
  const v = await AsyncStorage.getItem(key);
  if (v === null) return fallback;
  try { return JSON.parse(v) as T; } catch { return v as unknown as T; }
}

// ─── Settings Screen ──────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { user, userData, logout } = useAuth();

  // ── Settings state
  const [graphics,    setGraphics]    = useState<GraphicsQ>('Standard');
  const [foodStyle,   setFoodStyle]   = useState<FoodStyle>('planet');
  const [controlType, setControlType] = useState<ControlT>('dual');
  const [swapStick,   setSwapStick]   = useState(false);
  const [dualMode,    setDualMode]    = useState<DualMode>('visible');
  const [joySize,     setJoySize]     = useState(130);
  const [hudConfig,   setHudConfig]   = useState<HudConfig>(DEFAULT_HUD);
  const [joyPos,      setJoyPos]      = useState<JoyPos>(DEFAULT_JOY_POS);
  const [notifOn,     setNotifOn]     = useState(true);

  // ── UI state
  const [hudEditorOpen, setHudEditorOpen] = useState(false);
  const [activeHudKey,  setActiveHudKey]  = useState<keyof HudConfig | 'joystick'>('joystick');
  const [legalModal,    setLegalModal]    = useState<string | null>(null);

  // Load persisted values
  useEffect(() => {
    (async () => {
      const [g, fs, ct, sw, dm, js, hc, jp] = await Promise.all([
        loadSetting('bh_graphics',  'Standard'),
        loadSetting('bh_foodStyle', 'planet'),
        loadSetting('control',      'dual'),
        loadSetting('swapStick',    false),
        loadSetting('bh_dualMode',  'visible'),
        loadSetting('bh_joySize',   130),
        loadSetting('bh_hudConfig', DEFAULT_HUD),
        loadSetting('bh_joyPos',    DEFAULT_JOY_POS),
      ]);
      setGraphics(g as GraphicsQ);
      setFoodStyle(fs as FoodStyle);
      setControlType(ct as ControlT);
      setSwapStick(sw as boolean);
      setDualMode(dm as DualMode);
      setJoySize(Number(js));
      setHudConfig({ ...DEFAULT_HUD, ...(hc as HudConfig) });
      setJoyPos(jp as JoyPos);
    })();
  }, []);

  // Persist on change
  useEffect(() => { AsyncStorage.setItem('bh_graphics',  graphics); },    [graphics]);
  useEffect(() => { AsyncStorage.setItem('bh_foodStyle', foodStyle); },   [foodStyle]);
  useEffect(() => { AsyncStorage.setItem('control',      controlType); }, [controlType]);
  useEffect(() => { AsyncStorage.setItem('swapStick',    JSON.stringify(swapStick)); }, [swapStick]);
  useEffect(() => { AsyncStorage.setItem('bh_dualMode',  dualMode); },   [dualMode]);
  useEffect(() => { AsyncStorage.setItem('bh_joySize',   String(joySize)); }, [joySize]);
  useEffect(() => { AsyncStorage.setItem('bh_hudConfig', JSON.stringify(hudConfig)); }, [hudConfig]);
  useEffect(() => { AsyncStorage.setItem('bh_joyPos',    JSON.stringify(joyPos)); },   [joyPos]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text:'Cancel', style:'cancel' },
      { text:'Logout', style:'destructive', onPress: async () => {
        try { await logout(); } catch (e) { console.error(e); }
      }},
    ]);
  };

  const handleDeleteData = () => {
    Alert.alert('Delete Data', 'This will clear all local game data. Continue?', [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
        await AsyncStorage.multiRemove([
          'bh_graphics','bh_foodStyle','control','swapStick',
          'bh_dualMode','bh_joySize','bh_hudConfig','bh_joyPos',
          'bh_inventory','bh_stats','bh_lastClaimDate','bh_claimDayCount',
          'collector_level','collector_xp','theme',
        ]);
        Alert.alert('Done','All local data cleared.');
      }},
    ]);
  };

  const resetHud = () => {
    setHudConfig(DEFAULT_HUD);
    setJoyPos(DEFAULT_JOY_POS);
    setJoySize(130);
  };

  // ── Joystick size slider (simple touch range)
  const joySliderWidth = W - 64;
  const joySliderPct   = (joySize - 80) / (220 - 80);

  const joySliderPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, { moveX }) => {
      const pct   = Math.max(0, Math.min(1, (moveX - 32) / joySliderWidth));
      const newSz = Math.round(80 + pct * (220 - 80));
      setJoySize(newSz);
    },
  })).current;

  // ─── Section renderer ────────────────────────────────────────────────────

  const SectionLabel = ({ title }: { title: string }) => (
    <Text style={S.sectionLabel}>{title}</Text>
  );

  const Row = ({ icon: Icon, title, subtitle, onPress, right }: {
    icon: any; title: string; subtitle?: string; onPress?: () => void; right?: React.ReactNode;
  }) => (
    <TouchableOpacity style={S.row} onPress={onPress} disabled={!onPress && !right}>
      <View style={S.rowIcon}><Icon color="#a855f7" size={20} /></View>
      <View style={S.rowText}>
        <Text style={S.rowTitle}>{title}</Text>
        {subtitle && <Text style={S.rowSub}>{subtitle}</Text>}
      </View>
      {right ?? (onPress ? <ChevronRight color="#94a3b8" size={18} /> : null)}
    </TouchableOpacity>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ScreenContainer containerClassName="bg-slate-950">
      <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Back button */}
        <TouchableOpacity style={{ flexDirection:'row', alignItems:'center', gap:4, marginBottom:8 }} onPress={() => router.back()}>
          <ChevronLeft size={20} color="#a855f7" />
          <Text style={{ color:'#a855f7', fontSize:13, fontWeight:'700' }}>Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={S.header}>
          <SettingsIcon color="#a855f7" size={28} />
          <Text style={S.headerTitle}>SETTINGS</Text>
        </View>
        <Text style={S.headerSub}>Configure your experience</Text>

        {/* ── 1. Graphics Quality ── */}
        <SectionLabel title="GRAPHICS QUALITY" />
        <View style={S.card}>
          <View style={S.graphicsRow}>
            {(['Smooth','Standard','Ultra'] as GraphicsQ[]).map(q => {
              const active = graphics === q;
              const col = q==='Ultra' ? '#a855f7' : q==='Standard' ? '#06b6d4' : '#22c55e';
              return (
                <TouchableOpacity key={q}
                  style={[S.graphicsBtn, active && { backgroundColor: col+'33', borderColor: col }]}
                  onPress={() => setGraphics(q)}
                >
                  <Text style={[S.graphicsBtnTxt, active && { color: col }]}>{q}</Text>
                  <Text style={[S.graphicsBtnSub, active && { color: col+'99' }]}>
                    {q==='Smooth'?'Zero Lag':q==='Standard'?'Balanced':'High End'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 2. Food Style ── */}
        <SectionLabel title="FOOD STYLE" />
        <View style={S.card}>
          <View style={S.foodRow}>
            {([['planet','🪐 Planet'],['old','⭐ Classic']] as [FoodStyle,string][]).map(([val,lbl]) => (
              <TouchableOpacity key={val}
                style={[S.foodBtn, foodStyle===val && S.foodBtnActive]}
                onPress={() => setFoodStyle(val)}
              >
                <Text style={[S.foodBtnTxt, foodStyle===val && S.foodBtnTxtActive]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── 3. Controls ── */}
        <SectionLabel title="CONTROLS" />
        <View style={S.card}>
          {/* Control type */}
          <View style={S.settingRow}>
            <Text style={S.settingLbl}>Controls</Text>
            <View style={S.toggleGroup}>
              {(['simple','dual'] as ControlT[]).map(c => (
                <TouchableOpacity key={c}
                  style={[S.toggleBtn, controlType===c && S.toggleBtnActive]}
                  onPress={() => setControlType(c)}
                >
                  <Text style={[S.toggleBtnTxt, controlType===c && S.toggleBtnTxtActive]}>
                    {c.charAt(0).toUpperCase()+c.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {controlType === 'dual' && (
            <>
              {/* Swap sticks */}
              <View style={S.settingRow}>
                <Text style={S.settingLbl}>Swap Sticks</Text>
                <TouchableOpacity
                  style={[S.switchTrack, swapStick && S.switchTrackOn]}
                  onPress={() => setSwapStick(v => !v)}
                >
                  <Animated.View style={[S.switchThumb, swapStick && S.switchThumbOn]} />
                </TouchableOpacity>
              </View>

              {/* Joystick type */}
              <View style={S.settingRow}>
                <Text style={S.settingLbl}>Joystick Type</Text>
                <View style={S.toggleGroup}>
                  {([['visible','Visible'],['invisible','Invis.'],['touch_show','Touch']] as [DualMode,string][]).map(([v,l]) => (
                    <TouchableOpacity key={v}
                      style={[S.toggleBtn, dualMode===v && S.toggleBtnActive]}
                      onPress={() => setDualMode(v)}
                    >
                      <Text style={[S.toggleBtnTxt, dualMode===v && S.toggleBtnTxtActive]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Joystick size */}
              <View style={S.settingColWrap}>
                <View style={S.settingRow}>
                  <Text style={S.settingLbl}>Joystick Size</Text>
                  <Text style={S.settingVal}>{joySize}px</Text>
                </View>
                <View style={S.sliderTrack} {...joySliderPan.panHandlers}>
                  <View style={[S.sliderFill, { width: `${joySliderPct * 100}%` as any }]} />
                  <View style={[S.sliderThumb, { left: `${Math.max(0, joySliderPct * 100 - 2)}%` as any }]} />
                </View>
                <View style={S.sliderLabels}>
                  <Text style={S.sliderLbl}>80</Text>
                  <Text style={S.sliderLbl}>220</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── 4. HUD Customizer button ── */}
        <SectionLabel title="HUD LAYOUT" />
        <View style={S.card}>
          <TouchableOpacity style={S.hudBtn} onPress={() => setHudEditorOpen(true)}>
            <Monitor size={16} color="#6366f1" />
            <Text style={S.hudBtnTxt}>CUSTOMIZE HUD</Text>
            <Text style={S.hudBtnSub}>Drag HUD elements to reposition</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.resetBtn} onPress={resetHud}>
            <Text style={S.resetBtnTxt}>RESET ALL TO DEFAULT</Text>
          </TouchableOpacity>
        </View>

        {/* ── 5. Account ── */}
        <SectionLabel title="ACCOUNT" />
        <View style={S.card}>
          <View style={S.profileBlock}>
            <View style={S.profileAvatar}>
              <Text style={{ fontSize: 32 }}>👤</Text>
            </View>
            <Text style={S.profileName}>{userData?.name || 'Cosmic Explorer'}</Text>
            <Text style={S.profileMeta}>Level {userData?.level||1} • {(userData?.coins||0).toLocaleString()} Coins</Text>
          </View>
          <Row icon={User} title="Profile Details" subtitle="Manage your identity" onPress={() => {}} />
          <Row icon={Shield} title="Privacy & Security" subtitle="Secure your void" onPress={() => {}} />
          <Row icon={Bell} title="Notifications" subtitle="Stay updated"
            right={
              <Switch value={notifOn} onValueChange={setNotifOn}
                trackColor={{ false:'#1e293b', true:'#a855f7' }} thumbColor="#f8fafc" />
            }
          />
          <Row icon={CircleHelp} title="Help & Support" subtitle="Contact the void" onPress={() => {}} />
        </View>

        {/* ── 6. Legal ── */}
        <SectionLabel title="LEGAL & INFO" />
        <View style={[S.card, { gap: 8 }]}>
          <View style={S.legalGrid}>
            {([
              { key:'about',    label:'ABOUT',    icon:Info,    color:'#a855f7' },
              { key:'support',  label:'SUPPORT',  icon:Mail,    color:'#22c55e' },
              { key:'privacy',  label:'PRIVACY',  icon:Shield,  color:'#60a5fa' },
              { key:'help',     label:'HELP',     icon:CircleHelp, color:'#facc15' },
            ] as const).map(item => (
              <TouchableOpacity key={item.key} style={S.legalBtn}
                onPress={() => setLegalModal(item.key)}>
                <item.icon size={14} color={item.color} />
                <Text style={[S.legalBtnTxt, { color: item.color }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={S.deleteBtn} onPress={handleDeleteData}>
            <Trash2 size={14} color="#ef4444" />
            <Text style={S.deleteBtnTxt}>DELETE LOCAL DATA</Text>
          </TouchableOpacity>
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={S.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color="#ef4444" />
          <Text style={S.logoutTxt}>LOGOUT FROM VOID</Text>
        </TouchableOpacity>

        <Text style={S.version}>Absorbio Mobile v1.0.0</Text>
      </ScrollView>

      {/* ══════════════ HUD EDITOR MODAL ══════════════ */}
      <Modal visible={hudEditorOpen} animationType="slide" onRequestClose={() => setHudEditorOpen(false)}>
        <HudEditor
          hudConfig={hudConfig}
          setHudConfig={setHudConfig}
          joyPos={joyPos}
          setJoyPos={setJoyPos}
          joySize={joySize}
          setJoySize={setJoySize}
          activeKey={activeHudKey}
          setActiveKey={setActiveHudKey}
          defaultHud={DEFAULT_HUD}
          defaultJoyPos={DEFAULT_JOY_POS}
          onClose={() => setHudEditorOpen(false)}
        />
      </Modal>

      {/* ══════════════ LEGAL MODAL ══════════════ */}
      <Modal visible={!!legalModal} transparent animationType="fade"
        onRequestClose={() => setLegalModal(null)}>
        <View style={S.legalBackdrop}>
          <View style={S.legalCard}>
            <View style={S.legalCardHeader}>
              <Text style={S.legalCardTitle}>{legalModal?.toUpperCase()}</Text>
              <TouchableOpacity onPress={() => setLegalModal(null)}>
                <X size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={S.legalText}>{LEGAL_CONTENT[legalModal as string] || 'Coming soon.'}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─── HUD Editor ───────────────────────────────────────────────────────────────

function HudEditor({ hudConfig, setHudConfig, joyPos, setJoyPos, joySize, setJoySize,
  activeKey, setActiveKey, defaultHud, defaultJoyPos, onClose }: {
  hudConfig: HudConfig;
  setHudConfig: (c: HudConfig) => void;
  joyPos: JoyPos;
  setJoyPos: (p: JoyPos) => void;
  joySize: number;
  setJoySize: (n: number) => void;
  activeKey: keyof HudConfig | 'joystick';
  setActiveKey: (k: keyof HudConfig | 'joystick') => void;
  defaultHud: HudConfig;
  defaultJoyPos: JoyPos;
  onClose: () => void;
}) {
  const editorRef = useRef<View>(null);

  const resetItem = () => {
    if (activeKey === 'joystick') {
      setJoyPos(defaultJoyPos);
      setJoySize(130);
    } else {
      setHudConfig({ ...hudConfig, [activeKey]: defaultHud[activeKey] });
    }
  };

  const resetAll = () => {
    setHudConfig(defaultHud);
    setJoyPos(defaultJoyPos);
    setJoySize(130);
  };

  // Scale slider
  const scaleSliderW = W * 0.5;
  const activeScale  = activeKey === 'joystick' ? null : hudConfig[activeKey]?.scale ?? 1;
  const scalePct     = activeKey === 'joystick'
    ? (joySize - 80) / (220 - 80)
    : ((activeScale || 1) - 0.5) / (2 - 0.5);

  const scaleSliderPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, { moveX }) => {
      const pct = Math.max(0, Math.min(1, (moveX - (W - scaleSliderW) / 2) / scaleSliderW));
      if (activeKey === 'joystick') {
        setJoySize(Math.round(80 + pct * (220 - 80)));
      } else {
        const newScale = parseFloat((0.5 + pct * 1.5).toFixed(1));
        setHudConfig({ ...hudConfig, [activeKey]: { ...hudConfig[activeKey], scale: newScale } });
      }
    },
  })).current;

  // Makes a draggable HUD element
  const makePan = (key: keyof HudConfig | 'joystick_left' | 'joystick_right') => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setActiveKey(key === 'joystick_left' || key === 'joystick_right' ? 'joystick' : key as keyof HudConfig);
      },
      onPanResponderMove: (e, { moveX, moveY }) => {
        const px = Math.max(0, Math.min(90, (moveX / W) * 100));
        const py = Math.max(0, Math.min(90, (moveY / H) * 100));
        if (key === 'joystick_left') {
          setJoyPos(p => ({ ...p, left: { x: Math.min(45, px), y: py } }));
        } else if (key === 'joystick_right') {
          setJoyPos(p => ({ ...p, right: { x: Math.max(55, px), y: py } }));
        } else {
          setHudConfig({ ...hudConfig, [key]: { ...hudConfig[key as keyof HudConfig], x: px, y: py } });
        }
      },
    });
  };

  const hudPans   = useRef(Object.fromEntries(HUD_ITEMS.map(h => [h.key, makePan(h.key)]))).current;
  const leftPan   = useRef(makePan('joystick_left')).current;
  const rightPan  = useRef(makePan('joystick_right')).current;

  return (
    <View style={SE.root}>
      {/* Top nav */}
      <View style={SE.topNav}>
        <TouchableOpacity style={SE.navBtnBack} onPress={onClose}>
          <Text style={SE.navBtnBackTxt}>BACK</Text>
        </TouchableOpacity>
        <View style={SE.navRight}>
          <TouchableOpacity style={SE.navBtnOrange} onPress={resetItem}>
            <Text style={SE.navBtnTxt}>RESET ITEM</Text>
          </TouchableOpacity>
          <TouchableOpacity style={SE.navBtnRed} onPress={resetAll}>
            <Text style={SE.navBtnTxt}>RESET ALL</Text>
          </TouchableOpacity>
          <TouchableOpacity style={SE.navBtnGreen} onPress={onClose}>
            <Text style={SE.navBtnTxt}>SAVE ✓</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scale slider (floating, centered) */}
      <View style={SE.sliderFloating} {...scaleSliderPan.panHandlers}>
        <View style={SE.sliderHandle} />
        <Text style={SE.sliderLabel}>
          {activeKey === 'joystick'
            ? `JOYSTICK (${joySize}px)`
            : `${String(activeKey).replace(/([A-Z])/g,' $1').trim().toUpperCase()} (${activeScale?.toFixed(1)}x)`}
        </Text>
        <View style={SE.sliderTrack}>
          <View style={[SE.sliderFill, { width: `${scalePct * 100}%` as any }]} />
          <View style={[SE.sliderThumb, { left: `${Math.max(0, scalePct * 100 - 3)}%` as any }]} />
        </View>
      </View>

      {/* Watermark */}
      <View style={SE.watermark} pointerEvents="none">
        <Text style={SE.watermarkTxt}>TAP TO SELECT{'\n'}DRAG TO MOVE</Text>
      </View>

      {/* ── Draggable HUD elements ── */}
      {HUD_ITEMS.map(item => {
        const cfg = hudConfig[item.key];
        const sel = activeKey === item.key;
        return (
          <View key={item.key} {...hudPans[item.key].panHandlers}
            style={[SE.hudEl, {
              left: `${cfg.x}%` as any,
              top:  `${cfg.y}%` as any,
              width: item.w, height: item.h,
              transform: [{ scale: cfg.scale }],
              backgroundColor: item.color,
              borderColor: sel ? '#fff' : item.color.replace('0.5)','0.8)'),
              borderWidth: sel ? 2 : 2,
              borderStyle: sel ? 'solid' : 'dashed',
              zIndex: sel ? 50 : 40,
            }]}
          >
            <Text style={SE.hudElTxt}>{item.label}</Text>
          </View>
        );
      })}

      {/* ── Left Joystick ── */}
      <View {...leftPan.panHandlers} style={[SE.joyEl, SE.joyLeft, {
        left:   `${joyPos.left.x}%` as any,
        top:    `${joyPos.left.y}%` as any,
        width:  joySize, height: joySize, borderRadius: joySize / 2,
        borderColor: activeKey==='joystick' ? '#fff' : 'rgba(96,165,250,0.6)',
        borderStyle: activeKey==='joystick' ? 'solid' : 'dashed',
        zIndex: activeKey==='joystick' ? 50 : 40,
      }]}>
        <Text style={SE.joyTxt}>AIM{'\n'}MOVE</Text>
      </View>

      {/* ── Right Joystick ── */}
      <View {...rightPan.panHandlers} style={[SE.joyEl, SE.joyRight, {
        left:   `${joyPos.right.x}%` as any,
        top:    `${joyPos.right.y}%` as any,
        width:  joySize, height: joySize, borderRadius: joySize / 2,
        borderColor: activeKey==='joystick' ? '#fff' : 'rgba(236,72,153,0.6)',
        borderStyle: activeKey==='joystick' ? 'solid' : 'dashed',
        zIndex: activeKey==='joystick' ? 50 : 40,
      }]}>
        <Text style={SE.joyTxt}>MOVE{'\n'}AIM</Text>
      </View>
    </View>
  );
}

// ─── Legal content ────────────────────────────────────────────────────────────

const LEGAL_CONTENT: Record<string, string> = {
  about:   'Absorbio is a space-themed mobile game where you absorb food and battle bots in a cosmic arena. Built with React Native + Expo.\n\nVersion: 1.0.0',
  support: 'For support, reach out via the app store listing or contact us at support@absorbio.app.\n\nWe typically respond within 48 hours.',
  privacy: 'We collect minimal data: your display name, score, and coins when you sign in. Guest data is stored locally on device only.\n\nWe never sell your data to third parties.',
  help:    'How to play:\n• Use dual joysticks to move and aim\n• Absorb smaller food orbs to grow\n• Avoid larger players\n• Collect coins to buy upgrades in the shop\n• Survive the shrinking zone in Survival mode',
  security: 'Your account is secured via Firebase Authentication. We use industry-standard encryption for all data in transit.\n\nNever share your login credentials.',
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  header: { flexDirection:'row', alignItems:'center', gap:10, marginBottom:4 },
  headerTitle: { fontSize:26, fontWeight:'900', color:'#fff', fontStyle:'italic', letterSpacing:2 },
  headerSub: { fontSize:10, color:'rgba(168,85,247,0.6)', fontWeight:'700', letterSpacing:3, textTransform:'uppercase', marginBottom:24 },

  sectionLabel: { fontSize:9, color:'rgba(168,85,247,0.5)', fontWeight:'900', letterSpacing:3,
    textTransform:'uppercase', marginBottom:8, marginLeft:2, marginTop:16 },

  card: { backgroundColor:'rgba(255,255,255,0.04)', borderRadius:18, padding:14,
    borderWidth:1, borderColor:'rgba(255,255,255,0.08)', marginBottom:2 },

  // Graphics
  graphicsRow: { flexDirection:'row', gap:8 },
  graphicsBtn: { flex:1, paddingVertical:10, borderRadius:12, alignItems:'center',
    borderWidth:1, borderColor:'rgba(255,255,255,0.1)', backgroundColor:'transparent' },
  graphicsBtnTxt: { color:'#9ca3af', fontWeight:'700', fontSize:12 },
  graphicsBtnSub: { color:'#4b5563', fontSize:8, fontWeight:'600', marginTop:2 },

  // Food
  foodRow: { flexDirection:'row', gap:8 },
  foodBtn: { flex:1, paddingVertical:10, borderRadius:12, alignItems:'center',
    borderWidth:1, borderColor:'rgba(255,255,255,0.1)', backgroundColor:'transparent' },
  foodBtnActive: { borderColor:'#a855f7', backgroundColor:'rgba(168,85,247,0.15)' },
  foodBtnTxt: { color:'#9ca3af', fontWeight:'700', fontSize:13 },
  foodBtnTxtActive: { color:'#fff' },

  // Settings rows
  settingRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingVertical:8, borderBottomWidth:1, borderColor:'rgba(255,255,255,0.05)' },
  settingLbl: { color:'#d1d5db', fontSize:13, fontWeight:'700' },
  settingVal:  { color:'#a855f7', fontSize:12, fontWeight:'700' },
  settingColWrap: { paddingTop:8 },
  toggleGroup: { flexDirection:'row', gap:6 },
  toggleBtn: { paddingHorizontal:12, paddingVertical:6, borderRadius:10,
    backgroundColor:'rgba(255,255,255,0.05)', borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  toggleBtnActive: { backgroundColor:'rgba(168,85,247,0.25)', borderColor:'#a855f7' },
  toggleBtnTxt: { color:'#6b7280', fontSize:11, fontWeight:'700' },
  toggleBtnTxtActive: { color:'#e9d5ff' },

  // Switch
  switchTrack: { width:42, height:22, borderRadius:11, backgroundColor:'#1e293b',
    padding:2, justifyContent:'center' },
  switchTrackOn: { backgroundColor:'#7c3aed' },
  switchThumb: { width:18, height:18, borderRadius:9, backgroundColor:'#f8fafc' },
  switchThumbOn: { transform:[{translateX:20}] },

  // Slider
  sliderTrack: { height:6, backgroundColor:'#1e293b', borderRadius:3,
    overflow:'hidden', marginTop:8, position:'relative' },
  sliderFill: { height:'100%', backgroundColor:'#a855f7', borderRadius:3 },
  sliderThumb: { position:'absolute', top:-5, width:16, height:16, borderRadius:8,
    backgroundColor:'#fff', borderWidth:2, borderColor:'#a855f7' },
  sliderLabels: { flexDirection:'row', justifyContent:'space-between', marginTop:4 },
  sliderLbl: { color:'#4b5563', fontSize:9, fontWeight:'700' },

  // HUD button
  hudBtn: { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:12,
    backgroundColor:'rgba(99,102,241,0.1)', borderRadius:12,
    borderWidth:1, borderColor:'rgba(99,102,241,0.3)', paddingHorizontal:14, marginBottom:8 },
  hudBtnTxt: { color:'#818cf8', fontWeight:'900', fontSize:12, letterSpacing:2, flex:1 },
  hudBtnSub: { color:'#4b5563', fontSize:9 },
  resetBtn: { paddingVertical:8, borderRadius:10, alignItems:'center',
    borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },
  resetBtnTxt: { color:'#6b7280', fontSize:10, fontWeight:'700', letterSpacing:1 },

  // Profile block
  profileBlock: { alignItems:'center', paddingVertical:16, marginBottom:8,
    borderBottomWidth:1, borderColor:'rgba(255,255,255,0.06)' },
  profileAvatar: { width:72, height:72, borderRadius:36, backgroundColor:'rgba(168,85,247,0.15)',
    borderWidth:2, borderColor:'rgba(168,85,247,0.3)',
    alignItems:'center', justifyContent:'center', marginBottom:10 },
  profileName: { color:'#fff', fontWeight:'900', fontSize:18, letterSpacing:1 },
  profileMeta: { color:'#a855f7', fontSize:11, fontWeight:'700', letterSpacing:1, marginTop:3 },

  // Row
  row: { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12,
    borderBottomWidth:1, borderColor:'rgba(255,255,255,0.05)' },
  rowIcon: { width:36, height:36, borderRadius:18, backgroundColor:'rgba(168,85,247,0.15)',
    alignItems:'center', justifyContent:'center' },
  rowText: { flex:1 },
  rowTitle: { color:'#fff', fontWeight:'700', fontSize:13 },
  rowSub:   { color:'rgba(168,85,247,0.5)', fontSize:9, fontWeight:'700', letterSpacing:1,
    textTransform:'uppercase', marginTop:1 },

  // Legal grid
  legalGrid: { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:8 },
  legalBtn: { flexDirection:'row', alignItems:'center', gap:6,
    width:'47%', paddingVertical:10, paddingHorizontal:12,
    backgroundColor:'rgba(255,255,255,0.04)', borderRadius:12,
    borderWidth:1, borderColor:'rgba(255,255,255,0.06)' },
  legalBtnTxt: { fontSize:10, fontWeight:'700', letterSpacing:1 },
  deleteBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
    paddingVertical:10, backgroundColor:'rgba(239,68,68,0.08)',
    borderRadius:12, borderWidth:1, borderColor:'rgba(239,68,68,0.2)' },
  deleteBtnTxt: { color:'#ef4444', fontSize:10, fontWeight:'700', letterSpacing:1 },

  // Logout
  logoutBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10,
    paddingVertical:14, backgroundColor:'rgba(239,68,68,0.08)',
    borderRadius:16, borderWidth:1, borderColor:'rgba(239,68,68,0.25)',
    marginTop:20, marginBottom:12 },
  logoutTxt: { color:'#ef4444', fontWeight:'900', fontSize:13, letterSpacing:2 },
  version: { color:'rgba(168,85,247,0.2)', fontSize:9, textAlign:'center',
    fontWeight:'700', letterSpacing:2, textTransform:'uppercase', marginBottom:8 },

  // Legal modal
  legalBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.85)', justifyContent:'center',
    alignItems:'center', padding:20 },
  legalCard: { backgroundColor:'#0f172a', borderRadius:20, padding:20, width:'100%', maxHeight:'70%',
    borderWidth:1, borderColor:'rgba(168,85,247,0.3)' },
  legalCardHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  legalCardTitle: { color:'#fff', fontWeight:'900', fontSize:16, letterSpacing:3 },
  legalText: { color:'#9ca3af', fontSize:13, lineHeight:22 },
});

// HUD Editor styles
const SE = StyleSheet.create({
  root: { flex:1, backgroundColor:'rgba(15,23,42,0.97)', overflow:'hidden' },

  topNav: { position:'absolute', top: Platform.OS==='ios'?44:28, left:0, right:0,
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingHorizontal:12, zIndex:100 },
  navBtnBack: { backgroundColor:'rgba(88,28,135,0.85)', paddingHorizontal:14, paddingVertical:7,
    borderRadius:10, borderWidth:1, borderColor:'#a855f7' },
  navBtnBackTxt: { color:'#fff', fontWeight:'900', fontSize:10, letterSpacing:2 },
  navRight: { flexDirection:'row', gap:6 },
  navBtnOrange: { backgroundColor:'rgba(234,88,12,0.85)', paddingHorizontal:10, paddingVertical:7,
    borderRadius:10, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  navBtnRed: { backgroundColor:'rgba(185,28,28,0.85)', paddingHorizontal:10, paddingVertical:7,
    borderRadius:10, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  navBtnGreen: { backgroundColor:'rgba(21,128,61,0.85)', paddingHorizontal:14, paddingVertical:7,
    borderRadius:10, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  navBtnTxt: { color:'#fff', fontWeight:'700', fontSize:9, letterSpacing:1 },

  sliderFloating: {
    position:'absolute', alignSelf:'center', left:'25%', bottom:'10%',
    backgroundColor:'rgba(0,0,0,0.75)', paddingHorizontal:16, paddingVertical:10,
    borderRadius:20, borderWidth:1, borderColor:'rgba(255,255,255,0.2)',
    zIndex:110, minWidth:200, alignItems:'center', gap:6,
  },
  sliderHandle: { width:32, height:4, backgroundColor:'#6b7280', borderRadius:2 },
  sliderLabel: { color:'#c4b5fd', fontWeight:'700', fontSize:9, letterSpacing:2, textTransform:'uppercase' },
  sliderTrack: { width:'100%', height:6, backgroundColor:'#1e293b', borderRadius:3, position:'relative', overflow:'hidden' },
  sliderFill: { height:'100%', backgroundColor:'#a855f7', borderRadius:3 },
  sliderThumb: { position:'absolute', top:-5, width:16, height:16, borderRadius:8, backgroundColor:'#fff', borderWidth:2, borderColor:'#a855f7' },

  watermark: { ...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center', pointerEvents:'none' },
  watermarkTxt: { color:'rgba(255,255,255,0.07)', fontSize:24, fontWeight:'900',
    textAlign:'center', lineHeight:40, letterSpacing:3 },

  hudEl: { position:'absolute', borderRadius:12, alignItems:'center',
    justifyContent:'center', backdropFilter:'blur(4px)' },
  hudElTxt: { color:'#fff', fontWeight:'900', fontSize:9, letterSpacing:1, textTransform:'uppercase' },

  joyEl: { position:'absolute', alignItems:'center', justifyContent:'center',
    borderWidth:2, backgroundColor:'transparent' },
  joyLeft:  { backgroundColor:'rgba(96,165,250,0.15)' },
  joyRight: { backgroundColor:'rgba(236,72,153,0.15)' },
  joyTxt: { color:'#fff', fontWeight:'900', fontSize:8, letterSpacing:1,
    textAlign:'center', textTransform:'uppercase', lineHeight:14 },
});
