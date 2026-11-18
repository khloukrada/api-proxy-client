'use client';

import type { NbcRateConflict } from 'src/types/nbc-exchange-rate';

import { useState } from 'react';
import { isAxiosError } from 'axios';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import axios, { endpoints } from 'src/lib/axios';

import { getErrorMessage } from 'src/auth/utils';

type Props = { onClose: () => void; onSaved: (date: string) => void };

export function ManualRateDialog({ onClose, onSaved }: Props) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' }).format(
    new Date()
  );
  const [date, setDate] = useState(today);
  const [rate, setRate] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [conflict, setConflict] = useState<NbcRateConflict | null>(null);
  const [replace, setReplace] = useState(false);
  const validRate = /^\d{1,12}(?:\.\d{1,8})?$/.test(rate) && Number(rate) > 0;

  const save = async () => {
    if (submitting || !validRate || !note.trim() || !date || (conflict && !replace)) return;
    setSubmitting(true);
    setErrorMessage(null);
    setFieldErrors({});
    try {
      await axios.post(endpoints.admin.nbcExchangeRates, {
        date,
        rate,
        note: note.trim(),
        expected_version: replace ? conflict?.version : undefined,
      });
      onSaved(date);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      if (isAxiosError(error)) {
        setFieldErrors(error.response?.data?.errors ?? {});
        if (error.response?.data?.error_code === 'NBC_RATE_CONFLICT') {
          setConflict(error.response.data.current_rate ?? null);
          setReplace(false);
        }
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
      aria-labelledby="manual-rate-title"
    >
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <DialogTitle id="manual-rate-title">Enter exchange rate</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <Alert severity="info">
              This manual USD/KHR rate will be available to gateway clients. A successful NBC sync
              for the same date replaces it; the previous value is kept in the audit history.
            </Alert>
            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
            <TextField
              label="Rate date"
              type="date"
              value={date}
              required
              disabled={submitting}
              error={Boolean(fieldErrors.date)}
              helperText={fieldErrors.date?.[0] ?? 'Today or an earlier date, in Cambodia time.'}
              onChange={(event) => {
                setDate(event.target.value);
                setConflict(null);
                setReplace(false);
                setErrorMessage(null);
                setFieldErrors({});
              }}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: '1900-01-01', max: today },
              }}
            />
            <TextField
              label="Exchange rate for 1 USD"
              value={rate}
              required
              disabled={submitting}
              onChange={(event) => setRate(event.target.value)}
              error={Boolean(fieldErrors.rate) || Boolean(rate && !validRate)}
              helperText={
                fieldErrors.rate?.[0] ??
                (rate && !validRate
                  ? 'Enter a positive number with up to 8 decimal places.'
                  : 'The same value is saved for bid, ask, and average.')
              }
              slotProps={{
                htmlInput: { inputMode: 'decimal', maxLength: 21 },
                input: { endAdornment: <InputAdornment position="end">KHR</InputAdornment> },
              }}
            />
            <TextField
              label="Reason or source"
              value={note}
              required
              multiline
              minRows={2}
              disabled={submitting}
              onChange={(event) => setNote(event.target.value)}
              error={Boolean(fieldErrors.note)}
              helperText={
                fieldErrors.note?.[0] ??
                'Explain why this rate is being entered manually (maximum 500 characters).'
              }
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
            {conflict && (
              <Box sx={{ p: 2, border: 1, borderColor: 'warning.main', borderRadius: 1 }}>
                <Typography variant="subtitle2">Existing rate for {conflict.rate_date}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {conflict.unit} USD ={' '}
                  {Number(conflict.average).toLocaleString('en-US', { maximumFractionDigits: 8 })}{' '}
                  KHR · {conflict.source === 'nbc' ? 'NBC' : 'Manual'}
                </Typography>
                <FormControlLabel
                  sx={{ mt: 1 }}
                  control={
                    <Checkbox
                      checked={replace}
                      disabled={submitting}
                      onChange={(event) => setReplace(event.target.checked)}
                    />
                  }
                  label="Replace this saved rate with my manual entry"
                />
              </Box>
            )}
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
            disabled={!validRate || !note.trim() || !date || Boolean(conflict && !replace)}
          >
            {replace ? 'Replace rate' : 'Save rate'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
