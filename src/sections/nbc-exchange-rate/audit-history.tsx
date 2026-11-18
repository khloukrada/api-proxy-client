'use client';

import type { NbcRateAudit, NbcAuditRate, NbcAuditResponse } from 'src/types/nbc-exchange-rate';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

import axios, { endpoints } from 'src/lib/axios';

import { getErrorMessage } from 'src/auth/utils';

import { formatRateDate, formatAuditTime, formatRateValue } from './format';

const eventLabels = {
  manual_created: 'Manual entry',
  manual_revised: 'Manual revision',
  nbc_imported: 'NBC imported',
  nbc_updated: 'NBC updated',
  nbc_replaced_manual: 'NBC replaced manual',
} as const;
const emptyFilters = { search: '', from: '', to: '', event: '' };

function actorLabel(actor: NbcRateAudit['actor']) {
  if (actor.name) return actor.name;
  if (actor.type === 'system') return 'Automatic NBC sync';
  if (actor.type === 'administrator') return 'Administrator (name unavailable)';
  return 'Actor not recorded';
}

function RateSnapshot({ title, rate }: { title: string; rate: NbcAuditRate | null }) {
  return (
    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1, minWidth: 0 }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {rate ? (
        <Stack spacing={1}>
          <Typography variant="body2">
            Source: {rate.source === 'nbc' ? 'NBC' : 'Manual'} · Unit: {rate.unit} USD
          </Typography>
          {(['bid', 'ask', 'average'] as const).map((field) => (
            <Typography
              key={field}
              variant="body2"
              sx={{
                textTransform: 'capitalize',
                fontVariantNumeric: 'tabular-nums',
                overflowWrap: 'anywhere',
              }}
            >
              {field}: {formatRateValue(rate[field])} KHR
            </Typography>
          ))}
          {rate.note && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
            >
              {rate.note}
            </Typography>
          )}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No previous saved rate
        </Typography>
      )}
    </Box>
  );
}

type Props = { reloadKey: number; rateDate: string; onClearRateDate: () => void };

export function AuditHistory({ reloadKey, rateDate, onClearRateDate }: Props) {
  const [filters, setFilters] = useState(emptyFilters);
  const [query, setQuery] = useState({ ...emptyFilters, page: 0, pageSize: 10 });
  const [data, setData] = useState<NbcAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<NbcRateAudit | null>(null);
  const [retry, setRetry] = useState(0);
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrorMessage(null);
    const load = async () => {
      try {
        const response = await axios.get<NbcAuditResponse>(
          `${endpoints.admin.nbcExchangeRates}/audits`,
          {
            params: {
              rate_date: rateDate || undefined,
              search: query.search || undefined,
              from: query.from || undefined,
              to: query.to || undefined,
              event: query.event || undefined,
              page: query.page + 1,
              per_page: query.pageSize,
            },
            signal: controller.signal,
          }
        );
        if (!controller.signal.aborted) setData(response.data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setData(null);
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [query, rateDate, reloadKey, retry]);

  return (
    <>
      <Card>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6">Audit history</Typography>
          <Typography variant="body2" sx={{ mt: 1, mb: 2, color: 'text.secondary' }}>
            Every recorded manual change and changed NBC rate, newest first. Times are in Cambodia
            (UTC+7). Unchanged NBC checks are not recorded as changes.
          </Typography>
          {rateDate && (
            <Chip
              label={`Rate date: ${formatRateDate(rateDate)}`}
              onDelete={onClearRateDate}
              sx={{ mb: 2 }}
            />
          )}
          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!invalidRange) setQuery((previous) => ({ ...previous, ...filters, page: 0 }));
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              useFlexGap
              sx={{ flexWrap: 'wrap', alignItems: { md: 'flex-start' } }}
            >
              <TextField
                label="Search author or note"
                size="small"
                value={filters.search}
                sx={{ flexGrow: 1 }}
                onChange={(event) =>
                  setFilters((previous) => ({ ...previous, search: event.target.value }))
                }
                slotProps={{ htmlInput: { maxLength: 100 } }}
              />
              <TextField
                label="Change type"
                select
                size="small"
                value={filters.event}
                sx={{ minWidth: 200 }}
                onChange={(event) =>
                  setFilters((previous) => ({ ...previous, event: event.target.value }))
                }
              >
                <MenuItem value="">All changes</MenuItem>
                <MenuItem value="manual">Manual changes</MenuItem>
                <MenuItem value="nbc">NBC changes</MenuItem>
                <MenuItem value="nbc_replaced_manual">NBC replaced manual</MenuItem>
              </TextField>
              <TextField
                label="Changed from"
                type="date"
                size="small"
                value={filters.from}
                onChange={(event) =>
                  setFilters((previous) => ({ ...previous, from: event.target.value }))
                }
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Changed to"
                type="date"
                size="small"
                value={filters.to}
                error={invalidRange}
                helperText={invalidRange ? 'Choose a date on or after the start date.' : undefined}
                onChange={(event) =>
                  setFilters((previous) => ({ ...previous, to: event.target.value }))
                }
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { min: filters.from || undefined },
                }}
              />
              <Button type="submit" variant="contained" disabled={loading || invalidRange}>
                Apply
              </Button>
              <Button
                disabled={loading}
                onClick={() => {
                  setFilters(emptyFilters);
                  setQuery((previous) => ({ ...previous, ...emptyFilters, page: 0 }));
                  onClearRateDate();
                }}
              >
                Clear
              </Button>
            </Stack>
          </Box>
          {errorMessage && (
            <Alert
              severity="error"
              sx={{ mt: 2 }}
              action={
                <Button color="inherit" onClick={() => setRetry((value) => value + 1)}>
                  Retry
                </Button>
              }
            >
              {errorMessage}
            </Alert>
          )}
        </Box>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table aria-label="Exchange rate audit history" sx={{ minWidth: 1100 }}>
            <TableHead>
              <TableRow>
                <TableCell>Changed at (UTC+7)</TableCell>
                <TableCell>Rate date</TableCell>
                <TableCell>Change</TableCell>
                <TableCell>Previous average</TableCell>
                <TableCell>New average</TableCell>
                <TableCell>Changed by</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }, (_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={7}>
                      <Skeleton />
                    </TableCell>
                  </TableRow>
                ))
              ) : data?.data.length ? (
                data.data.map((audit) => (
                  <TableRow key={audit.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatAuditTime(audit.changed_at)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatRateDate(audit.rate_date)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="soft"
                        label={eventLabels[audit.event]}
                        color={
                          audit.event === 'nbc_replaced_manual'
                            ? 'info'
                            : audit.new_rate.source === 'manual'
                              ? 'warning'
                              : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {audit.previous_rate ? (
                        <>
                          {formatRateValue(audit.previous_rate.average)} KHR
                          <Typography
                            variant="caption"
                            sx={{ display: 'block' }}
                            color="text.secondary"
                          >
                            per {audit.previous_rate.unit} USD ·{' '}
                            {audit.previous_rate.source === 'nbc' ? 'NBC' : 'Manual'}
                          </Typography>
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatRateValue(audit.new_rate.average)} KHR
                      <Typography
                        variant="caption"
                        sx={{ display: 'block' }}
                        color="text.secondary"
                      >
                        per {audit.new_rate.unit} USD ·{' '}
                        {audit.new_rate.source === 'nbc' ? 'NBC' : 'Manual'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 160, maxWidth: 240, overflowWrap: 'anywhere' }}>
                      {actorLabel(audit.actor)}
                      {audit.new_rate.source === 'nbc' && audit.actor.type === 'administrator' && (
                        <Typography
                          variant="caption"
                          sx={{ display: 'block' }}
                          color="text.secondary"
                        >
                          Requested NBC sync
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => setSelected(audit)}
                        aria-label={`View change ${audit.id}`}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    {errorMessage
                      ? 'Audit history could not be loaded.'
                      : 'No recorded changes match these filters.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={data ? query.page : 0}
          rowsPerPage={query.pageSize}
          rowsPerPageOptions={[10, 25, 50, 100]}
          disabled={loading || Boolean(errorMessage)}
          onPageChange={(_, page) => setQuery((previous) => ({ ...previous, page }))}
          onRowsPerPageChange={(event) =>
            setQuery((previous) => ({ ...previous, page: 0, pageSize: Number(event.target.value) }))
          }
        />
        <Typography
          variant="caption"
          sx={{ display: 'block', px: 3, pb: 3, color: 'text.secondary' }}
        >
          Changes made before audit recording was enabled may not be available.
        </Typography>
      </Card>
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        fullWidth
        maxWidth="md"
        aria-labelledby="audit-detail-title"
      >
        <DialogTitle id="audit-detail-title">
          {selected ? eventLabels[selected.event] : 'Change details'}
        </DialogTitle>
        <DialogContent>
          {selected && (
            <Stack spacing={3}>
              <Typography variant="body2">
                Rate date: {formatRateDate(selected.rate_date)} · Changed{' '}
                {formatAuditTime(selected.changed_at)} (UTC+7)
                <br />
                {actorLabel(selected.actor)}
              </Typography>
              <Box
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
              >
                <RateSnapshot title="Before" rate={selected.previous_rate} />
                <RateSnapshot title="After" rate={selected.new_rate} />
              </Box>
              {selected.note && (
                <Box>
                  <Typography variant="subtitle2">Reason for change</Typography>
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {selected.note}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
