import { useEffect, useMemo, useState } from 'react';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import DownOutlined from '@ant-design/icons/DownOutlined';
import EditOutlined from '@ant-design/icons/EditOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';

import CommonDataGrid from 'components/CommonDataGrid';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

async function api(path, options) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message);
  }
  return response.json();
}

const emptyUser = { id: '', fullName: '', email: '', password: '', roleCodes: [] };
const emptyRole = { id: '', name: '', code: '', description: '', permissionCodes: [] };

export default function IdentityPage() {
  const [tab, setTab] = useState(0);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadedTabs, setLoadedTabs] = useState({});
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [userForm, setUserForm] = useState(emptyUser);
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [permissionEditor, setPermissionEditor] = useState({ roleId: '', permissionCodes: [] });

  const permissionGroups = useMemo(
    () =>
      permissions.reduce((groups, permission) => {
        groups[permission.module] = groups[permission.module] || [];
        groups[permission.module].push(permission);
        return groups;
      }, {}),
    [permissions]
  );

  function applyRoles(roleData) {
    setRoles(roleData);
    setPermissionEditor((current) => {
      const selectedRole = roleData.find((role) => role.id === current.roleId) || roleData[0];
      return selectedRole
        ? { roleId: selectedRole.id, permissionCodes: selectedRole.permissions.map((item) => item.permission.code) }
        : { roleId: '', permissionCodes: [] };
    });
  }

  async function ensureRoles(force = false) {
    if (!force && rolesLoaded && roles.length) return roles;
    const roleData = await api('/identity/roles');
    applyRoles(roleData);
    setRolesLoaded(true);
    return roleData;
  }

  async function ensurePermissions(force = false) {
    if (!force && permissionsLoaded && permissions.length) return permissions;
    const permissionData = await api('/identity/permissions');
    setPermissions(permissionData);
    setPermissionsLoaded(true);
    return permissionData;
  }

  async function loadTabData(tabIndex = tab, force = false) {
    if (!force && loadedTabs[tabIndex]) return;
    setError('');
    if (tabIndex === 0) {
      const [userData] = await Promise.all([api('/identity/users'), ensureRoles(force)]);
      setUsers(userData);
    }
    if (tabIndex === 1) {
      await Promise.all([ensureRoles(force), ensurePermissions(force)]);
    }
    if (tabIndex === 2) {
      await Promise.all([ensurePermissions(force), ensureRoles(force)]);
    }
    setLoadedTabs((current) => ({ ...current, [tabIndex]: true }));
  }

  useEffect(() => {
    loadTabData(tab).catch((loadError) => setError(loadError.message));
  }, [tab]);

  async function openCreateUser() {
    const roleData = await ensureRoles();
    setUserForm({ ...emptyUser, roleCodes: roleData[0] ? [roleData[0].code] : [] });
    setUserModalOpen(true);
  }

  function openEditUser(user) {
    setUserForm({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      password: '',
      roleCodes: user.roles.map((item) => item.role.code)
    });
    setUserModalOpen(true);
  }

  async function openCreateRole() {
    await ensurePermissions();
    setRoleForm(emptyRole);
    setRoleModalOpen(true);
  }

  async function openEditRole(role) {
    await ensurePermissions();
    setRoleForm({
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description || '',
      permissionCodes: role.permissions.map((item) => item.permission.code)
    });
    setRoleModalOpen(true);
  }

  async function saveUser(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const body = {
      fullName: userForm.fullName,
      email: userForm.email,
      roleCodes: userForm.roleCodes,
      ...(userForm.password ? { password: userForm.password } : {})
    };
    if (userForm.id) await api(`/identity/users/${userForm.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    else await api('/identity/users', { method: 'POST', body: JSON.stringify({ ...body, password: userForm.password }) });
    setUserModalOpen(false);
    setMessage(userForm.id ? 'User updated' : 'User created');
    await loadTabData(0, true);
  }

  async function saveRole(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const body = {
      name: roleForm.name,
      code: roleForm.code,
      description: roleForm.description,
      permissionCodes: roleForm.permissionCodes
    };
    if (roleForm.id) await api(`/identity/roles/${roleForm.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    else await api('/identity/roles', { method: 'POST', body: JSON.stringify(body) });
    setRoleModalOpen(false);
    setMessage(roleForm.id ? 'Role updated' : 'Role created');
    await loadTabData(tab, true);
  }

  function selectPermissionRole(roleId) {
    const selectedRole = roles.find((role) => role.id === roleId);
    setPermissionEditor({
      roleId,
      permissionCodes: selectedRole?.permissions.map((item) => item.permission.code) || []
    });
  }

  function toggleEditorPermission(code) {
    setPermissionEditor((current) => ({
      ...current,
      permissionCodes: current.permissionCodes.includes(code)
        ? current.permissionCodes.filter((permissionCode) => permissionCode !== code)
        : [...current.permissionCodes, code]
    }));
  }

  function toggleRoleFormPermission(code) {
    setRoleForm((current) => ({
      ...current,
      permissionCodes: current.permissionCodes.includes(code)
        ? current.permissionCodes.filter((permissionCode) => permissionCode !== code)
        : [...current.permissionCodes, code]
    }));
  }

  async function saveRolePermissions() {
    if (!permissionEditor.roleId) return;
    setError('');
    setMessage('');
    await api(`/identity/roles/${permissionEditor.roleId}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify({ permissionCodes: permissionEditor.permissionCodes })
    });
    setMessage('Role permissions updated');
    await loadTabData(2, true);
  }

  return (
    <Grid container spacing={2.75}>
      {(message || error) && (
        <Grid size={12}>
          <Alert severity={error ? 'error' : 'success'} onClose={() => (error ? setError('') : setMessage(''))}>
            {error || message}
          </Alert>
        </Grid>
      )}

      <Grid size={12}>
        <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Users" />
            <Tab label="Roles" />
            <Tab label="Permissions" />
          </Tabs>

          {tab === 0 && (
            <Stack spacing={2.5} sx={{ p: 2.5 }}>
              <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                <Button variant="contained" startIcon={<PlusOutlined />} onClick={openCreateUser}>
                  Create User
                </Button>
              </Stack>
              <CommonDataGrid
                title="Users"
                rows={users.map((user) => ({ ...user, rolesText: user.roles.map((item) => item.role.name).join(', ') }))}
                columns={[
                  { field: 'fullName', headerName: 'User', flex: 1, minWidth: 180 },
                  { field: 'email', headerName: 'Email', flex: 1.2, minWidth: 220 },
                  { field: 'rolesText', headerName: 'Roles', flex: 1, minWidth: 180 },
                  { field: 'status', headerName: 'Status', width: 130 },
                  { field: 'action', headerName: 'Action', width: 120, sortable: false, filterable: false, renderCell: ({ row }) => <Button size="small" startIcon={<EditOutlined />} onClick={() => openEditUser(row)}>Edit</Button> }
                ]}
                searchPlaceholder="Search user, email, role, or status"
                selectFilters={[{ field: 'rolesText', label: 'Roles' }, { field: 'status', label: 'Status' }]}
                fileName="identity-users"
              />
            </Stack>
          )}

          {tab === 1 && (
            <Stack spacing={2.5} sx={{ p: 2.5 }}>
              <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                <Button variant="contained" startIcon={<PlusOutlined />} onClick={openCreateRole}>
                  Create Role
                </Button>
              </Stack>
              <CommonDataGrid
                title="Roles"
                rows={roles.map((role) => ({ ...role, roleText: `${role.name} | ${role.description || ''}`, permissionsCount: role.permissions.length, usersCount: role._count?.users || 0 }))}
                columns={[
                  { field: 'roleText', headerName: 'Role', flex: 1.2, minWidth: 220 },
                  { field: 'code', headerName: 'Code', width: 150 },
                  { field: 'permissionsCount', headerName: 'Permissions', width: 140, align: 'right', headerAlign: 'right' },
                  { field: 'usersCount', headerName: 'Users', width: 120, align: 'right', headerAlign: 'right' },
                  { field: 'action', headerName: 'Action', width: 120, sortable: false, filterable: false, renderCell: ({ row }) => <Button size="small" startIcon={<EditOutlined />} onClick={() => openEditRole(row)}>Edit</Button> }
                ]}
                searchPlaceholder="Search role, code, or description"
                selectFilters={[{ field: 'code', label: 'Code' }]}
                fileName="identity-roles"
              />
            </Stack>
          )}

          {tab === 2 && (
            <Grid container spacing={2.5} sx={{ p: 2.5 }}>
              <Grid size={{ xs: 12, lg: 4 }}>
                <Stack spacing={2}>
                  <TextField select label="Permission for role" value={permissionEditor.roleId} onChange={(event) => selectPermissionRole(event.target.value)}>
                    {roles.map((role) => (
                      <MenuItem key={role.id} value={role.id}>
                        {role.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button variant="contained" onClick={() => saveRolePermissions().catch((saveError) => setError(saveError.message))}>
                    Save Permissions
                  </Button>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, lg: 8 }}>
                <PermissionTree groups={permissionGroups} checked={permissionEditor.permissionCodes} onToggle={toggleEditorPermission} />
              </Grid>
            </Grid>
          )}
        </Box>
      </Grid>

      <Dialog open={userModalOpen} onClose={() => setUserModalOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={(event) => saveUser(event).catch((saveError) => setError(saveError.message))}>
          <DialogTitle>{userForm.id ? 'Edit User' : 'Create User'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Full name" value={userForm.fullName} onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })} required />
              <TextField label="Email" type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} required />
              <TextField
                label={userForm.id ? 'New password' : 'Password'}
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                required={!userForm.id}
              />
              <TextField
                select
                label="Role"
                value={userForm.roleCodes[0] || ''}
                onChange={(event) => setUserForm({ ...userForm, roleCodes: [event.target.value] })}
              >
                {roles.map((role) => (
                  <MenuItem key={role.id} value={role.code}>
                    {role.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUserModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={roleModalOpen} onClose={() => setRoleModalOpen(false)} fullWidth maxWidth="md">
        <Box component="form" onSubmit={(event) => saveRole(event).catch((saveError) => setError(saveError.message))}>
          <DialogTitle>{roleForm.id ? 'Edit Role' : 'Create Role'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Stack spacing={2}>
                  <TextField label="Role name" value={roleForm.name} onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })} required />
                  <TextField label="Role code" value={roleForm.code} onChange={(event) => setRoleForm({ ...roleForm, code: event.target.value })} required />
                  <TextField
                    label="Description"
                    value={roleForm.description}
                    onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
                    multiline
                    rows={4}
                  />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                <PermissionTree groups={permissionGroups} checked={roleForm.permissionCodes} onToggle={toggleRoleFormPermission} compact />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRoleModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Grid>
  );
}

function PermissionTree({ groups, checked, onToggle, compact = false }) {
  return (
    <Stack spacing={1}>
      {Object.entries(groups).map(([module, modulePermissions]) => {
        const selectedCount = modulePermissions.filter((permission) => checked.includes(permission.code)).length;
        return (
          <Accordion key={module} defaultExpanded={!compact}>
            <AccordionSummary expandIcon={<DownOutlined />}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>
                  {module}
                </Typography>
                <Chip label={`${selectedCount}/${modulePermissions.length}`} size="small" />
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={0.5}>
                {modulePermissions.map((permission) => (
                  <FormControlLabel
                    key={permission.id}
                    control={<Checkbox checked={checked.includes(permission.code)} onChange={() => onToggle(permission.code)} />}
                    label={
                      <Stack spacing={0}>
                        <Typography variant="body2">{permission.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {permission.code}
                        </Typography>
                      </Stack>
                    }
                  />
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );
}
