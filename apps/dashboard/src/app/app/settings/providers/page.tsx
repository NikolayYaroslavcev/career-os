'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Settings,
  RefreshCw,
  Power,
  PowerOff,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getProviders,
  updateProvider,
  getTelegramChannels,
  addTelegramChannel,
  updateTelegramChannel,
  deleteTelegramChannel,
  getProviderQualities,
  type ProviderInfo,
  type TelegramChannel,
  type QualityMetrics,
} from '@/api/providers';
import { syncProvider as apiSyncSingleProvider } from '@/api/sync';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatDateTime } from '@/lib/format';

const READY_STATUS_STYLE = { badge: 'success', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' };

const PROVIDER_STATUS_STYLES: Record<string, { badge: string; icon: typeof CheckCircle2; color: string }> = {
  READY: READY_STATUS_STYLE,
  BLOCKED: { badge: 'destructive', icon: XCircle, color: 'text-destructive' },
  NEEDS_CONFIGURATION: { badge: 'warning', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
  DISABLED: { badge: 'secondary', icon: PowerOff, color: 'text-muted-foreground' },
  SYNCING: { badge: 'default', icon: RefreshCw, color: 'text-blue-600 dark:text-blue-400' },
  ERROR: { badge: 'destructive', icon: AlertTriangle, color: 'text-destructive' },
  NOT_CONFIGURED: { badge: 'warning', icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
};

const DEFAULT_STATUS_STYLE = READY_STATUS_STYLE;

function computeProviderStatus(provider: ProviderInfo): string {
  if (!provider.enabled) return 'DISABLED';
  if (!provider.registered) return 'NOT_CONFIGURED';
  if (provider.consecutiveFailures >= 3) return 'ERROR';
  if (provider.lastSyncResult === 'pending') return 'SYNCING';
  return 'READY';
}

const CATEGORY_OPTIONS = [
  'Backend',
  'Frontend',
  'Fullstack',
  'Mobile',
  'DevOps',
  'Data',
  'Design',
  'QA',
  'Management',
  'General IT',
  'Junior',
  'Remote',
  'CIS',
];

export default function ProviderSettingsPage(): React.JSX.Element {
  const { locale } = useTranslation();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [channels, setChannels] = useState<TelegramChannel[]>([]);
  const [qualities, setQualities] = useState<QualityMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [newChannel, setNewChannel] = useState({ username: '', category: '', description: '' });
  const [activeTab, setActiveTab] = useState<'providers' | 'telegram'>('providers');

  const fetchData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const [provRes, chanRes, qualRes] = await Promise.all([
        getProviders(),
        getTelegramChannels(),
        getProviderQualities(),
      ]);
      setProviders(provRes.providers);
      setChannels(chanRes.channels);
      setQualities(qualRes.qualities);
    } catch (error) {
      console.error('Failed to fetch provider data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleToggleProvider(providerId: string, enabled: boolean): Promise<void> {
    try {
      await updateProvider(providerId, { enabled });
      await fetchData();
    } catch (error) {
      console.error('Failed to toggle provider:', error);
    }
  }

  async function handleSyncProvider(providerId: string): Promise<void> {
    setSyncingProvider(providerId);
    try {
      await apiSyncSingleProvider(providerId);
      await fetchData();
    } catch (error) {
      console.error('Provider sync failed:', error);
    } finally {
      setSyncingProvider(null);
    }
  }

  async function handleAddChannel(): Promise<void> {
    if (!newChannel.username.trim()) return;
    try {
      await addTelegramChannel({
        username: newChannel.username.trim(),
        enabled: true,
        category: newChannel.category || undefined,
        description: newChannel.description || undefined,
      });
      setAddChannelOpen(false);
      setNewChannel({ username: '', category: '', description: '' });
      await fetchData();
    } catch (error) {
      console.error('Failed to add channel:', error);
    }
  }

  async function handleToggleChannel(id: string, enabled: boolean): Promise<void> {
    try {
      await updateTelegramChannel(id, { enabled });
      await fetchData();
    } catch (error) {
      console.error('Failed to toggle channel:', error);
    }
  }

  async function handleDeleteChannel(id: string): Promise<void> {
    try {
      await deleteTelegramChannel(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete channel:', error);
    }
  }

  async function handleUpdateChannelCategory(id: string, category: string): Promise<void> {
    try {
      await updateTelegramChannel(id, { category: category || undefined });
      await fetchData();
    } catch (error) {
      console.error('Failed to update channel:', error);
    }
  }

  const enabledCount = providers.filter((p) => p.enabled).length;
  const disabledCount = providers.filter((p) => !p.enabled).length;
  const enabledChannels = channels.filter((c) => c.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Provider Settings</h1>
            <p className="text-muted-foreground">
              Manage job sources and Telegram channels globally
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {!isLoading && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-foreground">{providers.length}</div>
              <div className="text-sm text-muted-foreground">Total Providers</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{enabledCount}</div>
              <div className="text-sm text-muted-foreground">Enabled</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{disabledCount}</div>
              <div className="text-sm text-muted-foreground">Disabled</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
        <button
          onClick={() => setActiveTab('providers')}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'providers'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Providers ({providers.length})
        </button>
        <button
          onClick={() => setActiveTab('telegram')}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'telegram'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Telegram Channels ({enabledChannels}/{channels.length})
        </button>
      </div>

      {isLoading ? (
        <Loading />
      ) : activeTab === 'providers' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => {
            const isEnabled = provider.enabled;
            const status = computeProviderStatus(provider);
            const statusStyle = PROVIDER_STATUS_STYLES[status] ?? DEFAULT_STATUS_STYLE;
            const StatusIcon = statusStyle.icon;
            const quality = qualities.find((q) => q.providerId === provider.providerId);
            const isSyncing = syncingProvider === provider.providerId;

            return (
              <Card
                key={provider.providerId}
                className={cn(
                  'relative overflow-hidden transition-shadow hover:shadow-md',
                  !isEnabled && 'opacity-60'
                )}
              >
                <div className={cn(
                  'absolute inset-y-0 left-0 w-1',
                  isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                )} />
                <CardContent className="space-y-3 pl-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={cn('h-4 w-4', statusStyle.color)} />
                      <h3 className="font-medium text-foreground">{provider.name}</h3>
                    </div>
                    <Badge variant={statusStyle.badge as 'success' | 'destructive' | 'warning' | 'secondary' | 'default'}>
                      {status}
                    </Badge>
                  </div>

                  {quality && (
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Quality</span>
                          <span>{quality.qualityScore}/100</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              quality.qualityScore >= 70 ? 'bg-emerald-500' :
                              quality.qualityScore >= 40 ? 'bg-amber-500' : 'bg-destructive'
                            )}
                            style={{ width: `${quality.qualityScore}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {provider.lastSync
                        ? `Last sync: ${formatDateTime(provider.lastSync, locale)}`
                        : 'Never synced'}
                    </span>
                    <span>{Math.round(provider.syncInterval / 60000)}min interval</span>
                  </div>

                  {provider.lastSyncResult === 'failed' && provider.lastError && (
                    <p className="text-xs text-destructive truncate" title={provider.lastError}>
                      Error: {provider.lastError}
                    </p>
                  )}

                  {provider.totalSynced > 0 && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{provider.totalSynced} synced</span>
                      {provider.importedCount > 0 && <span>{provider.importedCount} imported</span>}
                      {provider.failedCount > 0 && <span className="text-destructive">{provider.failedCount} failed</span>}
                    </div>
                  )}

                  {provider.ingestionMode && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {provider.ingestionMode}
                      {provider.bulkSyncStatus === 'NOT_SUPPORTED_FOR_BULK_SYNC' && ' (not available for bulk sync)'}
                    </p>
                  )}

                  {!provider.registered && (
                    <div className="space-y-1">
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Not registered — requires configuration
                      </p>
                      {provider.requiredConfig && provider.requiredConfig.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Missing: {provider.requiredConfig.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant={isEnabled ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => handleToggleProvider(provider.providerId, !isEnabled)}
                      className="flex-1"
                    >
                      {isEnabled ? (
                        <>
                          <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                          Disable
                        </>
                      ) : (
                        <>
                          <Power className="mr-1.5 h-3.5 w-3.5" />
                          Enable
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncProvider(provider.providerId)}
                      disabled={isSyncing || !isEnabled || !provider.registered}
                    >
                      <Zap className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setAddChannelOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Channel
            </Button>
          </div>

          {channels.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No Telegram channels configured. Add one to start fetching.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {channels.map((channel) => (
                <Card key={channel.id} className={cn(!channel.enabled && 'opacity-60')}>
                  <CardContent className="flex items-center gap-4 py-3">
                    <div className={cn(
                      'h-2 w-2 rounded-full',
                      channel.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">@{channel.username}</span>
                        {channel.category && (
                          <Badge variant="outline" className="text-xs">
                            {channel.category}
                          </Badge>
                        )}
                      </div>
                      {channel.description && (
                        <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {channel.lastSyncAt
                        ? `Last sync: ${formatDateTime(channel.lastSyncAt, locale)}`
                        : 'Never synced'}
                    </div>
                    <div className="flex items-center gap-1">
                      <select
                        value={channel.category ?? ''}
                        onChange={(e) => handleUpdateChannelCategory(channel.id, e.target.value)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                      >
                        <option value="">No category</option>
                        {CATEGORY_OPTIONS.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleChannel(channel.id, !channel.enabled)}
                      >
                        {channel.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteChannel(channel.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={addChannelOpen} onOpenChange={setAddChannelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Telegram Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="channel-username">Channel Username</Label>
              <Input
                id="channel-username"
                placeholder="e.g. remoteit, geekjobs"
                value={newChannel.username}
                onChange={(e) => setNewChannel((prev) => ({ ...prev, username: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Bare username without @ prefix
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-category">Category</Label>
              <select
                id="channel-category"
                value={newChannel.category}
                onChange={(e) => setNewChannel((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">No category</option>
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-description">Description (optional)</Label>
              <Input
                id="channel-description"
                placeholder="e.g. Backend jobs in Russian"
                value={newChannel.description}
                onChange={(e) => setNewChannel((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddChannelOpen(false)}>Cancel</Button>
            <Button onClick={handleAddChannel} disabled={!newChannel.username.trim()}>Add Channel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
