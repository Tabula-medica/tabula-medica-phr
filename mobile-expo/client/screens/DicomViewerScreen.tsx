import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import WebView from "react-native-webview";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

interface DicomViewerParams {
  studyInstanceUID: string;
  studyDescription?: string;
  modality?: string;
  studyDate?: string;
  patientId?: string;
}

export default function DicomViewerScreen() {
  const { theme: colors } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { checkFeature, promptProps, isSubscribed } = useFeatureGate();

  useEffect(() => {
    if (!isSubscribed) {
      checkFeature("dicom_viewer");
    }
  }, [isSubscribed, checkFeature]);

  const params: DicomViewerParams = route.params || {};
  const { studyInstanceUID, studyDescription, modality, studyDate } = params;

  const apiUrl = getApiUrl();
  const wadoRsRoot = `${apiUrl}/api/dicom/wado-rs`;

  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const escapeJs = (str: string) =>
    str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/<\//g, "<\\/");

  const safeStudyDesc = escapeHtml(studyDescription || "DICOM Study");
  const safeModality = modality ? escapeHtml(modality) : "";
  const safeStudyDate = studyDate ? escapeHtml(studyDate) : "";
  const safeStudyUID = escapeJs(studyInstanceUID || "");
  const safeWadoRoot = escapeJs(wadoRsRoot);

  const viewerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'; connect-src *; img-src * data: blob:;">
      <title>DICOM Viewer</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; color: #fff; font-family: -apple-system, sans-serif; height: 100vh; display: flex; flex-direction: column; }
        #viewer { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; }
        #viewer img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .toolbar { display: flex; gap: 8px; padding: 8px 12px; background: rgba(30,30,30,0.95); overflow-x: auto; }
        .toolbar button { background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-size: 13px; white-space: nowrap; cursor: pointer; }
        .toolbar button:active, .toolbar button.active { background: rgba(0,122,255,0.6); }
        .info-bar { padding: 8px 12px; background: rgba(30,30,30,0.8); font-size: 12px; color: #aaa; }
        .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
        .loading .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #007AFF; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error { color: #FF453A; text-align: center; padding: 40px 20px; }
        canvas { display: block; }
      </style>
    </head>
    <body>
      <div class="info-bar">
        <strong>${safeStudyDesc}</strong>
        ${safeModality ? " &bull; " + safeModality : ""}
        ${safeStudyDate ? " &bull; " + safeStudyDate : ""}
      </div>
      <div class="toolbar">
        <button onclick="zoomIn()">Zoom +</button>
        <button onclick="zoomOut()">Zoom -</button>
        <button onclick="resetView()">Reset</button>
        <button onclick="toggleInvert()" id="invertBtn">Invert</button>
        <button onclick="rotateImage()">Rotate</button>
        <button onclick="adjustBrightness(0.1)">Bright +</button>
        <button onclick="adjustBrightness(-0.1)">Bright -</button>
      </div>
      <div id="viewer">
        <div class="loading" id="loadingIndicator">
          <div class="spinner"></div>
          <div>Loading DICOM image...</div>
        </div>
        <canvas id="canvas" style="display:none"></canvas>
      </div>
      <script>
        let zoom = 1, rotation = 0, brightness = 1, inverted = false;
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        let img = null;

        async function loadStudy() {
          try {
            const wadoUrl = '${safeWadoRoot}/studies/${safeStudyUID}';
            const resp = await fetch(wadoUrl);
            if (!resp.ok) throw new Error('Failed to load study: ' + resp.status);
            const data = await resp.json();
            if (data.imageUrl) {
              img = new Image();
              img.onload = () => {
                document.getElementById('loadingIndicator').style.display = 'none';
                canvas.style.display = 'block';
                canvas.width = img.width;
                canvas.height = img.height;
                render();
              };
              img.onerror = () => showError('Failed to load image');
              img.src = data.imageUrl;
            } else {
              showError('No image data available for this study. The DICOM store may not be configured.');
            }
          } catch(e) {
            showError('DICOM viewer requires GCP Healthcare API configuration. ' + e.message);
          }
        }

        function render() {
          if (!img) return;
          const w = canvas.width, h = canvas.height;
          ctx.clearRect(0, 0, w, h);
          ctx.save();
          ctx.translate(w/2, h/2);
          ctx.rotate(rotation * Math.PI / 180);
          ctx.scale(zoom, zoom);
          ctx.filter = 'brightness(' + brightness + ')' + (inverted ? ' invert(1)' : '');
          ctx.drawImage(img, -w/2, -h/2, w, h);
          ctx.restore();
        }

        function zoomIn() { zoom = Math.min(zoom * 1.2, 5); render(); }
        function zoomOut() { zoom = Math.max(zoom / 1.2, 0.2); render(); }
        function resetView() { zoom = 1; rotation = 0; brightness = 1; inverted = false; document.getElementById('invertBtn').classList.remove('active'); render(); }
        function toggleInvert() { inverted = !inverted; document.getElementById('invertBtn').classList.toggle('active'); render(); }
        function rotateImage() { rotation = (rotation + 90) % 360; render(); }
        function adjustBrightness(delta) { brightness = Math.max(0.1, Math.min(brightness + delta, 3)); render(); }
        function showError(msg) { document.getElementById('loadingIndicator').style.display = 'none'; document.getElementById('viewer').innerHTML = '<div class="error">' + msg + '</div>'; }

        loadStudy();
      </script>
    </body>
    </html>
  `;

  const handleWebViewError = useCallback(() => {
    setError("Failed to load the DICOM viewer. Please check your connection.");
    setLoading(false);
  }, []);

  const handleShouldStartLoad = useCallback((event: any) => {
    const { url: requestUrl } = event;
    if (requestUrl === "about:blank" || requestUrl.startsWith("data:")) return true;
    if (requestUrl.startsWith(apiUrl)) return true;
    return false;
  }, [apiUrl]);

  if (!studyInstanceUID) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.lg }]}>
        <View style={styles.emptyState}>
          <Feather name="image" size={48} color={colors.textSecondary} />
          <ThemedText type="h3" style={{ marginTop: Spacing.md, textAlign: "center" }}>
            No Imaging Study Selected
          </ThemedText>
          <ThemedText type="body" style={{ color: colors.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
            Select an imaging study from your health records to view DICOM images.
          </ThemedText>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Go back to records"
          >
            <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Back to Records
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  if (Platform.OS === "web") {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.lg }]}>
        <View style={styles.emptyState}>
          <Feather name="monitor" size={48} color={colors.textSecondary} />
          <ThemedText type="h3" style={{ marginTop: Spacing.md, textAlign: "center" }}>
            DICOM Viewer
          </ThemedText>
          <ThemedText type="body" style={{ color: colors.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
            The DICOM image viewer works best on your mobile device via Expo Go. Open this study on your phone for the full radiology viewing experience.
          </ThemedText>
        </View>
        <UpgradePrompt {...promptProps} />
      </ThemedView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000000" }]}>
      <UpgradePrompt {...promptProps} />
      {error ? (
        <View style={[styles.emptyState, { paddingTop: headerHeight + Spacing.lg }]}>
          <Feather name="alert-circle" size={48} color={colors.error} />
          <ThemedText type="h3" style={{ marginTop: Spacing.md, textAlign: "center", color: "#FFFFFF" }}>
            Viewer Error
          </ThemedText>
          <ThemedText type="body" style={{ color: colors.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
            {error}
          </ThemedText>
        </View>
      ) : (
        <>
          {loading ? (
            <View style={[styles.loadingOverlay, { paddingTop: headerHeight }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <ThemedText type="body" style={{ color: "#FFFFFF", marginTop: Spacing.md }}>
                Loading DICOM images...
              </ThemedText>
            </View>
          ) : null}
          <WebView
            source={{ html: viewerHtml }}
            style={{ flex: 1, backgroundColor: "#000000" }}
            onLoadEnd={() => setLoading(false)}
            onError={handleWebViewError}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            javaScriptEnabled
            domStorageEnabled
            scalesPageToFit={false}
            scrollEnabled={false}
            allowsInlineMediaPlayback
            accessibilityLabel="DICOM medical image viewer"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  backButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    zIndex: 10,
  },
});
