'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const NO_CATEGORY_VALUE = '__none__';

function normalizeTelegramUsername(username: string): string {
  return username.trim().toLowerCase().replace(/^@/, '');
}

export default function ProviderSettingsPage(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [channels, setChannels] = useState<TelegramChannel[]>([]);
  const [qualities, setQualities] = useState<QualityMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [newChannel, setNewChannel] = useState({ username: '', category: '', description: '' });
  const [addChannelError, setAddChannelError] = useState<string | null>(null);
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

  const normalizedNewChannelUsername = normalizeTelegramUsername(newChannel.username);
  const duplicateChannel = channels.find(
    (channel) => normalizeTelegramUsername(channel.username) === normalizedNewChannelUsername
  );
  const isDuplicateChannel = normalizedNewChannelUsername.length > 0 && duplicateChannel !== undefined;

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
    if (!normalizedNewChannelUsername) {
      setAddChannelError(t('providerSettingsPage.channelUsernameRequired'));
      return;
    }
    if (isDuplicateChannel) {
      setAddChannelError(
        t('providerSettingsPage.channelAlreadyExists', {
          username: duplicateChannel?.username ?? normalizedNewChannelUsername,
        })
      );
      return;
    }
    try {
      setAddChannelError(null);
      await addTelegramChannel({
        username: normalizedNewChannelUsername,
        enabled: true,
        category: newChannel.category || undefined,
        description: newChannel.description || undefined,
      });
      setAddChannelOpen(false);
      setNewChannel({ username: '', category: '', description: '' });
      setAddChannelError(null);
      await fetchData();
    } catch (error) {
      console.error('Failed to add channel:', error);
      setAddChannelError(error instanceof Error ? error.message : t('providerSettingsPage.addChannelFailed'));
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
            <h1 className="text-2xl font-bold text-foreground">{t('providerSettingsPage.title')}</h1>
            <p className="text-muted-foreground">
              {t('providerSettingsPage.subtitle')}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
          {t('providerSettingsPage.refresh')}
        </Button>
      </div>

      {!isLoading && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-foreground">{providers.length}</div>
              <div className="text-sm text-muted-foreground">{t('providerSettingsPage.totalProviders')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{enabledCount}</div>
              <div className="text-sm text-muted-foreground">{t('providerSettingsPage.enabled')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{disabledCount}</div>
              <div className="text-sm text-muted-foreground">{t('providerSettingsPage.disabled')}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
        <Button
          type="button"
          variant={activeTab === 'providers' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('providers')}
          className={cn(
            'h-auto px-4 py-2',
            activeTab !== 'providers' && 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t('providerSettingsPage.tabProviders', { count: providers.length })}
        </Button>
        <Button
          type="button"
          variant={activeTab === 'telegram' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('telegram')}
          className={cn(
            'h-auto px-4 py-2',
            activeTab !== 'telegram' && 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t('providerSettingsPage.tabTelegram', { enabled: enabledChannels, total: channels.length })}
        </Button>
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
                      {t(`providerSettingsPage.status.${status}`)}
                    </Badge>
                  </div>

                  {quality && (
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t('providerSettingsPage.quality')}</span>
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
                        ? t('providerSettingsPage.lastSync', { date: formatDateTime(provider.lastSync, locale) })
                        : t('providerSettingsPage.neverSynced')}
                    </span>
                    <span>{t('providerSettingsPage.intervalMinutes', { minutes: Math.round(provider.syncInterval / 60000) })}</span>
                  </div>

                  {provider.lastSyncResult === 'failed' && provider.lastError && (
                    <p className="text-xs text-destructive truncate" title={provider.lastError}>
                      {t('providerSettingsPage.errorLabel', { error: provider.lastError })}
                    </p>
                  )}

                  {provider.totalSynced > 0 && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{t('providerSettingsPage.syncedCount', { count: provider.totalSynced })}</span>
                      {provider.importedCount > 0 && <span>{t('providerSettingsPage.importedCount', { count: provider.importedCount })}</span>}
                      {provider.failedCount > 0 && <span className="text-destructive">{t('providerSettingsPage.failedCount', { count: provider.failedCount })}</span>}
                    </div>
                  )}

                  {provider.ingestionMode && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {provider.ingestionMode}
                      {provider.bulkSyncStatus === 'NOT_SUPPORTED_FOR_BULK_SYNC' && ` ${t('providerSettingsPage.notAvailableForBulkSync')}`}
                    </p>
                  )}

                  {!provider.registered && (
                    <div className="space-y-1">
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {t('providerSettingsPage.notRegistered')}
                      </p>
                      {provider.requiredConfig && provider.requiredConfig.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {t('providerSettingsPage.missingLabel', { list: provider.requiredConfig.join(', ') })}
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
                          {t('providerSettingsPage.disableProvider')}
                        </>
                      ) : (
                        <>
                          <Power className="mr-1.5 h-3.5 w-3.5" />
                          {t('providerSettingsPage.enableProvider')}
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
              {t('providerSettingsPage.addChannel')}
            </Button>
          </div>

          {channels.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t('providerSettingsPage.noChannels')}
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
                        ? t('providerSettingsPage.lastSync', { date: formatDateTime(channel.lastSyncAt, locale) })
                        : t('providerSettingsPage.neverSynced')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Select
                        value={channel.category ?? NO_CATEGORY_VALUE}
                        onValueChange={(value) =>
                          handleUpdateChannelCategory(channel.id, !value || value === NO_CATEGORY_VALUE ? '' : value)
                        }
                      >
                        <SelectTrigger className="h-7 w-[150px] text-xs" size="sm">
                          <SelectValue>
                            {(value: string) => (value === NO_CATEGORY_VALUE || !value ? t('providerSettingsPage.noCategory') : value)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_CATEGORY_VALUE}>{t('providerSettingsPage.noCategory')}</SelectItem>
                        {CATEGORY_OPTIONS.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleChannel(channel.id, !channel.enabled)}
                      >
                        {channel.enabled ? t('providerSettingsPage.disableChannel') : t('providerSettingsPage.enableChannel')}
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
        <DialogContent closeLabel={t('common.close')}>
          <DialogHeader>
            <DialogTitle>{t('providerSettingsPage.addDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="channel-username">{t('providerSettingsPage.channelUsernameLabel')}</Label>
              <Input
                id="channel-username"
                placeholder={t('providerSettingsPage.channelUsernamePlaceholder')}
                value={newChannel.username}
                error={addChannelError ?? undefined}
                onChange={(e) => {
                  setNewChannel((prev) => ({ ...prev, username: e.target.value }));
                  setAddChannelError(null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t('providerSettingsPage.bareUsernameHint')}
              </p>
              {isDuplicateChannel && !addChannelError && (
                <p className="text-xs text-destructive">
                  {t('providerSettingsPage.channelAlreadyExists', { username: duplicateChannel.username })}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-category">{t('providerSettingsPage.categoryLabel')}</Label>
              <Select
                value={newChannel.category || NO_CATEGORY_VALUE}
                onValueChange={(value) =>
                  setNewChannel((prev) => ({
                    ...prev,
                    category: !value || value === NO_CATEGORY_VALUE ? '' : value,
                  }))
                }
              >
                <SelectTrigger id="channel-category" className="w-full">
                  <SelectValue>
                    {(value: string) => (value === NO_CATEGORY_VALUE || !value ? t('providerSettingsPage.noCategory') : value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY_VALUE}>{t('providerSettingsPage.noCategory')}</SelectItem>
                {CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-description">{t('providerSettingsPage.descriptionLabel')}</Label>
              <Input
                id="channel-description"
                placeholder={t('providerSettingsPage.descriptionPlaceholder')}
                value={newChannel.description}
                onChange={(e) => setNewChannel((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddChannelOpen(false);
                setAddChannelError(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAddChannel} disabled={!normalizedNewChannelUsername || isDuplicateChannel}>
              {t('providerSettingsPage.addChannel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
