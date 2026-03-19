import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, Alert, Animated, Easing, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';

const { width: W, height: H } = Dimensions.get('window');

// ─── Conditional Skia import (only native) ────────────────────────────────────

let SkiaCanvas: any = null;
let SkiaCircle: any = null;
let SkiaPath: any = null;
let SkiaRadialGradient: any = null;
let skiaVec: any = null;
let SkiaLib: any = null;

if (Platform.OS !== 'web') {
  try {
    const skia = require('@shopify/react-native-skia');
    SkiaCanvas = skia.Canvas;
    SkiaCircle = skia.Circle;
    SkiaPath   = skia.Path;
    SkiaRadialGradient = skia.RadialGradient;
    skiaVec    = skia.vec;
    SkiaLib    = skia.Skia;
  } catch (e) {
    // Skia not available
  }
}

// ─── Animated Stars Background ───────────────────────────────────────────────

function NebulaBg() {
  const [, setTick] = useState(0);
  const stars = useRef(
    Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5, alpha: Math.random(),
    }))
  );

  useEffect(() => {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      stars.current.forEach(s => {
        s.alpha = Math.max(0.1, Math.min(1, s.alpha + (Math.random() - 0.5) * 0.04));
      });
      setTick(t => t + 1);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { alive = false; };
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Native: use Skia Canvas with animated stars */}
      {Platform.OS !== 'web' && SkiaCanvas && SkiaLib ? (
        <NebulaBgNative stars={stars.current} />
      ) : (
        /* Web fallback: plain gradient + blobs */
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0a0020' }]}>
          <View style={[S.blob, { top: H*0.1, left: -60, backgroundColor: 'rgba(168,85,247,0.2)' }]} />
          <View style={[S.blob, { top: H*0.2, left: W*0.1, backgroundColor: 'rgba(236,72,153,0.12)', width:200, height:200 }]} />
          <View style={[S.blob, { bottom: H*0.1, right: -60, backgroundColor: 'rgba(59,130,246,0.2)' }]} />
          <View style={[S.blob, { bottom: H*0.2, right: W*0.1, backgroundColor: 'rgba(34,211,238,0.12)', width:200, height:200 }]} />
        </View>
      )}
    </View>
  );
}

function NebulaBgNative({ stars }: { stars: any[] }) {
  const bgPath = SkiaLib.Path.Make();
  bgPath.addRect({ x: 0, y: 0, width: W, height: H });

  return (
    <SkiaCanvas style={{ flex: 1 }}>
      {/* Dark gradient background */}
      <SkiaPath path={bgPath}>
        <SkiaRadialGradient
          c={skiaVec(W / 2, H / 2)} r={W * 0.9}
          colors={['#1a0035', '#0a0020', '#000010']}
        />
      </SkiaPath>
      {/* Twinkling stars */}
      {stars.map((s, i) => (
        <SkiaCircle key={i} cx={s.x} cy={s.y} r={Math.max(0.4, s.r)}
          color={`rgba(255,255,255,${s.alpha.toFixed(2)})`} />
      ))}
    </SkiaCanvas>
  );
}

// ─── Spinning Ring ─────────────────────────────────────────────────────────────

function SpinRing({ size, dur, reverse = false, color = 'rgba(255,255,255,0.6)', dashed = false }: {
  size: number; dur: number; reverse?: boolean; color?: string; dashed?: boolean;
}) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: dur, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, []);
  const rotate = rot.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'],
  });
  const r = size / 2;
  return (
    <Animated.View style={{
      position: 'absolute',
      width: size, height: size, borderRadius: r,
      borderWidth: dashed ? 1.5 : 2,
      borderColor: color,
      borderStyle: dashed ? 'dashed' : 'solid',
      top: -(size - 40) / 2,
      left: -(size - 40) / 2,
      transform: [{ rotate }],
    }} />
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithGoogle, signInWithFacebook, signInAsGuest, loading } = useAuth();
  const [activeLoading, setActiveLoading] = useState<string | null>(null);

  // Breathing sphere animation
  const breathAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(breathAnim, { toValue: 1, duration: 2500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(breathAnim, { toValue: 0, duration: 2500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ])).start();
  }, []);
  const breathScale = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1.08] });

  const go = async (provider: 'google' | 'facebook' | 'guest') => {
    try {
      setActiveLoading(provider);
      if (provider === 'google')   await signInWithGoogle();
      if (provider === 'facebook') await signInWithFacebook();
      if (provider === 'guest')    await signInAsGuest();
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Error', `${provider} sign-in failed. Please try again.`);
    } finally {
      setActiveLoading(null);
    }
  };

  if (loading) return (
    <View style={[S.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color="#a855f7" />
    </View>
  );

  return (
    <View style={S.root}>
      {/* Animated nebula background */}
      <NebulaBg />

      <View style={S.inner}>
        {/* ── Logo section ── */}
        <View style={S.logoSection}>
          <Animated.View style={[S.sphereWrap, { transform: [{ scale: breathScale }] }]}>
            <View style={S.sphereCore} />
            <SpinRing size={100} dur={8000}  color="rgba(168,85,247,0.7)" />
            <SpinRing size={120} dur={12000} color="rgba(56,189,248,0.5)" dashed />
            <SpinRing size={140} dur={20000} color="rgba(255,255,255,0.2)" dashed reverse />
          </Animated.View>

          <Text style={S.appName}>ABSORBIO</Text>
          <Text style={S.tagline}>ENTER THE VOID</Text>
        </View>

        {/* ── Login card ── */}
        <View style={S.card}>
          <Text style={S.cardTitle}>WELCOME BACK</Text>

          {/* Google */}
          <TouchableOpacity
            style={[S.googleBtn, !!activeLoading && S.btnDisabled]}
            onPress={() => go('google')}
            disabled={!!activeLoading}
            activeOpacity={0.85}
          >
            {activeLoading === 'google'
              ? <ActivityIndicator size="small" color="#000" />
              : <Text style={S.googleBtnTxt}>G</Text>
            }
            <Text style={S.googleTxt}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Facebook */}
          <TouchableOpacity
            style={[S.fbBtn, !!activeLoading && S.btnDisabled]}
            onPress={() => go('facebook')}
            disabled={!!activeLoading}
            activeOpacity={0.85}
          >
            {activeLoading === 'facebook'
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={S.fbIcon}>f</Text>
            }
            <Text style={S.fbTxt}>Continue with Facebook</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={S.divRow}>
            <View style={S.divLine} />
            <Text style={S.divTxt}>OR</Text>
            <View style={S.divLine} />
          </View>

          {/* Guest */}
          <TouchableOpacity
            style={[S.guestBtn, !!activeLoading && S.btnDisabled]}
            onPress={() => go('guest')}
            disabled={!!activeLoading}
            activeOpacity={0.85}
          >
            {activeLoading === 'guest' && <ActivityIndicator size="small" color="#fff" />}
            <Text style={S.guestTxt}>Play as Guest</Text>
          </TouchableOpacity>

          {/* Legal */}
          <View style={S.legalBox}>
            <Text style={S.legalTxt}>
              By continuing, you agree to our Terms of Service and Privacy Policy.{'\n'}
              Guest data saves locally on this device.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000010' },

  blob: { position: 'absolute', width: 280, height: 280, borderRadius: 140 },

  inner: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, gap: 32,
  },

  // Logo
  logoSection: { alignItems: 'center', gap: 16 },
  sphereWrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  sphereCore: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#000',
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 0 },
    shadowRadius: 30, shadowOpacity: 0.9, elevation: 15,
  },
  appName: {
    fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: 6,
    textShadowColor: 'rgba(168,85,247,0.6)', textShadowRadius: 20,
  },
  tagline: {
    fontSize: 11, fontWeight: '700',
    color: 'rgba(168,85,247,0.6)', letterSpacing: 6,
  },

  // Card
  card: {
    width: '100%', maxWidth: 380,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 28, padding: 24, gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  cardTitle: {
    color: '#fff', fontWeight: '900', fontSize: 15,
    textAlign: 'center', letterSpacing: 4, marginBottom: 4,
  },

  // Buttons
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', paddingVertical: 14,
    paddingHorizontal: 20, borderRadius: 18,
  },
  googleBtnTxt: { color: '#000', fontWeight: '900', fontSize: 16 },
  googleTxt:    { color: '#000', fontWeight: '700', fontSize: 14, flex: 1, textAlign: 'center' },

  fbBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1877F2', paddingVertical: 14,
    paddingHorizontal: 20, borderRadius: 18,
  },
  fbIcon: { color: '#fff', fontWeight: '900', fontSize: 18 },
  fbTxt:  { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1, textAlign: 'center' },

  guestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: 18,
    backgroundColor: 'rgba(124,58,237,0.4)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.4)',
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12, shadowOpacity: 0.4, elevation: 6,
  },
  guestTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  btnDisabled: { opacity: 0.55 },

  divRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  divTxt:  { color: 'rgba(168,85,247,0.6)', fontSize: 11, fontWeight: '700' },

  legalBox: { paddingTop: 4, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  legalTxt: {
    color: 'rgba(168,85,247,0.4)', fontSize: 10,
    textAlign: 'center', lineHeight: 16, fontWeight: '500',
  },
});
