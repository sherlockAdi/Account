import { useEffect, useState } from 'react';

import TextField from '@mui/material/TextField';

import { formatDate, toIsoDate } from 'utils/dateFormat';

export default function DateField({ value, onChange, inputProps, ...props }) {
  const [draft, setDraft] = useState(formatDate(value));

  useEffect(() => {
    setDraft(formatDate(value));
  }, [value]);

  const commit = (nextValue) => {
    onChange?.({ target: { value: toIsoDate(nextValue) } });
  };

  return (
    <TextField
      {...props}
      value={draft}
      placeholder="DD/MM/YYYY"
      onChange={(event) => {
        setDraft(event.target.value);
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(event.target.value) || event.target.value === '') {
          commit(event.target.value);
        }
      }}
      onBlur={(event) => {
        const nextValue = toIsoDate(event.target.value);
        commit(nextValue);
        setDraft(formatDate(nextValue));
      }}
      inputProps={{ inputMode: 'numeric', ...inputProps }}
    />
  );
}
