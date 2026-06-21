import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

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

interface Provider {
  id: string;
  name: string;
  specialty: string;
  organization?: string;
  phone?: string;
  email?: string;
  address?: string;
  npi?: string;
  isConnected: boolean;
  connectionStatus?: 'pending' | 'approved' | 'declined';
  avatarUrl?: string;
}

interface ConnectionRequest {
  id: string;
  providerId: string;
  providerName: string;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: string;
  approvedAt?: string;
}

export default function ConnectDoctorScreen() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);

  const specialties = [
    'All',
    'Primary Care',
    'Cardiology',
    'Dermatology',
    'Endocrinology',
    'Gastroenterology',
    'Neurology',
    'Oncology',
    'Orthopedics',
    'Pediatrics',
    'Psychiatry',
  ];

  const { data: providers = [], isLoading: loadingProviders, refetch } = useQuery({
    queryKey: ['providers', searchQuery, selectedSpecialty],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      if (selectedSpecialty && selectedSpecialty !== 'All') params.specialty = selectedSpecialty;
      
      const res = await api.get<{ providers: Provider[] }>('/api/mobile/providers', { params });
      return res.data.providers;
    },
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['provider-connections'],
    queryFn: async () => {
      const res = await api.get<{ connections: ConnectionRequest[] }>('/api/mobile/provider-connections');
      return res.data.connections;
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const res = await api.post('/api/mobile/provider-connections', { providerId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['provider-connections'] });
      Alert.alert('Request Sent', 'Your connection request has been sent to the provider.');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to send connection request. Please try again.');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (providerId: string) => {
      await api.delete(`/api/mobile/provider-connections/${providerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['provider-connections'] });
    },
  });

  const handleConnect = (provider: Provider) => {
    Alert.alert(
      'Connect with Provider',
      `Send a connection request to ${provider.name}? This will allow them to view your health records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: () => connectMutation.mutate(provider.id),
        },
      ]
    );
  };

  const handleDisconnect = (provider: Provider) => {
    Alert.alert(
      'Disconnect Provider',
      `Remove ${provider.name} from your care team? They will no longer have access to your records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => disconnectMutation.mutate(provider.id),
        },
      ]
    );
  };

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const getConnectionStatus = (provider: Provider) => {
    const connection = connections.find(c => c.providerId === provider.id);
    if (connection) {
      return connection.status;
    }
    return provider.connectionStatus;
  };

  const renderProviderCard = (provider: Provider) => {
    const status = getConnectionStatus(provider);
    const isConnected = status === 'approved';
    
    return (
      <View key={provider.id} style={styles.providerCard}>
        <View style={styles.providerHeader}>
          <View style={styles.avatarContainer}>
            {provider.avatarUrl ? (
              <Image source={{ uri: provider.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={24} color={COLORS.textSecondary} />
              </View>
            )}
          </View>
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{provider.name}</Text>
            <Text style={styles.providerSpecialty}>{provider.specialty}</Text>
            {provider.organization && (
              <Text style={styles.providerOrg}>{provider.organization}</Text>
            )}
          </View>
          {isConnected && (
            <View style={styles.connectedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          )}
          {status === 'pending' && (
            <View style={styles.pendingBadge}>
              <Ionicons name="time" size={16} color={COLORS.warning} />
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          )}
        </View>

        <View style={styles.providerDetails}>
          {provider.phone && (
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.detailText}>{provider.phone}</Text>
            </View>
          )}
          {provider.address && (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.detailText} numberOfLines={1}>{provider.address}</Text>
            </View>
          )}
        </View>

        <View style={styles.providerActions}>
          {isConnected ? (
            <>
              <TouchableOpacity
                style={styles.messageButton}
                onPress={() => Alert.alert('Coming Soon', 'Secure messaging will be available soon.')}
                testID={`button-message-${provider.id}`}
              >
                <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={() => handleDisconnect(provider)}
                testID={`button-disconnect-${provider.id}`}
              >
                <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </>
          ) : status === 'pending' ? (
            <View style={styles.pendingMessage}>
              <Text style={styles.pendingMessageText}>Awaiting provider approval</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => handleConnect(provider)}
              disabled={connectMutation.isPending}
              testID={`button-connect-${provider.id}`}
            >
              {connectMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                  <Text style={styles.connectButtonText}>Connect</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search doctors by name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={COLORS.textSecondary}
            testID="input-search-provider"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} testID="button-clear-search">
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.specialtyContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specialtyScroll}>
          {specialties.map((specialty) => (
            <TouchableOpacity
              key={specialty}
              style={[
                styles.specialtyChip,
                (selectedSpecialty === specialty || (specialty === 'All' && !selectedSpecialty)) && styles.specialtyChipSelected,
              ]}
              onPress={() => setSelectedSpecialty(specialty === 'All' ? null : specialty)}
              testID={`button-specialty-${specialty.toLowerCase().replace(' ', '-')}`}
            >
              <Text
                style={[
                  styles.specialtyChipText,
                  (selectedSpecialty === specialty || (specialty === 'All' && !selectedSpecialty)) && styles.specialtyChipTextSelected,
                ]}
              >
                {specialty}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.providerList}
        contentContainerStyle={styles.providerListContent}
        refreshControl={
          <RefreshControl refreshing={loadingProviders} onRefresh={onRefresh} />
        }
      >
        {loadingProviders ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Finding providers...</Text>
          </View>
        ) : providers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="medical" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No providers found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your search or filters
            </Text>
          </View>
        ) : (
          providers.map(renderProviderCard)
        )}

        <View style={styles.securityNotice}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
          <Text style={styles.securityText}>
            Connecting with a provider allows them to securely view your health records. You can disconnect at any time.
          </Text>
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            For informational purposes only. Not for clinical decision-making.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  specialtyContainer: {
    backgroundColor: COLORS.card,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  specialtyScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  specialtyChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    marginRight: 8,
  },
  specialtyChipSelected: {
    backgroundColor: COLORS.primary,
  },
  specialtyChipText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  specialtyChipTextSelected: {
    color: '#FFF',
  },
  providerList: {
    flex: 1,
  },
  providerListContent: {
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  providerCard: {
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
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  providerSpecialty: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 2,
  },
  providerOrg: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  connectedText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '500',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  pendingText: {
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: '500',
  },
  providerDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  providerActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  connectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  connectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFA',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  disconnectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
  },
  pendingMessage: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  pendingMessageText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
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
    paddingVertical: 16,
  },
  disclaimerText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
