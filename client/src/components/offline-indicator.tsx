import { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useOnlineStatus, useConnectionStatuses } from '@/hooks/use-offline';
import { formatLastUpdated, type ConnectionStatus } from '@/lib/offline-storage';

interface OfflineIndicatorProps {
  lastUpdated?: number | null;
  onReconnect?: (sourceId: string) => void;
  onSyncNow?: () => void;
  isSyncing?: boolean;
  pendingSyncCount?: number;
}

export function OfflineIndicator({
  lastUpdated,
  onReconnect,
  onSyncNow,
  isSyncing = false,
  pendingSyncCount = 0,
}: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();
  const { statuses, getExpiredConnections, getErrorConnections } = useConnectionStatuses();
  const [isExpanded, setIsExpanded] = useState(false);

  const expiredConnections = getExpiredConnections();
  const errorConnections = getErrorConnections();
  const hasIssues = expiredConnections.length > 0 || errorConnections.length > 0 || !isOnline;

  if (!hasIssues && !lastUpdated && pendingSyncCount === 0) {
    return null;
  }

  return (
    <Card className="p-3">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
            <span className="text-sm font-medium">
              {isOnline ? 'Online' : 'Offline Mode'}
            </span>
            {!isOnline && (
              <Badge variant="secondary" className="text-xs">
                Using cached data
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {lastUpdated && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span data-testid="text-last-updated">Last updated: {formatLastUpdated(lastUpdated)}</span>
              </div>
            )}

            {pendingSyncCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {pendingSyncCount} pending
              </Badge>
            )}

            {hasIssues && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="button-expand-offline-details">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            )}

            {isOnline && onSyncNow && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSyncNow}
                disabled={isSyncing}
                data-testid="button-sync-now"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            )}
          </div>
        </div>

        <CollapsibleContent className="mt-3 space-y-2">
          {!isOnline && (
            <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md">
              <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">No internet connection</p>
                <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                  You are viewing cached data. Changes will sync when you reconnect.
                </p>
              </div>
            </div>
          )}

          {expiredConnections.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Expired Tokens ({expiredConnections.length})
              </p>
              {expiredConnections.map((conn) => (
                <ConnectionStatusItem
                  key={conn.sourceId}
                  connection={conn}
                  onReconnect={onReconnect}
                />
              ))}
            </div>
          )}

          {errorConnections.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Connection Errors ({errorConnections.length})
              </p>
              {errorConnections.map((conn) => (
                <ConnectionStatusItem
                  key={conn.sourceId}
                  connection={conn}
                  onReconnect={onReconnect}
                />
              ))}
            </div>
          )}

          {statuses.filter(s => s.status === 'connected').length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                Connected Sources
              </p>
              <div className="flex flex-wrap gap-1">
                {statuses
                  .filter(s => s.status === 'connected')
                  .map((conn) => (
                    <Badge key={conn.sourceId} variant="secondary" className="text-xs">
                      {conn.sourceName}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface ConnectionStatusItemProps {
  connection: ConnectionStatus;
  onReconnect?: (sourceId: string) => void;
}

function ConnectionStatusItem({ connection, onReconnect }: ConnectionStatusItemProps) {
  return (
    <div 
      className="flex items-center justify-between p-2 bg-destructive/10 rounded-md"
      data-testid={`connection-status-${connection.sourceId}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{connection.sourceName}</p>
        <p className="text-xs text-muted-foreground">
          {connection.status === 'expired' && 'Token expired - reconnection required'}
          {connection.status === 'error' && (connection.errorMessage || 'Connection error')}
          {connection.status === 'disconnected' && 'Disconnected'}
        </p>
        {connection.lastSync > 0 && (
          <p className="text-xs text-muted-foreground">
            Last synced: {formatLastUpdated(connection.lastSync)}
          </p>
        )}
      </div>
      {onReconnect && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReconnect(connection.sourceId)}
          className="ml-2"
          data-testid={`button-reconnect-${connection.sourceId}`}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Reconnect
        </Button>
      )}
    </div>
  );
}

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
    } else {
      const timer = setTimeout(() => setShowBanner(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!showBanner) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium transition-colors ${
        isOnline 
          ? 'bg-green-600 text-white' 
          : 'bg-amber-500 text-white'
      }`}
      data-testid="banner-offline-status"
    >
      {isOnline ? (
        <span className="flex items-center justify-center gap-2">
          <Wifi className="h-4 w-4" />
          Back online - syncing data...
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          You are offline - viewing cached data
        </span>
      )}
    </div>
  );
}
