import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  getEHRProviders,
  getEHRConnections,
  connectToEHR,
  syncEHRConnection,
  disconnectEHR,
  type EHRProvider,
  type EHRConnection,
} from '../services/ehr';

const COLORS = {
  primary: '#0F766E',
  secondary: '#14B8A6',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
};

function getProviderIcon(icon: string): keyof typeof Ionicons.glyphMap {
  switch (icon) {
    case 'hospital':
      return 'medkit';
    case 'building':
      return 'business';
    case 'flask':
      return 'flask';
    default:
      return 'medical';
  }
}

export default function EHRConnectionScreen() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  const {
    data: providers = [],
    isLoading: loadingProviders,
  } = useQuery({
    queryKey: ['ehr-providers'],
    queryFn: getEHRProviders,
  });

  const {
    data: connections = [],
    isLoading: loadingConnections,
    refetch: refetchConnections,
  } = useQuery({
    queryKey: ['ehr-connections'],
    queryFn: getEHRConnections,
  });

  const handleConnect = async (provider: EHRProvider) => {
    setConnecting(provider.id);
    try {
      const result = await connectToEHR(provider.id);
      if (result.success) {
        Alert.alert(
          'Connected!',
          `Successfully connected to ${provider.name}. You can now sync your health records.`,
          [{ text: 'OK', onPress: () => refetchConnections() }]
        );
      } else {
        Alert.alert('Connection Failed', result.error || 'Could not connect to the EHR.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to the health system.');
    } finally {
      setConnecting(null);
    }
  };

  const handleSync = async (connection: EHRConnection) => {
    setSyncing(connection.id);
    try {
      const result = await syncEHRConnection(connection.id);
      if (result.success) {
        Alert.alert(
          'Sync Complete',
          `Imported ${result.importedCount} health records from ${connection.providerName}.`,
          [{ text: 'OK' }]
        );
        queryClient.invalidateQueries({ queryKey: ['ehr-connections'] });
        queryClient.invalidateQueries({ queryKey: ['records'] });
        queryClient.invalidateQueries({ queryKey: ['timeline'] });
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        Alert.alert(
          'Session Expired',
          'Your connection to this health system has expired. Please reconnect.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Sync Failed', 'Could not sync health records. Please try again.');
      }
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = (connection: EHRConnection) => {
    Alert.alert(
      'Disconnect',
      `Are you sure you want to disconnect from ${connection.providerName}? This will remove all imported records from this source.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectEHR(connection.id);
              queryClient.invalidateQueries({ queryKey: ['ehr-connections'] });
              queryClient.invalidateQueries({ queryKey: ['records'] });
            } catch (error) {
              Alert.alert('Error', 'Failed to disconnect.');
            }
          },
        },
      ]
    );
  };

  const onRefresh = useCallback(() => {
    refetchConnections();
  }, [refetchConnections]);

  const isLoading = loadingProviders || loadingConnections;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Ionicons name="cloud-upload" size={32} color={COLORS.primary} />
        <Text style={styles.title}>Connect Health Records</Text>
        <Text style={styles.subtitle}>
          Import your medical records from participating health systems using secure SMART on FHIR technology.
        </Text>
      </View>

      {/* Connected EHRs */}
      {connections.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Health Systems</Text>
          {connections.map((connection) => (
            <View key={connection.id} style={styles.connectionCard}>
              <View style={styles.connectionHeader}>
                <View style={styles.connectionInfo}>
                  <Ionicons name="checkmark-circle" size={24} color={connection.isActive ? COLORS.success : COLORS.warning} />
                  <View style={styles.connectionText}>
                    <Text style={styles.connectionName}>{connection.providerName}</Text>
                    <Text style={styles.connectionMeta}>
                      {connection.isActive ? 'Connected' : 'Session expired'} 
                      {connection.lastSyncAt && ` • Last synced ${new Date(connection.lastSyncAt).toLocaleDateString()}`}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.connectionActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.syncButton]}
                  onPress={() => handleSync(connection)}
                  disabled={syncing === connection.id || !connection.isActive}
                >
                  {syncing === connection.id ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="sync" size={16} color="#FFF" />
                      <Text style={styles.actionButtonText}>Sync Records</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.disconnectButton]}
                  onPress={() => handleDisconnect(connection)}
                >
                  <Ionicons name="close-circle" size={16} color={COLORS.error} />
                  <Text style={[styles.actionButtonText, { color: COLORS.error }]}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Available Providers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Health Systems</Text>
        <Text style={styles.sectionSubtitle}>
          Select a health system to connect and import your records.
        </Text>
        
        {providers.map((provider) => {
          const isConnected = connections.some(
            (c) => c.providerName === provider.name
          );
          
          return (
            <TouchableOpacity
              key={provider.id}
              style={[
                styles.providerCard,
                isConnected && styles.providerCardConnected,
              ]}
              onPress={() => handleConnect(provider)}
              disabled={connecting === provider.id || isConnected}
            >
              <View style={styles.providerIcon}>
                <Ionicons
                  name={getProviderIcon(provider.icon)}
                  size={28}
                  color={isConnected ? COLORS.success : COLORS.primary}
                />
              </View>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{provider.name}</Text>
                <Text style={styles.providerStatus}>
                  {isConnected ? 'Already connected' : 'Tap to connect'}
                </Text>
              </View>
              {connecting === provider.id ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : isConnected ? (
                <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              ) : (
                <Ionicons name="chevron-forward" size={24} color={COLORS.textSecondary} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Security Notice */}
      <View style={styles.securityNotice}>
        <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
        <Text style={styles.securityText}>
          Your health data is encrypted and securely transferred using SMART on FHIR, the industry standard for health data exchange. We never store your EHR login credentials.
        </Text>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          For informational purposes only. Not for clinical decision-making.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  connectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  connectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  connectionText: {
    marginLeft: 12,
    flex: 1,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  connectionMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  connectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  syncButton: {
    backgroundColor: COLORS.primary,
  },
  disconnectButton: {
    backgroundColor: '#FEE2E2',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFF',
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  providerCardConnected: {
    borderColor: COLORS.success,
    backgroundColor: '#F0FDF4',
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  providerStatus: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  disclaimer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  disclaimerText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
