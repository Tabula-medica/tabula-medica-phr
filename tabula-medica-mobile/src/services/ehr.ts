import api from './api';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

export interface EHRProvider {
  id: string;
  name: string;
  icon: string;
}

export interface EHRConnection {
  id: string;
  providerName: string;
  patientId?: string;
  connectedAt: string;
  lastSyncAt?: string;
  isActive: boolean;
}

export interface ImportedResource {
  id: string;
  resourceType: string;
  fhirId: string;
  data: Record<string, unknown>;
  provenance: {
    source: string;
    importedAt: string;
    sourcePatientId: string;
    sourceVersion?: string;
  };
  createdAt: string;
}

export interface SyncResult {
  success: boolean;
  results: Record<string, { imported: number; errors: number }>;
  importedCount: number;
  importedItems: Array<{ resourceType: string; fhirId: string; display: string }>;
  syncedAt: string;
}

// Get list of available EHR providers
export async function getEHRProviders(): Promise<EHRProvider[]> {
  const response = await api.get('/mobile/ehr/providers');
  return response.data.providers;
}

// Get user's EHR connections
export async function getEHRConnections(): Promise<EHRConnection[]> {
  const response = await api.get('/mobile/ehr/connections');
  return response.data.connections;
}

// Initiate OAuth flow to connect to an EHR
export async function connectToEHR(providerId: string): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  try {
    // Get the app's redirect URL for deep linking
    const redirectUri = Linking.createURL('ehr-callback');
    
    // Request authorization URL from backend
    const response = await api.post('/mobile/ehr/connect', {
      providerId,
      redirectUri,
    });

    const { authorizationUrl, state } = response.data;

    // Open the OAuth flow in a browser
    const result = await WebBrowser.openAuthSessionAsync(
      authorizationUrl,
      redirectUri
    );

    if (result.type === 'success' && result.url) {
      // Parse the callback URL
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      if (code && returnedState === state) {
        // Exchange code for tokens
        const callbackResponse = await api.post('/mobile/ehr/callback', {
          code,
          state: returnedState,
        });

        return {
          success: true,
          connectionId: callbackResponse.data.connectionId,
        };
      }
    }

    return { success: false, error: 'OAuth flow cancelled or failed' };
  } catch (error: any) {
    console.error('EHR connection error:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Connection failed',
    };
  }
}

// Sync (import) FHIR resources from an EHR connection
export async function syncEHRConnection(connectionId: string): Promise<SyncResult> {
  const response = await api.post(`/mobile/ehr/sync/${connectionId}`);
  return response.data;
}

// Get imported resources
export async function getImportedResources(params?: {
  resourceType?: string;
  connectionId?: string;
}): Promise<ImportedResource[]> {
  const response = await api.get('/mobile/ehr/resources', { params });
  return response.data.resources;
}

// Disconnect an EHR connection
export async function disconnectEHR(connectionId: string): Promise<void> {
  await api.delete(`/mobile/ehr/connections/${connectionId}`);
}

export default {
  getEHRProviders,
  getEHRConnections,
  connectToEHR,
  syncEHRConnection,
  getImportedResources,
  disconnectEHR,
};
