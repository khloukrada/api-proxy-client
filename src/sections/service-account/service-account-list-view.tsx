'use client';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  ManagedServiceAccount,
  ServiceAccountIndexResponse,
  ServiceAccountMutationResponse,
} from 'src/types/service-account';

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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormHelperText from '@mui/material/FormHelperText';

import axios, { endpoints } from 'src/lib/axios';
import { dedupeRequest } from 'src/lib/dedupe-request';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';

import { getErrorMessage } from 'src/auth/utils';

// ----------------------------------------------------------------------

const formatDate = (value: string | null) =>
  value ? dayjs(value).format('DD MMM YYYY, HH:mm') : 'Unknown';

export function ServiceAccountListView() {
  const [serviceAccounts, setServiceAccounts] = useState<ManagedServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManagedServiceAccount | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [statusTarget, setStatusTarget] = useState<ManagedServiceAccount | null>(null);

  const loadServiceAccounts = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await dedupeRequest(endpoints.admin.serviceAccounts, () =>
        axios.get<ServiceAccountIndexResponse>(endpoints.admin.serviceAccounts)
      );
      setServiceAccounts(response.data.service_accounts);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServiceAccounts();
  }, [loadServiceAccounts]);

  const openCreateDialog = () => {
    setEditingAccount(null);
    setName('');
    setEmail('');
    setErrorMessage(null);
    setFormOpen(true);
  };

  const openEditDialog = (account: ManagedServiceAccount) => {
    setEditingAccount(account);
    setName(account.name);
    setEmail(account.email);
    setErrorMessage(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingAccount) {
        await axios.patch<ServiceAccountMutationResponse>(
          `${endpoints.admin.serviceAccounts}/${editingAccount.id}`,
          {
            name: name.trim(),
            email: email.trim(),
            is_active: editingAccount.is_active,
          }
        );
      } else {
        await axios.post<ServiceAccountMutationResponse>(endpoints.admin.serviceAccounts, {
          name: name.trim(),
          email: email.trim(),
        });
      }

      setFormOpen(false);
      await loadServiceAccounts();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusTarget) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await axios.patch<ServiceAccountMutationResponse>(
        `${endpoints.admin.serviceAccounts}/${statusTarget.id}`,
        {
          name: statusTarget.name,
          email: statusTarget.email,
          is_active: !statusTarget.is_active,
        }
      );

      setStatusTarget(null);
      await loadServiceAccounts();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const columns: GridColDef<ManagedServiceAccount>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 190,
    },
    {
      field: 'email',
      headerName: 'Identifier',
      flex: 1,
      minWidth: 230,
    },
    {
      field: 'tokens_count',
      headerName: 'Tokens',
      width: 100,
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'active_tokens_count',
      headerName: 'Unexpired',
      width: 110,
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 180,
      renderCell: ({ row }) => formatDate(row.created_at),
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 110,
      renderCell: ({ row }) => (
        <Chip
          label={row.is_active ? 'Active' : 'Inactive'}
          size="small"
          color={row.is_active ? 'success' : 'default'}
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
          <Tooltip title="Edit service account">
            <span>
              <IconButton
                size="small"
                aria-label="Edit service account"
                disabled={submitting}
                onClick={() => openEditDialog(row)}
              >
                <Iconify icon="solar:pen-bold" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={row.is_active ? 'Deactivate account' : 'Activate account'}>
            <span>
              <IconButton
                size="small"
                color={row.is_active ? 'error' : 'success'}
                aria-label={
                  row.is_active ? 'Deactivate service account' : 'Activate service account'
                }
                disabled={submitting}
                onClick={() => setStatusTarget(row)}
              >
                <Iconify
                  icon={row.is_active ? 'solar:forbidden-circle-bold' : 'solar:restart-bold'}
                />
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
          <Typography variant="h4">Service accounts</Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            Manage the non-human identities that receive scoped API tokens.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={openCreateDialog}
        >
          Create service account
        </Button>
      </Stack>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      <Card>
        <DataGrid
          autoHeight
          rows={serviceAccounts}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
          sx={{ minHeight: 420, border: 0 }}
        />
      </Card>

      <Dialog
        open={formOpen}
        onClose={() => !submitting && setFormOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editingAccount ? 'Edit service account' : 'Create service account'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="VPS1 Production"
            />
            <Box>
              <TextField
                fullWidth
                label="Identifier email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="vps1@example.com"
              />
              <FormHelperText>
                Used as a unique identifier only; service accounts cannot sign in.
              </FormHelperText>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            loading={submitting}
            disabled={!name.trim() || !email.trim()}
          >
            {editingAccount ? 'Save changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(statusTarget)}
        onClose={() => !submitting && setStatusTarget(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {statusTarget?.is_active ? 'Deactivate service account?' : 'Activate service account?'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>
            {statusTarget?.is_active
              ? 'All bearer tokens for this account will be denied immediately. Token records remain available for review or revocation.'
              : 'Existing unexpired tokens for this account will be allowed again.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusTarget(null)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={statusTarget?.is_active ? 'error' : 'success'}
            onClick={handleStatusChange}
            loading={submitting}
          >
            {statusTarget?.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardContent>
  );
}
