import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { IdentityService } from './identity.service';

@ApiTags('Users & Roles')
@Controller('identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get('permissions')
  @ApiOkResponse({ description: 'List all available permissions.' })
  listPermissions() {
    return this.identityService.listPermissions();
  }

  @Get('roles')
  @ApiOkResponse({ description: 'List tenant roles with assigned permissions.' })
  listRoles() {
    return this.identityService.listRoles();
  }

  @Post('roles')
  @ApiCreatedResponse({ description: 'Create a role and optionally assign permissions.' })
  createRole(@Body() dto: CreateRoleDto) {
    return this.identityService.createRole(dto);
  }

  @Patch('roles/:id/permissions')
  @ApiOkResponse({ description: 'Replace all permissions for a role.' })
  setRolePermissions(@Param('id') id: string, @Body() dto: SetRolePermissionsDto) {
    return this.identityService.setRolePermissions(id, dto);
  }

  @Patch('roles/:id')
  @ApiOkResponse({ description: 'Update a role and optionally replace its permissions.' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.identityService.updateRole(id, dto);
  }

  @Get('users')
  @ApiOkResponse({ description: 'List tenant users with roles.' })
  listUsers() {
    return this.identityService.listUsers();
  }

  @Post('users')
  @ApiCreatedResponse({ description: 'Create a user and optionally assign roles.' })
  createUser(@Body() dto: CreateUserDto) {
    return this.identityService.createUser(dto);
  }

  @Patch('users/:id/roles')
  @ApiOkResponse({ description: 'Replace all roles for a user.' })
  setUserRoles(@Param('id') id: string, @Body() dto: SetUserRolesDto) {
    return this.identityService.setUserRoles(id, dto);
  }

  @Patch('users/:id')
  @ApiOkResponse({ description: 'Update a user and optionally replace roles.' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.identityService.updateUser(id, dto);
  }

  @Get('users/:id/effective-permissions')
  @ApiOkResponse({ description: 'Resolve final permissions inherited from all roles.' })
  getEffectivePermissions(@Param('id') id: string) {
    return this.identityService.getEffectivePermissions(id);
  }
}
