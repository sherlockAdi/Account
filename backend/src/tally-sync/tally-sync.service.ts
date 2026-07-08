import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  AccountNature,
  BudgetFlow,
  DebitCredit,
  Prisma,
  TallySyncDirection,
  TallySyncSetting,
  TallySyncState,
  VoucherStatus,
} from '@prisma/client';
import { createHash } from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../database/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { RunTallySyncDto } from './dto/run-tally-sync.dto';
import { UpdateTallySyncSettingDto } from './dto/update-tally-sync-setting.dto';

type SyncEntityType = 'ACCOUNT_GROUP' | 'LEDGER' | 'COST_CENTER' | 'VOUCHER_TYPE' | 'VOUCHER';
type SyncAction = 'PULL' | 'PUSH';
type SyncBatch = 'IMPORT_ALL' | 'EXPORT_ALL' | 'SYNC_ALL';
type SyncResultItem = {
  entityType: SyncEntityType;
  localId?: string;
  remoteId?: string;
  action: SyncAction;
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED';
  message?: string;
};

const DEFAULT_TALLY_HOST = '127.0.0.1';
const DEFAULT_TALLY_PORT = 9000;
const DEFAULT_INTERVAL_SECONDS = 300;

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function checksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

@Injectable()
export class TallySyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TallySyncService.name);
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
  });
  private syncTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
  ) {}

  async onModuleInit() {
    await this.ensureSetting();
    this.scheduleAutoSync();
  }

  onModuleDestroy() {
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

  async getStatus() {
    const tenant = await this.identityService.ensureDefaults();
    const setting = await this.ensureSetting(tenant.id);
    const recentLogs = await this.prisma.tallySyncLog.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const mappingCount = await this.prisma.tallySyncMapping.count({ where: { tenantId: tenant.id } });

    return {
      setting,
      mappingCount,
      recentLogs,
    };
  }

  async updateSettings(dto: UpdateTallySyncSettingDto) {
    const tenant = await this.identityService.ensureDefaults();
    const company = await this.resolveDefaultCompany(tenant.id);
    const record = await this.prisma.tallySyncSetting.upsert({
      where: { tenantId: tenant.id },
      update: {
        companyId: company?.id ?? null,
        enabled: dto.enabled,
        host: dto.host ?? DEFAULT_TALLY_HOST,
        port: dto.port ?? DEFAULT_TALLY_PORT,
        companyName: dto.companyName ?? company?.name ?? null,
        direction: dto.direction ?? TallySyncDirection.BOTH,
        autoSync: dto.autoSync ?? false,
        syncIntervalSeconds: dto.syncIntervalSeconds ?? DEFAULT_INTERVAL_SECONDS,
      },
      create: {
        tenantId: tenant.id,
        companyId: company?.id ?? null,
        enabled: dto.enabled,
        host: dto.host ?? DEFAULT_TALLY_HOST,
        port: dto.port ?? DEFAULT_TALLY_PORT,
        companyName: dto.companyName ?? company?.name ?? null,
        direction: dto.direction ?? TallySyncDirection.BOTH,
        autoSync: dto.autoSync ?? false,
        syncIntervalSeconds: dto.syncIntervalSeconds ?? DEFAULT_INTERVAL_SECONDS,
      },
    });

    this.scheduleAutoSync();
    return record;
  }

  async testConnection() {
    const setting = await this.getActiveSetting();
    const response = await this.postXml(setting, this.buildTestEnvelope(setting));
    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? 'Tally bridge is reachable' : 'Tally bridge returned an error',
      bodyPreview: response.body.slice(0, 500),
    };
  }

  async syncNow(dto?: RunTallySyncDto) {
    const tenant = await this.identityService.ensureDefaults();
    const setting = await this.ensureSetting(tenant.id);

    if (!setting.enabled) {
      throw new BadRequestException('Tally sync is disabled');
    }

    if (this.running) {
      return {
        state: TallySyncState.RUNNING,
        message: 'A sync is already running',
      };
    }

    this.running = true;
    await this.prisma.tallySyncSetting.update({
      where: { id: setting.id },
      data: { state: TallySyncState.RUNNING, lastError: null },
    });

    const requestedDirection = dto?.direction ?? setting.direction;
    const company = await this.resolveCompany(setting.companyId, tenant.id);
    const result: SyncResultItem[] = [];
    const startedAt = new Date();

    try {
      if (requestedDirection !== TallySyncDirection.PUSH) {
        result.push(...(await this.pullRemoteChanges(tenant.id, company?.id ?? null, setting)));
      }

      if (requestedDirection !== TallySyncDirection.PULL) {
        result.push(...(await this.pushLocalChanges(tenant.id, company?.id ?? null, setting)));
      }

      await this.prisma.tallySyncSetting.update({
        where: { id: setting.id },
        data: {
          state: TallySyncState.SUCCESS,
          lastPulledAt: requestedDirection !== TallySyncDirection.PUSH ? new Date() : setting.lastPulledAt,
          lastPushedAt: requestedDirection !== TallySyncDirection.PULL ? new Date() : setting.lastPushedAt,
          lastError: null,
        },
      });

      await this.writeLog(tenant.id, company?.id ?? null, setting.id, {
        entityType: 'VOUCHER',
        action: 'PUSH',
        status: 'SUCCESS',
        message: `Sync completed with ${result.length} operations`,
        payload: {
          requestedDirection,
          startedAt,
          result,
        },
      });

      return {
        state: TallySyncState.SUCCESS,
        requestedDirection,
        result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tally sync failed';
      await this.prisma.tallySyncSetting.update({
        where: { id: setting.id },
        data: { state: TallySyncState.FAILED, lastError: message },
      });
      await this.writeLog(tenant.id, company?.id ?? null, setting.id, {
        entityType: 'VOUCHER',
        action: 'PUSH',
        status: 'FAILED',
        message,
      });
      throw error;
    } finally {
      this.running = false;
    }
  }

  async importAllFromTally() {
    return this.runBatch('IMPORT_ALL', async (tenantId, companyId, setting) => {
      return this.pullRemoteChanges(tenantId, companyId, setting, true);
    });
  }

  async exportAllToTally() {
    return this.runBatch('EXPORT_ALL', async (tenantId, companyId, setting) => {
      return this.pushLocalChanges(tenantId, companyId, setting, true, true);
    });
  }

  private async ensureSetting(tenantId?: string) {
    const tenant = tenantId
      ? await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
      : await this.identityService.ensureDefaults();
    const company = await this.resolveDefaultCompany(tenant.id);

    const existing = await this.prisma.tallySyncSetting.findUnique({ where: { tenantId: tenant.id } });
    if (existing) {
      if (!existing.companyId && company?.id) {
        return this.prisma.tallySyncSetting.update({
          where: { id: existing.id },
          data: {
            companyId: company.id,
            companyName: existing.companyName ?? company.name ?? null,
          },
        });
      }
      return existing;
    }

    return this.prisma.tallySyncSetting.create({
      data: {
        tenantId: tenant.id,
        companyId: company?.id ?? null,
        companyName: company?.name ?? null,
        host: DEFAULT_TALLY_HOST,
        port: DEFAULT_TALLY_PORT,
        direction: TallySyncDirection.BOTH,
        syncIntervalSeconds: DEFAULT_INTERVAL_SECONDS,
      },
    });
  }

  private async resolveDefaultCompany(tenantId: string) {
    return this.prisma.company.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async resolveCompany(companyId: string | null | undefined, tenantId: string) {
    if (companyId) {
      const company = await this.prisma.company.findFirst({ where: { id: companyId, tenantId, deletedAt: null } });
      if (company) return company;
    }
    return this.resolveDefaultCompany(tenantId);
  }

  private async getActiveSetting() {
    const tenant = await this.identityService.ensureDefaults();
    const setting = await this.ensureSetting(tenant.id);
    if (!setting.enabled) {
      throw new BadRequestException('Tally sync is disabled');
    }
    return setting;
  }

  private scheduleAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }

    void (async () => {
      const setting = await this.ensureSetting();
      if (!setting.enabled || !setting.autoSync) return;

      // Keep Tally sync intentionally conservative; aggressive polling makes Tally feel sluggish.
      this.syncTimer = setInterval(() => {
        void this.syncNow().catch((error) => {
          this.logger.error(`Auto sync failed: ${error instanceof Error ? error.message : String(error)}`);
        });
      }, Math.max(setting.syncIntervalSeconds, 300) * 1000);
    })().catch((error) => {
      this.logger.error(`Unable to schedule Tally auto sync: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  private async runBatch(
    batch: SyncBatch,
    runner: (tenantId: string, companyId: string | null, setting: TallySyncSetting) => Promise<SyncResultItem[]>,
  ) {
    const tenant = await this.identityService.ensureDefaults();
    const setting = await this.ensureSetting(tenant.id);

    if (!setting.enabled) {
      throw new BadRequestException('Tally sync is disabled');
    }

    if (this.running) {
      return {
        state: TallySyncState.RUNNING,
        message: 'A sync is already running',
      };
    }

    this.running = true;
    await this.prisma.tallySyncSetting.update({
      where: { id: setting.id },
      data: { state: TallySyncState.RUNNING, lastError: null },
    });

    const company = await this.resolveCompany(setting.companyId, tenant.id);
    const startedAt = new Date();

    try {
      const result = await runner(tenant.id, company?.id ?? null, setting);
      await this.prisma.tallySyncSetting.update({
        where: { id: setting.id },
        data: {
          state: TallySyncState.SUCCESS,
          lastPulledAt: batch === 'EXPORT_ALL' ? setting.lastPulledAt : new Date(),
          lastPushedAt: batch === 'IMPORT_ALL' ? setting.lastPushedAt : new Date(),
          lastError: null,
        },
      });

      await this.writeLog(tenant.id, company?.id ?? null, setting.id, {
        entityType: 'VOUCHER',
        action: batch === 'IMPORT_ALL' ? 'PULL' : 'PUSH',
        status: 'SUCCESS',
        message: `${batch} completed with ${result.length} operations`,
        payload: { batch, startedAt, result },
      });

      return {
        state: TallySyncState.SUCCESS,
        batch,
        result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tally sync failed';
      await this.prisma.tallySyncSetting.update({
        where: { id: setting.id },
        data: { state: TallySyncState.FAILED, lastError: message },
      });
      await this.writeLog(tenant.id, company?.id ?? null, setting.id, {
        entityType: 'VOUCHER',
        action: batch === 'IMPORT_ALL' ? 'PULL' : 'PUSH',
        status: 'FAILED',
        message,
      });
      throw error;
    } finally {
      this.running = false;
    }
  }

  private async pushLocalChanges(
    tenantId: string,
    companyId: string | null,
    setting: TallySyncSetting,
    forceFull = false,
    forceCreate = false,
  ) {
    const result: SyncResultItem[] = [];
    const voucherTypes = await this.prisma.voucherType.findMany({
      where: { companyId: companyId ?? undefined, deletedAt: null },
      orderBy: { updatedAt: 'asc' },
    });
    for (const voucherType of voucherTypes) {
      result.push(await this.pushVoucherType(tenantId, companyId, setting, voucherType, forceCreate));
    }

    const groups = await this.prisma.accountGroup.findMany({
      where: { companyId: companyId ?? undefined, deletedAt: null },
      orderBy: { updatedAt: 'asc' },
      include: { parent: true },
    });
    for (const group of groups) {
      const sync = await this.pushAccountGroup(tenantId, companyId, setting, group, forceCreate);
      result.push(sync);
    }

    const ledgers = await this.prisma.ledger.findMany({
      where: { companyId: companyId ?? undefined, deletedAt: null },
      orderBy: { updatedAt: 'asc' },
      include: { group: true },
    });
    for (const ledger of ledgers) {
      const sync = await this.pushLedger(tenantId, companyId, setting, ledger, forceCreate);
      result.push(sync);
    }

    const costCenters = await this.prisma.costCenter.findMany({
      where: { companyId: companyId ?? undefined, deletedAt: null },
      orderBy: { updatedAt: 'asc' },
    });
    for (const costCenter of costCenters) {
      const sync = await this.pushCostCenter(tenantId, companyId, setting, costCenter, forceCreate);
      result.push(sync);
    }

    const vouchers = await this.prisma.voucher.findMany({
      where: { companyId: companyId ?? undefined, deletedAt: null },
      orderBy: { updatedAt: 'asc' },
      include: { lines: { include: { ledger: true } }, budgetType: true, budgetGrant: true, branch: true },
    });
    for (const voucher of vouchers) {
      const sync = await this.pushVoucher(tenantId, companyId, setting, voucher, forceCreate);
      result.push(sync);
    }

    return result;
  }

  private async pullRemoteChanges(tenantId: string, companyId: string | null, setting: TallySyncSetting, forceFull = false) {
    const result: SyncResultItem[] = [];

    const remoteVoucherTypes = await this.fetchRemoteCollection(setting, 'List of Accounts', { AccountType: 'Voucher Types' });
    for (const remoteVoucherType of remoteVoucherTypes.filter((record) => this.isVoucherTypeRecord(record))) {
      result.push(await this.pullVoucherType(tenantId, companyId, setting, remoteVoucherType));
    }

    const remoteGroups = await this.fetchRemoteCollection(setting, 'List of Accounts');
    for (const remoteGroup of remoteGroups.filter((record) => this.isGroupRecord(record))) {
      result.push(await this.pullAccountGroup(tenantId, companyId, setting, remoteGroup));
    }

    const remoteCostCenters = await this.fetchRemoteCollection(setting, 'List of Accounts', { AccountType: 'Cost Centres' });
    for (const remoteCostCenter of remoteCostCenters.filter((record) => this.isCostCenterRecord(record))) {
      result.push(await this.pullCostCenter(tenantId, companyId, setting, remoteCostCenter));
    }

    const remoteLedgers = await this.fetchRemoteCollection(setting, 'List of Accounts', { AccountType: 'Ledgers' });
    for (const remoteLedger of remoteLedgers.filter((record) => this.isLedgerRecord(record))) {
      result.push(await this.pullLedger(tenantId, companyId, setting, remoteLedger));
    }

    const remoteVouchers = await this.fetchRemoteCollection(setting, 'Day Book');
    for (const remoteVoucher of remoteVouchers.filter((record) => this.isVoucherRecord(record))) {
      result.push(await this.pullVoucher(tenantId, companyId, setting, remoteVoucher));
    }

    return result;
  }

  private async pushAccountGroup(
    tenantId: string,
    companyId: string | null,
    setting: TallySyncSetting,
    group: { id: string; name: string; code: string; nature: AccountNature; parent?: { name: string | null } | null; updatedAt: Date },
    forceCreate = false,
  ): Promise<SyncResultItem> {
    const action = forceCreate ? 'Create' : await this.resolveImportAction(tenantId, 'ACCOUNT_GROUP', group.id);
    const parentName = group.parent?.name ?? this.getPrimaryGroupName(group.nature);
    const remoteId = `GROUP-${group.code}`;
    const payload = {
      name: group.name,
      code: group.code,
      nature: group.nature,
      parentName,
      action,
    };
    const xml = this.buildMastersImportEnvelope([
      `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <GROUP Action="${action}">
          <NAME>${xmlEscape(group.name)}</NAME>
          <PARENT>${xmlEscape(parentName)}</PARENT>
          <LANGUAGEDESCRIPTION.LIST>
            <NAME.LIST TYPE="String">
              <NAME>${xmlEscape(group.name)}</NAME>
            </NAME.LIST>
          </LANGUAGEDESCRIPTION.LIST>
        </GROUP>
      </TALLYMESSAGE>`,
    ]);
    const response = await this.postXml(setting, xml);
    await this.upsertMapping(tenantId, companyId, setting.id, 'ACCOUNT_GROUP', group.id, remoteId, payload, group.updatedAt, new Date());
    await this.writeLog(tenantId, companyId, setting.id, {
      entityType: 'ACCOUNT_GROUP',
      localId: group.id,
      remoteId,
      action: 'PUSH',
      status: response.ok ? 'SUCCESS' : 'FAILED',
      message: response.ok ? `Synced account group ${group.name} to Tally` : response.body.slice(0, 300),
      payload,
    });
    return { entityType: 'ACCOUNT_GROUP', localId: group.id, remoteId, action: 'PUSH', status: response.ok ? 'SUCCESS' : 'FAILED' };
  }

  private async pushLedger(
    tenantId: string,
    companyId: string | null,
    setting: TallySyncSetting,
    ledger: { id: string; name: string; code: string; ledgerType: string; group: { name: string }; updatedAt: Date },
    forceCreate = false,
  ): Promise<SyncResultItem> {
    const action = forceCreate ? 'Create' : await this.resolveImportAction(tenantId, 'LEDGER', ledger.id);
    const remoteId = `LEDGER-${ledger.code}`;
    const payload = {
      name: ledger.name,
      code: ledger.code,
      groupName: ledger.group.name,
      ledgerType: ledger.ledgerType,
      action,
    };
    const xml = this.buildMastersImportEnvelope([
      `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER Action="${action}">
          <NAME>${xmlEscape(ledger.name)}</NAME>
          <PARENT>${xmlEscape(ledger.group.name)}</PARENT>
          <OPENINGBALANCE>0</OPENINGBALANCE>
          <ISBILLWISEON>No</ISBILLWISEON>
        </LEDGER>
      </TALLYMESSAGE>`,
    ]);
    const response = await this.postXml(setting, xml);
    await this.upsertMapping(tenantId, companyId, setting.id, 'LEDGER', ledger.id, remoteId, payload, ledger.updatedAt, new Date());
    await this.writeLog(tenantId, companyId, setting.id, {
      entityType: 'LEDGER',
      localId: ledger.id,
      remoteId,
      action: 'PUSH',
      status: response.ok ? 'SUCCESS' : 'FAILED',
      message: response.ok ? `Synced ledger ${ledger.name} to Tally` : response.body.slice(0, 300),
      payload,
    });
    return { entityType: 'LEDGER', localId: ledger.id, remoteId, action: 'PUSH', status: response.ok ? 'SUCCESS' : 'FAILED' };
  }

  private async pushCostCenter(
    tenantId: string,
    companyId: string | null,
    setting: TallySyncSetting,
    costCenter: { id: string; name: string; code: string; updatedAt: Date },
    forceCreate = false,
  ): Promise<SyncResultItem> {
    const action = forceCreate ? 'Create' : await this.resolveImportAction(tenantId, 'COST_CENTER', costCenter.id);
    const remoteId = `COSTCENTER-${costCenter.code}`;
    const payload = {
      name: costCenter.name,
      code: costCenter.code,
      action,
    };
    const xml = this.buildMastersImportEnvelope([
      `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <COSTCENTRE Action="${action}">
          <NAME>${xmlEscape(costCenter.name)}</NAME>
          <PARENT>Primary</PARENT>
        </COSTCENTRE>
      </TALLYMESSAGE>`,
    ]);
    const response = await this.postXml(setting, xml);
    await this.upsertMapping(tenantId, companyId, setting.id, 'COST_CENTER', costCenter.id, remoteId, payload, costCenter.updatedAt, new Date());
    await this.writeLog(tenantId, companyId, setting.id, {
      entityType: 'COST_CENTER',
      localId: costCenter.id,
      remoteId,
      action: 'PUSH',
      status: response.ok ? 'SUCCESS' : 'FAILED',
      message: response.ok ? `Synced cost centre ${costCenter.name} to Tally` : response.body.slice(0, 300),
      payload,
    });
    return { entityType: 'COST_CENTER', localId: costCenter.id, remoteId, action: 'PUSH', status: response.ok ? 'SUCCESS' : 'FAILED' };
  }

  private async pushVoucherType(
    tenantId: string,
    companyId: string | null,
    setting: TallySyncSetting,
    voucherType: { id: string; name: string; code: string; category: string; prefix: string; nextNumber: number; padding: number; suffix: string | null; updatedAt: Date },
    forceCreate = false,
  ): Promise<SyncResultItem> {
    const action = forceCreate ? 'Create' : await this.resolveImportAction(tenantId, 'VOUCHER_TYPE', voucherType.id);
    const remoteId = `VOUCHERTYPE-${voucherType.code}`;
    const payload = {
      name: voucherType.name,
      code: voucherType.code,
      category: voucherType.category,
      action,
    };
    const xml = this.buildMastersImportEnvelope([
      `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHERTYPE Action="${action}">
          <NAME>${xmlEscape(voucherType.name)}</NAME>
          <PARENT>${xmlEscape(voucherType.category || 'Accounting Vouchers')}</PARENT>
          <NUMBERINGMETHOD>Automatic</NUMBERINGMETHOD>
          <PARENTTYPE>${xmlEscape(voucherType.category || 'Accounting Vouchers')}</PARENTTYPE>
        </VOUCHERTYPE>
      </TALLYMESSAGE>`,
    ]);
    const response = await this.postXml(setting, xml);
    await this.upsertMapping(tenantId, companyId, setting.id, 'VOUCHER_TYPE', voucherType.id, remoteId, payload, voucherType.updatedAt, new Date());
    await this.writeLog(tenantId, companyId, setting.id, {
      entityType: 'VOUCHER_TYPE',
      localId: voucherType.id,
      remoteId,
      action: 'PUSH',
      status: response.ok ? 'SUCCESS' : 'FAILED',
      message: response.ok ? `Synced voucher type ${voucherType.name} to Tally` : response.body.slice(0, 300),
      payload,
    });
    return { entityType: 'VOUCHER_TYPE', localId: voucherType.id, remoteId, action: 'PUSH', status: response.ok ? 'SUCCESS' : 'FAILED' };
  }

  private async pushVoucher(
    tenantId: string,
    companyId: string | null,
    setting: TallySyncSetting,
    voucher: {
      id: string;
      voucherType: string;
      voucherNo: string;
      voucherDate: Date;
      narration: string | null;
      budgetFlow: BudgetFlow;
      budgetType: { name: string } | null;
      budgetGrant: { name: string } | null;
      branch: { name: string } | null;
      lines: Array<{ type: DebitCredit; amount: Prisma.Decimal; narration: string | null; ledger: { name: string } }>;
      updatedAt: Date;
    },
    forceCreate = false,
  ): Promise<SyncResultItem> {
    const action = forceCreate ? 'Create' : await this.resolveImportAction(tenantId, 'VOUCHER', voucher.id);
    const remoteId = `VOUCHER-${voucher.voucherType}-${voucher.voucherNo}`;
    const payload = {
      voucherType: voucher.voucherType,
      tallyVoucherType: this.resolveTallyVoucherTypeName(voucher.voucherType),
      voucherNo: voucher.voucherNo,
      voucherDate: voucher.voucherDate.toISOString(),
      narration: voucher.narration,
      budgetFlow: voucher.budgetFlow,
      budgetTypeName: voucher.budgetType?.name ?? null,
      budgetGrantName: voucher.budgetGrant?.name ?? null,
      branchName: voucher.branch?.name ?? null,
      lines: voucher.lines.map((line) => ({
        ledgerName: line.ledger.name,
        type: line.type,
        amount: line.amount.toString(),
        narration: line.narration,
      })),
      action,
    };
    const ledgerEntries = voucher.lines
      .map(
        (line) => `        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(line.ledger.name)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${line.type === DebitCredit.DEBIT ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
          <AMOUNT>${line.type === DebitCredit.DEBIT ? `-${line.amount.toString()}` : line.amount.toString()}</AMOUNT>
          ${line.narration ? `<NARRATION>${xmlEscape(line.narration)}</NARRATION>` : ''}
        </ALLLEDGERENTRIES.LIST>`,
      )
      .join('\n');

    const xml = this.buildVouchersImportEnvelope([
      `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER Action="${action}">
          <DATE>${voucher.voucherDate.toISOString().slice(0, 10).replace(/-/g, '')}</DATE>
          <VOUCHERTYPENAME>${xmlEscape(this.resolveTallyVoucherTypeName(voucher.voucherType))}</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${xmlEscape(voucher.voucherNo)}</VOUCHERNUMBER>
          ${voucher.narration ? `<NARRATION>${xmlEscape(voucher.narration)}</NARRATION>` : ''}
${ledgerEntries}
        </VOUCHER>
      </TALLYMESSAGE>`,
    ]);
    const response = await this.postXml(setting, xml);
    await this.upsertMapping(tenantId, companyId, setting.id, 'VOUCHER', voucher.id, remoteId, payload, voucher.updatedAt, new Date());
    await this.writeLog(tenantId, companyId, setting.id, {
      entityType: 'VOUCHER',
      localId: voucher.id,
      remoteId,
      action: 'PUSH',
      status: response.ok ? 'SUCCESS' : 'FAILED',
      message: response.ok ? `Synced voucher ${voucher.voucherType} ${voucher.voucherNo} to Tally` : response.body.slice(0, 300),
      payload,
    });
    return { entityType: 'VOUCHER', localId: voucher.id, remoteId, action: 'PUSH', status: response.ok ? 'SUCCESS' : 'FAILED' };
  }

  private async pullAccountGroup(
    tenantId: string,
    companyId: string | null,
    setting: TallySyncSetting,
    remote: Record<string, unknown>,
  ): Promise<SyncResultItem> {
    const name = String(remote.NAME ?? remote.name ?? '').trim();
    if (!name) {
      return { entityType: 'ACCOUNT_GROUP', action: 'PULL', status: 'SKIPPED', message: 'Remote group missing name' };
    }

    const code = String(remote.CODE ?? remote.code ?? name).trim();
    const existing = await this.prisma.accountGroup.findFirst({
      where: { companyId: companyId ?? undefined, code, deletedAt: null },
    });
    if (existing) {
      return { entityType: 'ACCOUNT_GROUP', localId: existing.id, action: 'PULL', status: 'SKIPPED', message: 'Local ERP copy retained' };
    }

    const created = await this.prisma.accountGroup.create({
      data: {
        companyId: companyId ?? (await this.requireCompanyId(tenantId)),
        name,
        code,
        nature: this.detectNature(remote),
        isSystem: false,
      },
    });

    const remoteId = String(remote.GUID ?? remote.guid ?? remote.ALTERID ?? code);
    await this.upsertMapping(tenantId, companyId, setting.id, 'ACCOUNT_GROUP', created.id, remoteId, remote, created.updatedAt, this.readRemoteUpdatedAt(remote));
    await this.writeLog(tenantId, companyId, setting.id, {
      entityType: 'ACCOUNT_GROUP',
      localId: created.id,
      remoteId,
      action: 'PULL',
      status: 'SUCCESS',
      message: `Imported account group ${name} from Tally`,
      payload: remote,
    });
    return { entityType: 'ACCOUNT_GROUP', localId: created.id, remoteId, action: 'PULL', status: 'SUCCESS' };
  }

  private async pullVoucherType(
    tenantId: string,
    companyId: string | null,
    setting: TallySyncSetting,
    remote: Record<string, unknown>,
  ): Promise<SyncResultItem> {
    const name = String(remote.NAME ?? remote.name ?? '').trim();
    if (!name) {
      return { entityType: 'VOUCHER_TYPE', action: 'PULL', status: 'SKIPPED', message: 'Remote voucher type missing name' };
    }

    const code = String(remote.ABBREVIATION ?? remote.CODE ?? remote.code ?? name).trim();
    const existing = await this.prisma.voucherType.findFirst({
      where: { companyId: companyId ?? undefined, code, deletedAt: null },
    });
    if (existing) {
      return { entityType: 'VOUCHER_TYPE', localId: existing.id, action: 'PULL', status: 'SKIPPED', message: 'Local ERP copy retained' };
    }

    const created = await this.prisma.voucherType.create({
      data: {
        companyId: companyId ?? (await this.requireCompanyId(tenantId)),
        name,
        code,
        category: String(remote.PARENT ?? remote.parent ?? 'Accounting Vouchers'),
        prefix: String(remote.PREFIX ?? remote.prefix ?? ''),
        // Don't import Tally's running sequence counter into ERP.
        // Keeping ERP numbering local prevents imported Tally masters from jumping the payment number forward.
        nextNumber: 1,
        padding: Number(remote.PADDING ?? remote.padding ?? 5) || 5,
        suffix: String(remote.SUFFIX ?? remote.suffix ?? '') || null,
        isSystem: false,
      },
    });

    const remoteId = String(remote.GUID ?? remote.guid ?? remote.ALTERID ?? code);
    await this.upsertMapping(tenantId, companyId, setting.id, 'VOUCHER_TYPE', created.id, remoteId, remote, created.updatedAt, this.readRemoteUpdatedAt(remote));
    await this.writeLog(tenantId, companyId, setting.id, {
      entityType: 'VOUCHER_TYPE',
      localId: created.id,
      remoteId,
      action: 'PULL',
      status: 'SUCCESS',
      message: `Imported voucher type ${name} from Tally`,
      payload: remote,
    });
    return { entityType: 'VOUCHER_TYPE', localId: created.id, remoteId, action: 'PULL', status: 'SUCCESS' };
  }

  private async pullCostCenter(
    tenantId: string,
    companyId: string | null,
    setting: TallySyncSetting,
    remote: Record<string, unknown>,
  ): Promise<SyncResultItem> {
    const name = String(remote.NAME ?? remote.name ?? '').trim();
    if (!name) {
      return { entityType: 'COST_CENTER', action: 'PULL', status: 'SKIPPED', message: 'Remote cost centre missing name' };
    }

    const code = String(remote.CODE ?? remote.code ?? name).trim();
    const existing = await this.prisma.costCenter.findFirst({
      where: { companyId: companyId ?? undefined, code, deletedAt: null },
    });
    if (existing) {
      return { entityType: 'COST_CENTER', localId: existing.id, action: 'PULL', status: 'SKIPPED', message: 'Local ERP copy retained' };
    }

    const created = await this.prisma.costCenter.create({
      data: {
        companyId: companyId ?? (await this.requireCompanyId(tenantId)),
        name,
        code,
        notes: String(remote.NARRATION ?? remote.narration ?? '') || null,
      },
    });

    const remoteId = String(remote.GUID ?? remote.guid ?? remote.ALTERID ?? code);
    await this.upsertMapping(tenantId, companyId, setting.id, 'COST_CENTER', created.id, remoteId, remote, created.updatedAt, this.readRemoteUpdatedAt(remote));
    await this.writeLog(tenantId, companyId, setting.id, {
      entityType: 'COST_CENTER',
      localId: created.id,
      remoteId,
      action: 'PULL',
      status: 'SUCCESS',
      message: `Imported cost centre ${name} from Tally`,
      payload: remote,
    });
    return { entityType: 'COST_CENTER', localId: created.id, remoteId, action: 'PULL', status: 'SUCCESS' };
  }

  private async pullLedger(
    tenantId: string,
    companyId: string | null,
    setting: TallySyncSetting,
    remote: Record<string, unknown>,
  ): Promise<SyncResultItem> {
    const name = String(remote.NAME ?? remote.name ?? '').trim();
    if (!name) {
      return { entityType: 'LEDGER', action: 'PULL', status: 'SKIPPED', message: 'Remote ledger missing name' };
    }

    const code = String(remote.CODE ?? remote.code ?? name).trim();
    const groupName = String(remote.PARENT ?? remote.parent ?? this.getPrimaryGroupName(AccountNature.ASSET)).trim();
    const group = await this.prisma.accountGroup.findFirst({
      where: { companyId: companyId ?? undefined, name: groupName, deletedAt: null },
    });
    if (!group) {
      return {
        entityType: 'LEDGER',
        action: 'PULL',
        status: 'SKIPPED',
        message: `Missing local group ${groupName} for ledger ${name}`,
      };
    }

    const existing = await this.prisma.ledger.findFirst({
      where: { companyId: companyId ?? undefined, code, deletedAt: null },
    });
    if (existing) {
      return { entityType: 'LEDGER', localId: existing.id, action: 'PULL', status: 'SKIPPED', message: 'Local ERP copy retained' };
    }

    const created = await this.prisma.ledger.create({
      data: {
        companyId: companyId ?? (await this.requireCompanyId(tenantId)),
        groupId: group.id,
        name,
        code,
        ledgerType: this.resolveLedgerType(remote),
        openingBalance: this.parseDecimal(remote.OPENINGBALANCE ?? remote.openingBalance ?? 0),
        openingType: String(remote.ISDEEMEDPOSITIVE ?? '').toLowerCase() === 'yes' ? DebitCredit.CREDIT : DebitCredit.DEBIT,
      },
    });

    const remoteId = String(remote.GUID ?? remote.guid ?? remote.ALTERID ?? code);
    await this.upsertMapping(tenantId, companyId, setting.id, 'LEDGER', created.id, remoteId, remote, created.updatedAt, this.readRemoteUpdatedAt(remote));
    await this.writeLog(tenantId, companyId, setting.id, {
      entityType: 'LEDGER',
      localId: created.id,
      remoteId,
      action: 'PULL',
      status: 'SUCCESS',
      message: `Imported ledger ${name} from Tally`,
      payload: remote,
    });
    return { entityType: 'LEDGER', localId: created.id, remoteId, action: 'PULL', status: 'SUCCESS' };
  }

  private async pullVoucher(
    tenantId: string,
    companyId: string | null,
    setting: TallySyncSetting,
    remote: Record<string, unknown>,
  ): Promise<SyncResultItem> {
    const voucherType = String(remote.VOUCHERTYPENAME ?? remote.VoucherTypeName ?? remote.voucherType ?? '').trim();
    const voucherNo = String(remote.VOUCHERNUMBER ?? remote.VoucherNumber ?? remote.voucherNo ?? '').trim();
    if (!voucherType || !voucherNo) {
      return { entityType: 'VOUCHER', action: 'PULL', status: 'SKIPPED', message: 'Remote voucher missing type or number' };
    }

    const companyRefId = companyId ?? (await this.requireCompanyId(tenantId));
    const existing = await this.prisma.voucher.findFirst({
      where: { companyId: companyId ?? undefined, voucherType, voucherNo, deletedAt: null },
      include: { lines: { include: { ledger: true } } },
    });
    const voucherLines = this.extractVoucherLines(remote);
    const created = await this.prisma.$transaction(async (tx) => {
      const voucher = existing
        ? await tx.voucher.update({
            where: { id: existing.id },
            data: {
              voucherDate: this.parseRemoteDate(remote) ?? existing.voucherDate ?? new Date(),
              narration: String(remote.NARRATION ?? remote.Narration ?? remote.narration ?? '') || null,
              budgetFlow: BudgetFlow.UTILIZATION,
              status: VoucherStatus.POSTED,
            },
          })
        : await tx.voucher.create({
            data: {
              companyId: companyRefId,
              voucherType,
              voucherNo,
              voucherDate: this.parseRemoteDate(remote) ?? new Date(),
              narration: String(remote.NARRATION ?? remote.Narration ?? remote.narration ?? '') || null,
              budgetFlow: BudgetFlow.UTILIZATION,
              status: VoucherStatus.POSTED,
            },
          });

      if (existing) {
        await tx.voucherLine.deleteMany({ where: { voucherId: voucher.id } });
      }

      if (voucherLines.length) {
        const lineRows: Prisma.VoucherLineCreateManyInput[] = [];
        for (const line of voucherLines) {
          const ledgerId = await this.resolveRemoteVoucherLedger(tx, companyRefId, tenantId, setting.id, line.ledgerName, line.type);
          lineRows.push({
            voucherId: voucher.id,
            ledgerId,
            type: line.type,
            amount: line.amount,
            narration: line.narration,
          });
        }
        await tx.voucherLine.createMany({ data: lineRows });
      }

      return voucher;
    });

    const remoteId = String(remote.GUID ?? remote.guid ?? `${voucherType}-${voucherNo}`);
    await this.upsertMapping(tenantId, companyId, setting.id, 'VOUCHER', created.id, remoteId, remote, created.updatedAt, this.readRemoteUpdatedAt(remote));
    await this.writeLog(tenantId, companyId, setting.id, {
      entityType: 'VOUCHER',
      localId: created.id,
      remoteId,
      action: 'PULL',
      status: 'SUCCESS',
      message: `Imported voucher ${voucherType} ${voucherNo} from Tally with ${voucherLines.length} lines`,
      payload: remote,
    });
    return { entityType: 'VOUCHER', localId: created.id, remoteId, action: 'PULL', status: 'SUCCESS' };
  }

  private async fetchRemoteCollection(setting: TallySyncSetting, reportName: string, staticVariables: Record<string, string | number> = {}) {
    const response = await this.postXml(setting, this.buildExportEnvelope(setting, reportName, staticVariables));
    if (!response.ok) {
      throw new BadRequestException(`Tally returned ${response.status} for ${reportName}`);
    }

    const parsed = this.xmlParser.parse(response.body);
    const records = this.collectRecords(parsed);
    return records;
  }

  private collectRecords(value: unknown): Record<string, unknown>[] {
    const records: Record<string, unknown>[] = [];
    const queue: unknown[] = [value];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== 'object') continue;

      if (Array.isArray(current)) {
        queue.push(...current);
        continue;
      }

      const record = current as Record<string, unknown>;
      if (record.NAME || record.name || record.VOUCHERTYPENAME || record.VoucherTypeName) {
        records.push(record);
      }

      for (const nested of Object.values(record)) {
        if (nested && typeof nested === 'object') queue.push(nested);
      }
    }

    return records;
  }

  private extractVoucherLines(remote: Record<string, unknown>) {
    const lines: Array<{ ledgerName: string; type: DebitCredit; amount: Prisma.Decimal; narration: string | null }> = [];
    const seen = new Set<string>();

    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;

      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }

      const record = value as Record<string, unknown>;
      const ledgerName = String(
        record.LEDGERNAME ??
          record.LedgerName ??
          record.ledgerName ??
          record.NAME ??
          record.Name ??
          '',
      ).trim();
      const amountValue = record.AMOUNT ?? record.Amount ?? record.amount;
      const hasAmount = amountValue !== undefined && amountValue !== null && String(amountValue).trim() !== '';
      if (ledgerName && hasAmount) {
        const amountDecimal = this.parseDecimal(amountValue);
        const isDebitPositive = String(
          record.ISDEEMEDPOSITIVE ??
            record.IsDeemedPositive ??
            record.isDeemedPositive ??
            '',
        ).toLowerCase() === 'yes';
        const isDebit = isDebitPositive || Number(amountDecimal.toString()) < 0;
        const amount = new Prisma.Decimal(Math.abs(Number(amountDecimal.toString())));
        const narration = String(record.NARRATION ?? record.Narration ?? record.narration ?? '').trim() || null;
        const key = `${ledgerName}|${isDebit ? 'DEBIT' : 'CREDIT'}|${amount.toFixed(2)}|${narration ?? ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          lines.push({
            ledgerName,
            type: isDebit ? DebitCredit.DEBIT : DebitCredit.CREDIT,
            amount,
            narration,
          });
        }
      }

      for (const nested of Object.values(record)) {
        if (nested && typeof nested === 'object') visit(nested);
      }
    };

    visit(remote);
    return lines;
  }

  private async resolveRemoteVoucherLedger(
    tx: Prisma.TransactionClient,
    companyId: string,
    tenantId: string,
    settingId: string,
    ledgerName: string,
    type: DebitCredit,
  ) {
    const normalizedName = ledgerName.trim();
    const normalizedCode = this.sanitizeCode(normalizedName);
    const existing = await tx.ledger.findFirst({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { name: normalizedName },
          { code: normalizedCode },
        ],
      },
    });
    if (existing) {
      return existing.id;
    }

    const groupName = type === DebitCredit.DEBIT ? this.getPrimaryGroupName(AccountNature.EXPENSE) : this.getPrimaryGroupName(AccountNature.LIABILITY);
    const group = await tx.accountGroup.findFirst({
      where: { companyId, deletedAt: null, name: groupName },
    });
    if (!group) {
      throw new BadRequestException(`Missing Tally group ${groupName} for ledger ${normalizedName}`);
    }

    const ledger = await tx.ledger.create({
      data: {
        companyId,
        groupId: group.id,
        name: normalizedName,
        code: normalizedCode,
        ledgerType: this.resolveLedgerType({ NAME: normalizedName, PARENT: groupName }),
        openingBalance: new Prisma.Decimal(0),
        openingType: type,
        isActive: true,
      },
    });

    await this.upsertMapping(tenantId, companyId, settingId, 'LEDGER', ledger.id, `LEDGER-${normalizedCode}`, { name: normalizedName, groupName, createdFrom: 'TALLY_REMOTE_LINE' }, ledger.createdAt, new Date());
    return ledger.id;
  }

  private isGroupRecord(record: Record<string, unknown>) {
    const name = String(record.NAME ?? record.name ?? '').trim();
    const parent = String(record.PARENT ?? record.parent ?? '').trim();
    return Boolean(name) && (parent === '' || parent.toLowerCase() !== name.toLowerCase() || record.NATURE || record.nature);
  }

  private isVoucherTypeRecord(record: Record<string, unknown>) {
    const name = String(record.NAME ?? record.name ?? '').trim();
    return Boolean(name) && (record.ABBREVIATION || record.PARENTTYPE || record.PARENT || record.parent);
  }

  private isCostCenterRecord(record: Record<string, unknown>) {
    const name = String(record.NAME ?? record.name ?? '').trim();
    return Boolean(name) && (String(record.PARENT ?? record.parent ?? '').toLowerCase() === 'primary' || record.CATEGORY || record.category);
  }

  private isLedgerRecord(record: Record<string, unknown>) {
    const name = String(record.NAME ?? record.name ?? '').trim();
    const parent = String(record.PARENT ?? record.parent ?? '').trim();
    return Boolean(name) && Boolean(parent);
  }

  private isVoucherRecord(record: Record<string, unknown>) {
    return Boolean(record.VOUCHERTYPENAME ?? record.VoucherTypeName ?? record.voucherType);
  }

  private detectNature(record: Record<string, unknown>): AccountNature {
    const value = String(record.NATURE ?? record.nature ?? record.TYPE ?? record.type ?? '').toUpperCase();
    if (value.includes('LIAB')) return AccountNature.LIABILITY;
    if (value.includes('EQUITY') || value.includes('CAPITAL')) return AccountNature.EQUITY;
    if (value.includes('INCOME') || value.includes('REVEN')) return AccountNature.INCOME;
    if (value.includes('EXPENSE')) return AccountNature.EXPENSE;
    return AccountNature.ASSET;
  }

  private resolveLedgerType(record: Record<string, unknown>) {
    const value = String(record.LEDGERTYPE ?? record.ledgerType ?? record.TYPE ?? record.type ?? '').toUpperCase();
    if (value.includes('BANK')) return 'BANK';
    if (value.includes('CASH')) return 'CASH';
    if (value.includes('CAPITAL')) return 'CAPITAL';
    if (value.includes('CUSTOMER') || value.includes('SUNDRY DEBTOR')) return 'CUSTOMER';
    if (value.includes('VENDOR') || value.includes('SUNDRY CREDITOR')) return 'VENDOR';
    if (value.includes('TAX')) return 'TAX';
    if (value.includes('INCOME')) return 'INCOME';
    if (value.includes('EXPENSE')) return 'EXPENSE';
    return 'GENERAL';
  }

  private parseDecimal(value: unknown) {
    const text = String(value ?? '0').replace(/,/g, '').trim();
    try {
      return new Prisma.Decimal(text || '0');
    } catch {
      return new Prisma.Decimal(0);
    }
  }

  private readRemoteUpdatedAt(record: Record<string, unknown>) {
    const value = String(record.LASTMODIFIEDDATE ?? record.LastModifiedDate ?? record.MODIFIEDDATE ?? record.ModifiedDate ?? '').trim();
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  }

  private parseRemoteDate(record: Record<string, unknown>) {
    const value = String(record.DATE ?? record.Date ?? record.voucherDate ?? '').trim();
    if (!value) return null;
    if (/^\d{8}$/.test(value)) {
      const year = Number(value.slice(0, 4));
      const month = Number(value.slice(4, 6)) - 1;
      const day = Number(value.slice(6, 8));
      const parsedYmd = new Date(Date.UTC(year, month, day));
      return Number.isNaN(parsedYmd.getTime()) ? null : parsedYmd;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private sanitizeCode(value: string) {
    return value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50) || 'REMOTE_LEDGER';
  }

  private async requireCompanyId(tenantId: string) {
    const company = await this.resolveDefaultCompany(tenantId);
    if (!company) {
      throw new BadRequestException('At least one company is required for Tally sync');
    }
    return company.id;
  }

  private async resolveImportAction(
    tenantId: string,
    entityType: SyncEntityType | 'VOUCHER_TYPE',
    localId: string,
  ) {
    const mapping = await this.prisma.tallySyncMapping.findUnique({
      where: { tenantId_entityType_localId: { tenantId, entityType, localId } },
    });
    return mapping?.remoteId ? 'Alter' : 'Create';
  }

  private getPrimaryGroupName(nature: AccountNature) {
    switch (nature) {
      case AccountNature.LIABILITY:
        return 'Current Liabilities';
      case AccountNature.EQUITY:
        return 'Capital Account';
      case AccountNature.INCOME:
        return 'Indirect Incomes';
      case AccountNature.EXPENSE:
        return 'Indirect Expenses';
      case AccountNature.ASSET:
      default:
        return 'Current Assets';
    }
  }

  private resolveTallyVoucherTypeName(voucherType: string) {
    switch (voucherType.trim().toLowerCase()) {
      case 'production':
        return 'Stock Journal';
      case 'payroll':
        return 'Payroll';
      case 'sales_invoice':
        return 'Sales';
      case 'purchase_invoice':
        return 'Purchase';
      case 'debit_note':
        return 'Debit Note';
      case 'credit_note':
        return 'Credit Note';
      case 'payment':
        return 'Payment';
      case 'receipt':
        return 'Receipt';
      case 'contra':
        return 'Contra';
      case 'journal':
        return 'Journal';
      default:
        return voucherType;
    }
  }

  private async upsertMapping(
    tenantId: string,
    companyId: string | null,
    settingId: string,
    entityType: SyncEntityType,
    localId: string,
    remoteId: string,
    payload: unknown,
    localUpdatedAt: Date | null | undefined,
    remoteUpdatedAt: Date | null | undefined,
  ) {
    await this.prisma.tallySyncMapping.upsert({
      where: { tenantId_entityType_localId: { tenantId, entityType, localId } },
      update: {
        companyId,
        settingId,
        remoteId,
        checksum: checksum(payload),
        localUpdatedAt: localUpdatedAt ?? undefined,
        remoteUpdatedAt: remoteUpdatedAt ?? undefined,
        lastSyncedAt: new Date(),
        syncState: 'IN_SYNC',
      },
      create: {
        tenantId,
        companyId,
        settingId,
        entityType,
        localId,
        remoteId,
        checksum: checksum(payload),
        localUpdatedAt: localUpdatedAt ?? undefined,
        remoteUpdatedAt: remoteUpdatedAt ?? undefined,
        syncState: 'IN_SYNC',
      },
    });
  }

  private async writeLog(
    tenantId: string,
    companyId: string | null,
    settingId: string,
    entry: {
      entityType: SyncEntityType;
      localId?: string;
      remoteId?: string;
      action: SyncAction;
      status: 'SUCCESS' | 'SKIPPED' | 'FAILED';
      message?: string;
      payload?: unknown;
    },
  ) {
    await this.prisma.tallySyncLog.create({
      data: {
        tenantId,
        companyId,
        settingId,
        entityType: entry.entityType,
        localId: entry.localId,
        remoteId: entry.remoteId,
        direction: entry.action,
        action: entry.action,
        status: entry.status,
        message: entry.message,
        payload: entry.payload as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private buildExportEnvelope(setting: TallySyncSetting, reportName: string, staticVariables: Record<string, string | number> = {}) {
    const variables = Object.entries({
      SVEXPORTFORMAT: '$$SysName:XML',
      ...staticVariables,
    })
      .map(([key, value]) => `        <${key}>${xmlEscape(value)}</${key}>`)
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>${xmlEscape(reportName)}</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
${variables}
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;
  }

  private buildMastersImportEnvelope(messages: string[], reportName = 'All Masters') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>${xmlEscape(reportName)}</ID>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>${xmlEscape(reportName)}</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
${messages.join('\n')}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }

  private buildVouchersImportEnvelope(messages: string[], reportName = 'Vouchers') {
    return this.buildMastersImportEnvelope(messages, reportName);
  }

  private buildTestEnvelope(setting: TallySyncSetting) {
    return this.buildExportEnvelope(setting, 'List of Accounts');
  }

  private async postXml(setting: TallySyncSetting, xml: string) {
    const url = `http://${setting.host}:${setting.port}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
      body: xml,
    });

    const body = await response.text();
    const currentCompanyError = body.includes('Could not set') && body.includes('SVCurrentCompany');
    if (currentCompanyError && xml.includes('SVCURRENTCOMPANY')) {
      const fallbackXml = this.removeStaticVariable(xml, 'SVCURRENTCOMPANY');
      if (fallbackXml !== xml) {
        const fallbackResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
          },
          body: fallbackXml,
        });
        const fallbackBody = await fallbackResponse.text();
        return {
          ok: fallbackResponse.ok && !this.hasTallyError(fallbackBody),
          status: fallbackResponse.status,
          body: fallbackBody,
        };
      }
    }

    return {
      ok: response.ok && !this.hasTallyError(body),
      status: response.status,
      body,
    };
  }

  private hasTallyError(body: string) {
    return body.includes('<LINEERROR>') || body.includes('TDL Error') || body.includes('Could not set');
  }

  private removeStaticVariable(xml: string, key: string) {
    const pattern = new RegExp(`\\s*<${key}>[\\s\\S]*?<\\/${key}>\\r?\\n?`, 'i');
    return xml.replace(pattern, '');
  }
}
