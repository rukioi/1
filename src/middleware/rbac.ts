import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { AccountType } from '@prisma/client';

/**
 * Middleware RBAC para controle de acesso por tipo de conta
 * Sistema multi-tenant com três tipos de conta:
 * - SIMPLES: Sem acesso a dados financeiros detalhados e módulo Fluxo de Caixa
 * - COMPOSTA: Acesso completo exceto módulo Configurações
 * - GERENCIAL: Acesso total incluindo Configurações
 */

export const requireAccountTypes = (allowedTypes: AccountType[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.accountType) {
      return res.status(401).json({ 
        error: 'Usuário não autenticado ou tipo de conta não identificado' 
      });
    }

    if (!allowedTypes.includes(req.user.accountType)) {
      return res.status(403).json({ 
        error: 'Acesso negado para este tipo de conta',
        required: allowedTypes,
        current: req.user.accountType
      });
    }

    next();
  };
};

export const forbidAccountTypes = (forbiddenTypes: AccountType[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.accountType) {
      return res.status(401).json({ 
        error: 'Usuário não autenticado ou tipo de conta não identificado' 
      });
    }

    if (forbiddenTypes.includes(req.user.accountType)) {
      return res.status(403).json({ 
        error: 'Acesso negado para este tipo de conta',
        forbidden: forbiddenTypes,
        current: req.user.accountType
      });
    }

    next();
  };
};

/**
 * Middleware específico para módulo Fluxo de Caixa
 * Bloqueia acesso para contas SIMPLES
 */
export const requireCashFlowAccess = requireAccountTypes([AccountType.COMPOSTA, AccountType.GERENCIAL]);

/**
 * Middleware específico para módulo Configurações
 * Bloqueia acesso para contas SIMPLES e COMPOSTA
 */
export const requireSettingsAccess = requireAccountTypes([AccountType.GERENCIAL]);

/**
 * Helper para verificar permissões no dashboard
 */
export const getDashboardPermissions = (accountType: AccountType) => {
  return {
    canViewFinancialCharts: accountType !== AccountType.SIMPLES,
    canViewCashFlow: [AccountType.COMPOSTA, AccountType.GERENCIAL].includes(accountType),
    canViewSettings: accountType === AccountType.GERENCIAL,
    canViewAllModules: accountType === AccountType.GERENCIAL
  };
};

/**
 * Helper para validar acesso a tenant
 * Garante que usuário só acessa dados do seu próprio tenant
 */
export const validateTenantAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.tenantId) {
    return res.status(401).json({ 
      error: 'Usuário não autenticado ou tenant não identificado' 
    });
  }

  // Se há tenantId na URL, deve coincidir com o tenant do usuário
  const pathTenantId = req.params.tenantId;
  if (pathTenantId && pathTenantId !== req.user.tenantId) {
    return res.status(403).json({ 
      error: 'Acesso negado: tenant não autorizado',
      userTenant: req.user.tenantId,
      requestedTenant: pathTenantId
    });
  }

  next();
};