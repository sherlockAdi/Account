import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

export default function ModulePlaceholder({ title, description, features = [] }) {
  return (
    <Grid container spacing={2.75}>
      <Grid size={12}>
        <Typography variant="h5">{title}</Typography>
      </Grid>
      <Grid size={{ xs: 12, lg: 8 }}>
        <MainCard title={`${title} Workspace`}>
          <Stack spacing={1.5}>
            <Typography variant="body1" color="text.secondary">
              {description}
            </Typography>
            <List sx={{ p: 0 }}>
              {features.map((feature) => (
                <ListItemButton key={feature} divider sx={{ px: 0 }}>
                  <ListItemText primary={feature} />
                </ListItemButton>
              ))}
            </List>
          </Stack>
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, lg: 4 }}>
        <MainCard title="Build Status">
          <Stack spacing={1}>
            <Typography variant="h6" color="primary">
              Planned for core ERP v1
            </Typography>
            <Typography variant="body2" color="text.secondary">
              API contracts, permissions, audit trail, and report exports will be connected as the backend modules come online.
            </Typography>
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
