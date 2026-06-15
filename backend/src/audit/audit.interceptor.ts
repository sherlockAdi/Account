import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = String(request.method || '').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();
    const startedAt = Date.now();
    const identity = this.identity(request.headers?.authorization);
    const path = String(request.originalUrl || request.url || '');
    const module = path.split('?')[0].split('/').filter(Boolean)[2] || 'system';
    const action = this.action(method, path);
    const changes = this.sanitize(request.body);

    return next.handle().pipe(
      tap((result) => {
        const resultObject = result && typeof result === 'object' ? result as Record<string, unknown> : {};
        const user = resultObject.user && typeof resultObject.user === 'object' ? resultObject.user as Record<string, unknown> : {};
        const voucher = resultObject.voucher && typeof resultObject.voucher === 'object' ? resultObject.voucher as Record<string, unknown> : {};
        void this.auditService.record({
          tenantId: identity.tenantId || String(user.tenantId || '') || undefined,
          companyId: this.stringValue(resultObject.companyId) || this.stringValue(voucher.companyId) || this.stringValue(request.body?.companyId) || this.stringValue(request.query?.companyId),
          userId: identity.userId || this.stringValue(user.id),
          module,
          action,
          entityType: this.entityType(path),
          entityId: this.pathId(path) || this.stringValue(resultObject.id),
          description: `${action.toLowerCase()} ${this.entityType(path) || module}`,
          method,
          path,
          ipAddress: request.ip || request.socket?.remoteAddress,
          userAgent: request.headers?.['user-agent'],
          outcome: 'SUCCESS',
          statusCode: response.statusCode,
          changes,
          metadata: { durationMs: Date.now() - startedAt, result: this.resultSummary(resultObject) },
        });
      }),
      catchError((error) => {
        void this.auditService.record({
          tenantId: identity.tenantId,
          userId: identity.userId,
          companyId: this.stringValue(request.body?.companyId) || this.stringValue(request.query?.companyId),
          module,
          action: module === 'auth' ? 'LOGIN' : action,
          entityType: this.entityType(path),
          entityId: this.pathId(path),
          description: `Failed ${action.toLowerCase()} ${this.entityType(path) || module}`,
          method,
          path,
          ipAddress: request.ip || request.socket?.remoteAddress,
          userAgent: request.headers?.['user-agent'],
          outcome: 'FAILURE',
          statusCode: error?.status || 500,
          changes,
          metadata: { durationMs: Date.now() - startedAt, error: error?.message || 'Unknown error' },
        });
        return throwError(() => error);
      }),
    );
  }

  private identity(authorization?: string) {
    try {
      const token = authorization?.split(' ')[1];
      if (!token) return {};
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
      return { userId: payload.sub as string | undefined, tenantId: payload.tenantId as string | undefined };
    } catch {
      return {};
    }
  }

  private action(method: string, path: string) {
    if (path.includes('/auth/login')) return 'LOGIN';
    if (path.includes('/verify')) return 'VERIFY';
    if (path.includes('/process') || path.includes('/complete')) return 'PROCESS';
    return { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' }[method] || method;
  }

  private entityType(path: string) {
    const parts = path.split('?')[0].split('/').filter(Boolean).slice(3);
    return (parts.find((part) => !this.isId(part)) || parts[0] || '').replaceAll('-', '_');
  }

  private pathId(path: string) {
    return path.split('?')[0].split('/').filter(Boolean).find((part) => this.isId(part));
  }

  private isId(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      /password|token|secret|authorization/i.test(key) ? '[REDACTED]' : this.sanitize(item),
    ]));
  }

  private resultSummary(result: Record<string, unknown>) {
    return {
      id: this.stringValue(result.id),
      code: this.stringValue(result.code),
      number: this.stringValue(result.voucherNo) || this.stringValue(result.invoiceNo) || this.stringValue(result.orderNo),
      status: this.stringValue(result.status),
    };
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value ? value : undefined;
  }
}
