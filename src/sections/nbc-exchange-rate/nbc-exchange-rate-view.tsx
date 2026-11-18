'use client';

import type { NbcExchangeRate, NbcExchangeRateResponse } from 'src/types/nbc-exchange-rate';

import { isAxiosError } from 'axios';
import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

import axios, { endpoints } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';

import { getErrorMessage } from 'src/auth/utils';

import { AuditHistory } from './audit-history';
import { ManualRateDialog } from './manual-rate-dialog';
import { ReviseRateDialog } from './revise-rate-dialog';

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Phnom_Penh',
});
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Phnom_Penh',
});
const formatDate = (value: string) => dateFormat.format(new Date(`${value}T00:00:00+07:00`));
const formatTime = (value: string) => timeFormat.format(new Date(value));

const statusLabels = {
  fresh: { label: 'Fresh', color: 'success' },
  stale: { label: 'Stale', color: 'warning' },
  expired: { label: 'Expired', color: 'error' },
  unavailable: { label: 'No saved data', color: 'default' },
  manual: { label: 'Manual entry', color: 'warning' },
} as const;

function statusMessage(status: NbcExchangeRateResponse['status']) {
  if (status.state === 'unavailable') {
    return 'No USD/KHR rate has been saved yet. Rates will appear after a successful scheduled update.';
  }
  if (status.expired) {
    return 'This rate exceeds the allowed age. It is shown for reference only and is unavailable as a current rate through the gateway.';
  }
  if (status.state === 'manual') {
    return 'This rate was entered by an administrator and has not been verified by NBC. A successful NBC sync for the same date replaces it, keeping an audit record.';
  }
  if (status.state === 'fresh') {
    return 'The saved rate is published for today in Cambodia and was checked within the configured refresh interval.';
  }
  return [
    status.publication_is_older &&
      'The latest saved publication is from an earlier date. A new rate may not be available on weekends or holidays.',
    status.check_is_overdue && 'The scheduled check is overdue. The last saved rate is shown.',
  ]
    .filter(Boolean)
    .join(' ');
}

export function NbcExchangeRateView() {
  const [data, setData] = useState<NbcExchangeRateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [revisionRate, setRevisionRate] = useState<NbcExchangeRate | null>(null);
  const [activeTab, setActiveTab] = useState<'rates' | 'audits'>('rates');
  const [auditRateDate, setAuditRateDate] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    severity: 'success' | 'error' | 'warning';
  } | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [clockTime, setClockTime] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState({ from: '', to: '', page: 0, pageSize: 10 });
  const invalidRange = Boolean(from && to && from > to);

  useEffect(() => {
    if (!cooldownUntil) return undefined;
    const timer = window.setInterval(() => {
      setClockTime(Date.now());
      if (Date.now() >= cooldownUntil) setCooldownUntil(0);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const syncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    setNotice(null);
    try {
      const response = await axios.post<{ message: string }>(
        `${endpoints.admin.nbcExchangeRates}/sync`
      );
      setNotice({ severity: 'success', message: response.data.message });
      setReloadKey((value) => value + 1);
    } catch (error) {
      const retryAfter = isAxiosError(error)
        ? Number(error.response?.data?.retry_after ?? error.response?.headers?.['retry-after'])
        : 0;
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        const now = Date.now();
        setClockTime(now);
        setCooldownUntil(now + retryAfter * 1000);
      }
      setNotice({
        severity: isAxiosError(error) && error.response?.status === 429 ? 'warning' : 'error',
        message: getErrorMessage(error),
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrorMessage(null);

    const load = async () => {
      try {
        const response = await axios.get<NbcExchangeRateResponse>(
          endpoints.admin.nbcExchangeRates,
          {
            params: {
              from: query.from || undefined,
              to: query.to || undefined,
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
  }, [query, reloadKey]);

  const latest = data?.latest;
  const status = data ? statusLabels[data.status.state] : null;
  const hasFilters = Boolean(query.from || query.to);
  const retrySeconds = Math.max(0, Math.ceil((cooldownUntil - clockTime) / 1000));

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
          <Typography variant="h4">NBC Exchange Rates</Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary' }}>
            Saved USD/KHR rates from NBC and administrator entries.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', flexShrink: 0 }}>
          <Button
            variant="outlined"
            loading={loading}
            disabled={syncing}
            sx={{ flexShrink: 0 }}
            startIcon={<Iconify icon="solar:restart-bold" />}
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Reload
          </Button>
          <Button
            variant="outlined"
            disabled={syncing || loading}
            onClick={() => setManualOpen(true)}
          >
            Enter rate
          </Button>
          <Button
            variant="contained"
            loading={syncing}
            disabled={loading || retrySeconds > 0}
            onClick={syncNow}
          >
            {retrySeconds > 0
              ? `Sync in ${Math.floor(retrySeconds / 60)}:${String(retrySeconds % 60).padStart(2, '0')}`
              : 'Sync now'}
          </Button>
        </Stack>
      </Stack>

      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 3 }} onClose={() => setNotice(null)}>
          {notice.message}
        </Alert>
      )}

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Unable to load exchange rates. {errorMessage} Use Reload to try again.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.15fr 1fr' },
          gap: 3,
          mb: 3,
        }}
      >
        <Card sx={{ p: 3 }}>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}
          >
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Latest saved rate
            </Typography>
            <Chip label="USD / KHR" size="small" variant="soft" color="primary" />
          </Stack>
          {loading ? (
            <Skeleton height={120} />
          ) : latest ? (
            <>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {numberFormat.format(latest.unit)} USD equals ·{' '}
                {latest.source === 'manual' ? 'Manual rate' : 'NBC average'}
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  mt: 1,
                  fontSize: { xs: 32, sm: 44 },
                  overflowWrap: 'anywhere',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {numberFormat.format(latest.average)}{' '}
                <Box component="span" sx={{ fontSize: 20, color: 'text.secondary' }}>
                  KHR
                </Box>
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {latest.source === 'manual' ? 'Rate date' : 'Published'}{' '}
                {formatDate(latest.rate_date)}
              </Typography>
              {data?.status.expired && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  Expired · reference only
                </Typography>
              )}
              <Divider sx={{ my: 3 }} />
              <Stack direction="row" spacing={4}>
                {(['bid', 'ask'] as const).map((key) => (
                  <Box key={key}>
                    <Typography
                      variant="body2"
                      sx={{ color: 'text.secondary', textTransform: 'capitalize' }}
                    >
                      {key} (KHR)
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {numberFormat.format(latest[key])}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              <Button
                size="small"
                sx={{ mt: 2 }}
                disabled={syncing}
                onClick={() => setRevisionRate(latest)}
              >
                Revise this rate
              </Button>
            </>
          ) : (
            <Typography sx={{ py: 5, color: 'text.secondary' }}>
              {errorMessage ? 'Rate unavailable' : 'No saved USD/KHR rate yet'}
            </Typography>
          )}
        </Card>

        <Card sx={{ p: 3 }}>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}
          >
            <Typography variant="h6">Data status</Typography>
            {loading ? (
              <Skeleton width={80} />
            ) : (
              status && (
                <Chip label={status.label} color={status.color} variant="soft" size="small" />
              )
            )}
          </Stack>
          {loading ? (
            <Stack spacing={2}>
              <Skeleton />
              <Skeleton />
              <Skeleton height={70} />
            </Stack>
          ) : data ? (
            <Stack spacing={2}>
              <Alert
                severity={
                  data.status.expired
                    ? 'error'
                    : data.status.stale
                      ? 'warning'
                      : data.latest
                        ? 'success'
                        : 'info'
                }
              >
                {statusMessage(data.status)}
              </Alert>
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {latest?.source === 'manual' ? 'Manually entered' : 'Last successful NBC check'}
                </Typography>
                <Typography variant="subtitle2">
                  {latest ? formatTime(latest.recorded_at) : 'Not available'}
                </Typography>
              </Box>
              {latest?.source === 'manual' && (
                <Box>
                  <Typography variant="body2">
                    Entered by {latest.entered_by_name ?? 'Administrator'}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}
                  >
                    {latest.note}
                  </Typography>
                </Box>
              )}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Status as of {formatTime(data.as_of)}. All times are Cambodia time (UTC+7). Reload
                reads saved data. Sync now checks NBC while respecting request cooldowns.
              </Typography>
            </Stack>
          ) : (
            <Typography color="text.secondary">Status unavailable</Typography>
          )}
        </Card>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        aria-label="Exchange rate records"
        sx={{ mb: 3 }}
      >
        <Tab value="rates" label="Saved rates" id="nbc-rates-tab" aria-controls="nbc-rates-panel" />
        <Tab
          value="audits"
          label="Audit history"
          id="nbc-audits-tab"
          aria-controls="nbc-audits-panel"
        />
      </Tabs>
      {activeTab === 'audits' && (
        <Box role="tabpanel" id="nbc-audits-panel" aria-labelledby="nbc-audits-tab">
          <AuditHistory
            key={auditRateDate || 'all'}
            reloadKey={reloadKey}
            rateDate={auditRateDate}
            onClearRateDate={() => setAuditRateDate('')}
          />
        </Box>
      )}
      {activeTab === 'rates' && (
        <Card role="tabpanel" id="nbc-rates-panel" aria-labelledby="nbc-rates-tab">
          <Box sx={{ p: 3 }}>
            <Typography variant="h6">Saved rates</Typography>
            <Typography variant="body2" sx={{ mt: 1, mb: 3, color: 'text.secondary' }}>
              Latest saved value for each date. Revise a rate or open its audit trail to see
              previous values.
            </Typography>
            <Stack
              component="form"
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ alignItems: { sm: 'flex-start' } }}
              onSubmit={(event) => {
                event.preventDefault();
                if (!invalidRange) setQuery((previous) => ({ ...previous, from, to, page: 0 }));
              }}
            >
              <TextField
                label="From date"
                type="date"
                size="small"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="To date"
                type="date"
                size="small"
                value={to}
                error={invalidRange}
                helperText={invalidRange ? 'Choose a date on or after the start date.' : undefined}
                onChange={(event) => setTo(event.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from || undefined } }}
              />
              <Button type="submit" variant="contained" disabled={loading || invalidRange}>
                Apply
              </Button>
              <Button
                disabled={loading || !(from || to || hasFilters)}
                onClick={() => {
                  setFrom('');
                  setTo('');
                  setQuery((previous) => ({ ...previous, from: '', to: '', page: 0 }));
                }}
              >
                Clear
              </Button>
            </Stack>
            {hasFilters && (
              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 2, color: 'text.secondary' }}
              >
                Showing {query.from ? formatDate(query.from) : 'earliest saved date'} –{' '}
                {query.to ? formatDate(query.to) : 'latest saved date'}
              </Typography>
            )}
          </Box>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table aria-label="Saved USD/KHR exchange rate history" sx={{ minWidth: 780 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Rate date</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell align="right">Unit (USD)</TableCell>
                  <TableCell align="right">Bid (KHR)</TableCell>
                  <TableCell align="right">Ask (KHR)</TableCell>
                  <TableCell align="right">Average (KHR)</TableCell>
                  <TableCell>Updated (UTC+7)</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={8}>
                        <Skeleton />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.history.data.length ? (
                  data.history.data.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell component="th" scope="row" sx={{ whiteSpace: 'nowrap' }}>
                        {formatDate(row.rate_date)}
                      </TableCell>
                      <TableCell>
                        <Tooltip
                          title={
                            row.source === 'manual'
                              ? `${row.entered_by_name ?? 'Administrator'}: ${row.note ?? ''}`
                              : 'National Bank of Cambodia'
                          }
                        >
                          <Chip
                            label={row.source === 'manual' ? 'Manual' : 'NBC'}
                            color={row.source === 'manual' ? 'warning' : 'default'}
                            size="small"
                            variant="soft"
                          />
                        </Tooltip>
                      </TableCell>
                      {(['unit', 'bid', 'ask', 'average'] as const).map((key) => (
                        <TableCell
                          key={key}
                          align="right"
                          sx={{
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: key === 'average' ? 600 : undefined,
                          }}
                        >
                          {numberFormat.format(row[key])}
                        </TableCell>
                      ))}
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {formatTime(row.recorded_at)}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            disabled={syncing}
                            onClick={() => setRevisionRate(row)}
                            aria-label={`Revise rate for ${formatDate(row.rate_date)}`}
                          >
                            Revise
                          </Button>
                          <Button
                            size="small"
                            onClick={() => {
                              setAuditRateDate(row.rate_date);
                              setActiveTab('audits');
                            }}
                            aria-label={`Audit history for ${formatDate(row.rate_date)}`}
                          >
                            Audit
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 7, color: 'text.secondary' }}>
                      {errorMessage
                        ? 'History could not be loaded.'
                        : hasFilters
                          ? 'No saved rates in this date range.'
                          : 'No saved rates yet.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={data?.history.total ?? 0}
            page={data ? query.page : 0}
            rowsPerPage={query.pageSize}
            rowsPerPageOptions={[10, 25, 50, 100]}
            disabled={loading || Boolean(errorMessage)}
            onPageChange={(_, page) => setQuery((previous) => ({ ...previous, page }))}
            onRowsPerPageChange={(event) =>
              setQuery((previous) => ({
                ...previous,
                page: 0,
                pageSize: Number(event.target.value),
              }))
            }
          />
        </Card>
      )}
      {manualOpen && (
        <ManualRateDialog
          onClose={() => setManualOpen(false)}
          onSaved={(date) => {
            setManualOpen(false);
            setActiveTab('rates');
            setReloadKey((value) => value + 1);
            setFrom(date);
            setTo(date);
            setQuery((previous) => ({ ...previous, from: date, to: date, page: 0 }));
            setNotice({
              severity: 'success',
              message: `Manual USD/KHR rate for ${formatDate(date)} saved.`,
            });
          }}
        />
      )}
      {revisionRate && (
        <ReviseRateDialog
          rate={revisionRate}
          onClose={() => setRevisionRate(null)}
          onSaved={(date) => {
            setRevisionRate(null);
            setActiveTab('rates');
            setFrom(date);
            setTo(date);
            setQuery((previous) => ({ ...previous, from: date, to: date, page: 0 }));
            setReloadKey((value) => value + 1);
            setNotice({
              severity: 'success',
              message: `Exchange rate for ${formatDate(date)} revised. The previous value is preserved in the audit history.`,
            });
          }}
        />
      )}
    </DashboardContent>
  );
}
