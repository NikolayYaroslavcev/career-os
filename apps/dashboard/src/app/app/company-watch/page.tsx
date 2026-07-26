'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-provider';
import { formatDateTime } from '@/lib/format';
import {
  getWatchedCompanies,
  addWatchedCompany,
  updateWatchedCompany,
  removeWatchedCompany,
  discoverCompany,
  type CompanyWatch,
} from '@/api/company-watch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Building2, CheckCircle, XCircle, Clock, Plus, Pencil, Trash2 } from 'lucide-react';

export default function CompanyWatchPage(): React.JSX.Element {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<CompanyWatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWatch | null>(null);
  const [name, setName] = useState('');
  const [careerUrl, setCareerUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchCompanies(): Promise<void> {
    try {
      const data = await getWatchedCompanies();
      setCompanies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('companyWatchPage.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCompanies();
  }, [t]);

  function resetForm(): void {
    setName('');
    setCareerUrl('');
    setFormError(null);
    setEditingCompany(null);
  }

  function openAddDialog(): void {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(company: CompanyWatch): void {
    setEditingCompany(company);
    setName(company.name);
    setCareerUrl(company.careerUrl);
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleDelete(company: CompanyWatch): Promise<void> {
    if (!confirm(t('companyWatchPage.deleteConfirm', { name: company.name }))) return;
    setDeletingId(company.id);
    try {
      await removeWatchedCompany(company.id);
      await fetchCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('companyWatchPage.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) {
      setFormError(t('companyWatchPage.nameRequired'));
      return;
    }
    if (!careerUrl.trim()) {
      setFormError(t('companyWatchPage.careerUrlRequired'));
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingCompany) {
        await updateWatchedCompany(editingCompany.id, {
          name: name.trim(),
          careerUrl: careerUrl.trim(),
        });
      } else {
        let atsType = 'CUSTOM_HTML';
        let atsEndpoint: string | undefined;
        try {
          const discovery = await discoverCompany(careerUrl.trim());
          if (discovery.atsType) atsType = discovery.atsType;
          if (discovery.apiEndpoint) atsEndpoint = discovery.apiEndpoint;
        } catch {
          // Fall back to CUSTOM_HTML if discovery fails; user can edit later.
        }

        await addWatchedCompany({
          name: name.trim(),
          careerUrl: careerUrl.trim(),
          atsType: atsType as CompanyWatch['atsType'],
          atsEndpoint,
        });
      }

      setDialogOpen(false);
      resetForm();
      await fetchCompanies();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : editingCompany
            ? t('companyWatchPage.editFailed')
            : t('companyWatchPage.addFailed')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('companyWatchPage.title')}</h1>
          <p className="text-muted-foreground">{t('companyWatchPage.subtitle')}</p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('companyWatchPage.title')}</h1>
          <p className="text-muted-foreground">{t('companyWatchPage.subtitle')}</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          {t('companyWatchPage.addCompany')}
        </Button>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? t('companyWatchPage.editDialogTitle') : t('companyWatchPage.addDialogTitle')}
              </DialogTitle>
              <DialogDescription>
                {editingCompany
                  ? t('companyWatchPage.editDialogDescription')
                  : t('companyWatchPage.addDialogDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Input
                label={t('companyWatchPage.nameLabel')}
                placeholder={t('companyWatchPage.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <Input
                label={t('companyWatchPage.careerUrlLabel')}
                placeholder={t('companyWatchPage.careerUrlPlaceholder')}
                value={careerUrl}
                onChange={(e) => setCareerUrl(e.target.value)}
                type="url"
              />
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('companyWatchPage.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? t('companyWatchPage.submitting')
                  : editingCompany
                    ? t('companyWatchPage.saveChanges')
                    : t('companyWatchPage.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('companyWatchPage.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onEdit={openEditDialog}
              onDelete={handleDelete}
              isDeleting={deletingId === company.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyCard({
  company,
  onEdit,
  onDelete,
  isDeleting,
}: {
  company: CompanyWatch;
  onEdit: (company: CompanyWatch) => void;
  onDelete: (company: CompanyWatch) => void;
  isDeleting: boolean;
}): React.JSX.Element {
  const { t, locale } = useTranslation();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {company.name}
          </div>
        </CardTitle>
        <div className="flex items-center gap-1">
          {company.lastSyncStatus === 'success' ? (
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : company.lastSyncStatus === 'failed' ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(company)}
            aria-label={t('companyWatchPage.editAria')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onDelete(company)}
            disabled={isDeleting}
            aria-label={t('companyWatchPage.deleteAria')}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('companyWatchPage.atsType')}</span>
            <Badge variant="secondary">{company.atsType}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('companyWatchPage.status')}</span>
            <Badge variant={company.active ? 'default' : 'secondary'}>
              {company.active ? t('companyWatchPage.active') : t('companyWatchPage.inactive')}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('companyWatchPage.lastSync')}</span>
            <span>{company.lastSyncAt ? formatDateTime(company.lastSyncAt, locale) : t('companyWatchPage.never')}</span>
          </div>
          {company.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {company.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          {company.lastSyncError && (
            <p className="text-xs text-destructive mt-2">{company.lastSyncError}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
