'use client';

import type { NbcRateConflict, NbcExchangeRate } from 'src/types/nbc-exchange-rate';

import { useState } from 'react';
import { isAxiosError } from 'axios';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';

import axios, { endpoints } from 'src/lib/axios';

import { getErrorMessage } from 'src/auth/utils';

import { formatRateDate, formatRateValue } from './format';

type Props = { rate: NbcExchangeRate; onClose: () => void; onSaved: (date: string) => void };
const labels = { bid: 'Bid', ask: 'Ask', average: 'Average' } as const;

export function ReviseRateDialog({ rate, onClose, onSaved }: Props) {
  const [snapshot, setSnapshot] = useState<NbcRateConflict>({
    rate_date: rate.rate_date,
    unit: rate.unit,
    source: rate.source,
    version: rate.version,
    ...rate.decimal_values,
  });
  const [values, setValues] = useState(rate.decimal_values);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [conflict, setConflict] = useState<NbcRateConflict | null>(null);
  const [blocked, setBlocked] = useState(false);
  const valid = Object.values(values).every(
    (value) => /^\d{1,12}(?:\.\d{1,8})?$/.test(value) && Number(value) > 0
  );

  const save = async () => {
    if (submitting || blocked || !valid || !note.trim()) return;
    setSubmitting(true);
    setErrorMessage(null);
    setFieldErrors({});
    try {
      await axios.patch(`${endpoints.admin.nbcExchangeRates}/${snapshot.rate_date}`, {
        ...values,
        note: note.trim(),
        expected_version: snapshot.version,
      });
      onSaved(snapshot.rate_date);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      if (isAxiosError(error)) {
        setFieldErrors(error.response?.data?.errors ?? {});
        if (error.response?.data?.error_code === 'NBC_RATE_CONFLICT') {
          setBlocked(true);
          setConflict(error.response.data.current_rate ?? null);
        }
        if (error.response?.status === 404) setBlocked(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={() => !submitting && onClose()}
      fullWidth
      maxWidth="sm"
      aria-labelledby="revise-rate-title"
    >
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <DialogTitle id="revise-rate-title">Revise exchange rate</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <Alert severity="info">
              Your revision is saved as a manual rate with an audit record. NBC may replace it when
              syncing the same date.
            </Alert>
            <Box>
              <Typography variant="subtitle1">
                {formatRateDate(snapshot.rate_date)} · {snapshot.unit} USD
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current average: {formatRateValue(snapshot.average)} KHR ·{' '}
                {snapshot.source === 'nbc' ? 'NBC' : 'Manual'}
              </Typography>
            </Box>
            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
            {blocked && (
              <Alert severity="warning">
                {conflict
                  ? 'The saved rate changed while this form was open. Load the latest values and reapply your revision.'
                  : 'Close this form and reload the saved history before continuing.'}
                {conflict && (
                  <Button
                    sx={{ mt: 1 }}
                    color="inherit"
                    onClick={() => {
                      setSnapshot(conflict);
                      setValues({
                        bid: conflict.bid,
                        ask: conflict.ask,
                        average: conflict.average,
                      });
                      setConflict(null);
                      setBlocked(false);
                      setErrorMessage(null);
                      setFieldErrors({});
                    }}
                  >
                    Load latest saved values
                  </Button>
                )}
              </Alert>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {(['bid', 'ask', 'average'] as const).map((key) => (
                <TextField
                  key={key}
                  fullWidth
                  required
                  label={labels[key]}
                  value={values[key]}
                  disabled={submitting || blocked}
                  onChange={(event) =>
                    setValues((previous) => ({ ...previous, [key]: event.target.value }))
                  }
                  error={Boolean(fieldErrors[key])}
                  helperText={fieldErrors[key]?.[0]}
                  slotProps={{
                    htmlInput: { inputMode: 'decimal', maxLength: 21 },
                    input: { endAdornment: <InputAdornment position="end">KHR</InputAdornment> },
                  }}
                />
              ))}
            </Stack>
            {!valid && (
              <Typography color="error" variant="body2">
                Enter positive rates with up to 8 decimal places.
              </Typography>
            )}
            <TextField
              label="Reason for revision"
              required
              value={note}
              multiline
              minRows={2}
              disabled={submitting}
              onChange={(event) => setNote(event.target.value)}
              error={Boolean(fieldErrors.note)}
              helperText={fieldErrors.note?.[0] ?? 'Recorded with your name in the audit history.'}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            loading={submitting}
            disabled={blocked || !valid || !note.trim()}
          >
            Save revision
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
