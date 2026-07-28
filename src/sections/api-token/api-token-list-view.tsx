'use client';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  ApiToken,
  ServiceAccount,
  ApiTokenAbility,
  ApiTokenIndexResponse,
  ApiTokenMutationResponse,
} from 'src/types/api-token';

import dayjs from 'dayjs';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import { DataGrid } from '@mui/x-data-grid';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import FormGroup from '@mui/material/FormGroup';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

import axios, { endpoints } from 'src/lib/axios';
import { dedupeRequest } from 'src/lib/dedupe-request';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';

import { getErrorMessage } from 'src/auth/utils';

// ----------------------------------------------------------------------

const EXPIRATION_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
  { value: 730, label: '2 years' },
];

const formatDate = (value: string | null) =>
  value ? dayjs(value).format('DD MMM YYYY, HH:mm') : 'Never';

export function ApiTokenListView() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [serviceAccounts, setServiceAccounts] = useState<ServiceAccount[]>([]);
  const [availableAbilities, setAvailableAbilities] = useState<ApiTokenAbility[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [serviceAccountId, setServiceAccountId] = useState<number | ''>('');
  const [abilities, setAbilities] = useState<string[]>([]);
  const [expirationDays, setExpirationDays] = useState(365);
  const [submitting, setSubmitting] = useState(false);

  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenToRevoke, setTokenToRevoke] = useState<ApiToken | null>(null);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await dedupeRequest(endpoints.admin.tokens, () =>
        axios.get<ApiTokenIndexResponse>(endpoints.admin.tokens)
      );
      const payload = response.data;

      setTokens(payload.tokens);
      setServiceAccounts(payload.service_accounts);
      setAvailableAbilities(payload.available_abilities);
      setExpirationDays(payload.default_expiration_days);
      setServiceAccountId((current) => current || payload.service_accounts[0]?.id || '');
      setAbilities((current) =>
        current.length ? current : payload.available_abilities.map((ability) => ability.value)
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const resetCreateForm = () => {
    setName('');
    setServiceAccountId(serviceAccounts[0]?.id || '');
    setAbilities(availableAbilities.map((ability) => ability.value));
    setErrorMessage(null);
  };

  const handleCreate = async () => {
    if (!name.trim() || !serviceAccountId || abilities.length === 0) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await axios.post<ApiTokenMutationResponse>(endpoints.admin.tokens, {
        name: name.trim(),
        service_account_id: serviceAccountId,
        abilities,
        expires_in_days: expirationDays,
      });

      setSecret(response.data.plain_text_token);
      setCreateOpen(false);
      resetCreateForm();
      await loadTokens();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRotate = async (token: ApiToken) => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await axios.post<ApiTokenMutationResponse>(
        `${endpoints.admin.tokens}/${token.id}/rotate`,
        { expires_in_days: expirationDays }
      );

      setSecret(response.data.plain_text_token);
      await loadTokens();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!tokenToRevoke) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await axios.delete(`${endpoints.admin.tokens}/${tokenToRevoke.id}`);
      setTokenToRevoke(null);
      await loadTokens();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!secret) return;

    await navigator.clipboard.writeText(secret);
    setCopied(true);
  };

  const columns: GridColDef<ApiToken>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'service_account',
      headerName: 'Service account',
      flex: 1,
      minWidth: 220,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack sx={{ py: 1 }}>
          <Typography variant="body2">{row.service_account?.name ?? 'Unknown'}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {row.service_account?.email}
            {row.service_account?.is_active === false ? ' · Inactive' : ''}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'abilities',
      headerName: 'Abilities',
      flex: 1.25,
      minWidth: 240,
      sortable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ py: 1, flexWrap: 'wrap' }}>
          {row.abilities.map((ability) => (
            <Chip key={ability} label={ability} size="small" variant="soft" color="primary" />
          ))}
        </Stack>
      ),
    },
    {
      field: 'last_used_at',
      headerName: 'Last used',
      width: 175,
      renderCell: ({ row }) => formatDate(row.last_used_at),
    },
    {
      field: 'expires_at',
      headerName: 'Expires',
      width: 175,
      renderCell: ({ row }) => formatDate(row.expires_at),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: ({ row }) => (
        <Chip
          label={row.status}
          size="small"
          color={row.status === 'active' ? 'success' : 'error'}
          variant="soft"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Stack direction="row">
          <Tooltip title="Create replacement token">
            <span>
              <IconButton
                size="small"
                aria-label="Create replacement token"
                disabled={
                  submitting || row.status === 'expired' || row.service_account?.is_active === false
                }
                onClick={() => handleRotate(row)}
              >
                <Iconify icon="solar:restart-bold" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Revoke token">
            <span>
              <IconButton
                size="small"
                color="error"
                aria-label="Revoke token"
                disabled={submitting}
                onClick={() => setTokenToRevoke(row)}
              >
                <Iconify icon="solar:trash-bin-trash-bold" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <DashboardContent maxWidth="xl">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          mb: 3,
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h4">API tokens</Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            Issue scoped credentials for trusted service clients.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Iconify icon="mingcute:add-line" />}
          disabled={serviceAccounts.length === 0}
          onClick={() => {
            resetCreateForm();
            setCreateOpen(true);
          }}
        >
          Create token
        </Button>
      </Stack>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {!loading && serviceAccounts.length === 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No active service account is configured. Create or activate one from Service accounts.
        </Alert>
      )}

      <Card>
        <DataGrid
          autoHeight
          rows={tokens}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
          getRowHeight={() => 'auto'}
          sx={{ minHeight: 420, border: 0 }}
        />
      </Card>

      <Dialog open={createOpen} onClose={() => !submitting && setCreateOpen(false)} fullWidth>
        <DialogTitle>Create API token</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="Token name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="vps1-production"
            />

            <TextField
              select
              label="Service account"
              value={serviceAccountId}
              onChange={(event) => setServiceAccountId(Number(event.target.value))}
            >
              {serviceAccounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name} ({account.email})
                </MenuItem>
              ))}
            </TextField>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Abilities
              </Typography>
              <FormGroup>
                {availableAbilities.map((ability) => (
                  <FormControlLabel
                    key={ability.value}
                    label={`${ability.label} (${ability.value})`}
                    control={
                      <Checkbox
                        checked={abilities.includes(ability.value)}
                        onChange={(event) =>
                          setAbilities((current) =>
                            event.target.checked
                              ? [...current, ability.value]
                              : current.filter((item) => item !== ability.value)
                          )
                        }
                      />
                    }
                  />
                ))}
              </FormGroup>
            </Box>

            <TextField
              select
              label="Expiration"
              value={expirationDays}
              onChange={(event) => setExpirationDays(Number(event.target.value))}
            >
              {EXPIRATION_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            loading={submitting}
            disabled={!name.trim() || !serviceAccountId || abilities.length === 0}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(secret)}
        onClose={() => {
          setSecret(null);
          setCopied(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Copy your new token</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 3 }}>
            This secret is shown once. Store it in the client&apos;s secret manager before closing.
          </Alert>
          <TextField
            fullWidth
            multiline
            minRows={3}
            value={secret ?? ''}
            slotProps={{ htmlInput: { readOnly: true } }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<Iconify icon={copied ? 'solar:check-circle-bold' : 'solar:copy-bold'} />}
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy token'}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setSecret(null);
              setCopied(false);
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(tokenToRevoke)} onClose={() => setTokenToRevoke(null)}>
        <DialogTitle>Revoke API token?</DialogTitle>
        <DialogContent>
          <Typography>
            Calls using <strong>{tokenToRevoke?.name}</strong> will stop working immediately.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTokenToRevoke(null)} disabled={submitting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleRevoke} loading={submitting}>
            Revoke
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardContent>
  );
}
