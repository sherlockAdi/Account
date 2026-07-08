// material-ui
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

// assets
import ProfileOutlined from '@ant-design/icons/ProfileOutlined';
import LogoutOutlined from '@ant-design/icons/LogoutOutlined';
import UserOutlined from '@ant-design/icons/UserOutlined';
import SafetyCertificateOutlined from '@ant-design/icons/SafetyCertificateOutlined';

import { useAuth } from 'contexts/AuthContext';

// ==============================|| HEADER PROFILE - PROFILE TAB ||============================== //

export default function ProfileTab() {
  const { user, logout } = useAuth();

  return (
    <List component="nav" sx={{ p: 0, '& .MuiListItemIcon-root': { minWidth: 32 } }}>
      <ListItemButton>
        <ListItemIcon>
          <UserOutlined />
        </ListItemIcon>
        <ListItemText primary={user?.fullName || 'User'} secondary={user?.email} />
      </ListItemButton>
      <ListItemButton>
        <ListItemIcon>
          <ProfileOutlined />
        </ListItemIcon>
        <ListItemText primary="Tenant" secondary={user?.tenantName || 'Default Company'} />
      </ListItemButton>
      <ListItemButton>
        <ListItemIcon>
          <SafetyCertificateOutlined />
        </ListItemIcon>
        <ListItemText
          primary="Access"
          secondary={
            <Typography component="span" variant="caption">
              {user?.roles?.map((role) => role.name).join(', ') || 'No role'}
            </Typography>
          }
        />
      </ListItemButton>
      <ListItemButton onClick={logout}>
        <ListItemIcon>
          <LogoutOutlined />
        </ListItemIcon>
        <ListItemText primary="Logout" />
      </ListItemButton>
    </List>
  );
}
