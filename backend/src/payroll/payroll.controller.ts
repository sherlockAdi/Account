import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { ProcessPayrollDto } from './dto/process-payroll.dto';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';
import { PayrollService } from './payroll.service';

@ApiTags('Payroll')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('dashboard')
  dashboard(@Query('companyId') companyId?: string) {
    return this.payrollService.dashboard(companyId);
  }

  @Get('employees')
  employees(@Query('companyId') companyId?: string) {
    return this.payrollService.listEmployees(companyId);
  }

  @Post('employees')
  createEmployee(@Query('companyId') companyId: string | undefined, @Body() dto: CreateEmployeeDto) {
    return this.payrollService.createEmployee(companyId, dto);
  }

  @Post('employees/:id/salary-structures')
  createSalaryStructure(@Param('id') id: string, @Body() dto: CreateSalaryStructureDto) {
    return this.payrollService.createSalaryStructure(id, dto);
  }

  @Get('attendance')
  attendance(
    @Query('companyId') companyId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.payrollService.listAttendance(companyId, Number(year), Number(month));
  }

  @Post('attendance')
  upsertAttendance(@Body() dto: UpsertAttendanceDto) {
    return this.payrollService.upsertAttendance(dto);
  }

  @Get('runs')
  runs(@Query('companyId') companyId?: string) {
    return this.payrollService.listRuns(companyId);
  }

  @Get('preview')
  preview(
    @Query('companyId') companyId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.payrollService.preview(companyId, Number(year), Number(month), branchId);
  }

  @Post('runs/process')
  process(@Query('companyId') companyId: string | undefined, @Body() dto: ProcessPayrollDto) {
    return this.payrollService.process(companyId, dto);
  }
}
