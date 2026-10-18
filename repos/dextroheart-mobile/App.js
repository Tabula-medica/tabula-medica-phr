import { Component, useRef, useState } from 'react';
import {
  ActivityIndicator, BackHandler, Platform, SafeAreaView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

const SITE = 'https://dextroheart.com';
const BRAND = '#1a2332';
const ACCENT = '#c0392b';
const APP_NAME = 'DextroHeart';

// Allow pinch-zoom on tablet — critical for waveform review.
const ALLOW_ZOOM_JS =
  "(function(){try{var m=document.querySelector('meta[name=viewport]');" +
  "if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}" +
  "m.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes');" +
  "}catch(e){}})();true;";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.fallback}>
          <StatusBar style="light" />
          <View style={styles.lockBox}>
            <Text style={styles.ecgLine}>♥</Text>
            <Text style={styles.lockLogo}>DextroHeart</Text>
            <Text style={styles.lockSub}>Something went wrong. Check your connection and try again.</Text>
            <TouchableOpacity style={styles.lockBtn} onPress={() => this.setState({ error: null })} accessibilityRole="button" accessibilityLabel="Retry">
              <Text style={styles.lockBtnTxt}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

function AppInner() {
  const webRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);

  // Android hardware back: navigate in-app, then exit.
  if (Platform.OS === 'android') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    require('react').useEffect(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBack && webRef.current) { webRef.current.goBack(); return true; }
        return false;
      });
      return () => sub.remove();
    }, [canGoBack]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" backgroundColor={BRAND} />
      <WebView
        ref={webRef}
        source={{ uri: SITE }}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={ALLOW_ZOOM_JS}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        domStorageEnabled
        javaScriptEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
        startInLoadingState
        style={styles.web}
        onShouldStartLoadWithRequest={(req) => /^https?:\/\//i.test(req.url)}
      />
      {loading && (
        <View style={styles.splash} pointerEvents="none">
          <Text style={styles.splashHeart}>♥</Text>
          <Text style={styles.splashLogo}>{APP_NAME}</Text>
          <Text style={styles.splashSub}>14-Lead ECG · SCG/PCG · Ultrasound</Text>
          <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 28 }} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND },
  web: { flex: 1 },

  splash: { ...StyleSheet.absoluteFillObject, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  splashHeart: { color: ACCENT, fontSize: 52, marginBottom: 8 },
  splashLogo: { color: '#ffffff', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  splashSub: { color: '#94a3b8', fontSize: 14, marginTop: 6, letterSpacing: 0.5 },

  fallback: { flex: 1, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  lockBox: { alignItems: 'center', paddingHorizontal: 36 },
  ecgLine: { color: ACCENT, fontSize: 48, marginBottom: 8 },
  lockLogo: { color: '#ffffff', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  lockSub: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 14, lineHeight: 20 },
  lockBtn: { marginTop: 28, backgroundColor: ACCENT, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  lockBtnTxt: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
