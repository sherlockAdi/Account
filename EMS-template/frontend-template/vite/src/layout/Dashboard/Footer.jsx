import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function Footer() {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      sx={{ gap: 1.5, alignItems: 'center', justifyContent: 'center', p: '24px 16px 0px', mt: 'auto' }}
    >
      <Typography variant="caption" color="text.secondary">
        &copy; 2026 Account ERP
      </Typography>
    </Stack>
  );
}
