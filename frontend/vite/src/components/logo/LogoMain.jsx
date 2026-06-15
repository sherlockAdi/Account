import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// ==============================|| LOGO SVG ||============================== //

export default function LogoMain() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 800
        }}
      >
        A
      </Box>
      <Typography variant="h4" sx={{ color: 'text.primary', lineHeight: 1 }}>
        AccountERP
      </Typography>
    </Box>
  );
}
