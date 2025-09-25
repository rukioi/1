import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { database } from '../config/database';

export interface CreateKeyRequest {
  tenantId: string; // Obrigatório - chave deve estar vinculada a um tenant
  accountType: 'SIMPLES' | 'COMPOSTA' | 'GERENCIAL';
  usesAllowed?: number;
  expiresAt?: Date;
  singleUse?: boolean;
  metadata?: any;
}

export class RegistrationKeyService {
  async generateKey(request: CreateKeyRequest, createdBy: string): Promise<string> {
    try {
      console.log('Generating registration key with request:', request);
      
      // Validação obrigatória do tenantId
      if (!request.tenantId || request.tenantId.trim() === '') {
        throw new Error('tenantId é obrigatório para gerar chave de registro');
      }
      
      // Generate random key
      const key = crypto.randomBytes(32).toString('hex');
      const keyHash = await bcrypt.hash(key, 12);
      
      console.log('Generated key hash, creating database record...');

      // Create key record with correct field names for Prisma
      const keyData = {
        keyHash,
        tenantId: request.tenantId,
        accountType: request.accountType,
        usesAllowed: request.usesAllowed || 1,
        usesLeft: request.usesAllowed || 1,
        singleUse: request.singleUse ?? true,
        expiresAt: request.expiresAt || null,
        metadata: request.metadata || {},
        createdBy: createdBy,
        usedLogs: [],
        revoked: false,
      };

      console.log('Creating key with data:', keyData);
      await database.createRegistrationKey(keyData);
      
      console.log('Registration key created successfully');
      return key; // Return plain key only once
    } catch (error) {
      console.error('Error in generateKey:', error);
      throw new Error(`Failed to generate registration key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listKeys(tenantId?: string) {
    const data = await database.getAllRegistrationKeys();
    
    if (tenantId) {
      return data.filter(key => key.tenant_id === tenantId);
    }
    
    return data;
  }

  async revokeKey(keyId: string) {
    await database.revokeRegistrationKey(keyId);
  }

  async getKeyUsage(keyId: string) {
    const keys = await database.getAllRegistrationKeys();
    const key = keys.find(k => k.id === keyId);

    if (!key) {
      throw new Error('Key not found');
    }

    return {
      id: key.id,
      accountType: key.account_type,
      usesAllowed: key.uses_allowed,
      usesLeft: key.uses_left,
      usedLogs: key.used_logs,
      revoked: key.revoked,
      expiresAt: key.expires_at,
      createdAt: key.created_at,
    };
  }

  /**
   * Valida e consome uma chave de registro para criação de usuário
   * Retorna dados da chave se válida, decrementa usesLeft
   */
  async validateAndConsumeKey(plainKey: string, tenantId: string): Promise<{
    accountType: 'SIMPLES' | 'COMPOSTA' | 'GERENCIAL';
    tenantId: string;
  }> {
    try {
      console.log('Validating registration key for tenant:', tenantId);
      
      const keys = await database.getAllRegistrationKeys();
      
      // Buscar chave que corresponde ao hash
      let matchingKey = null;
      for (const key of keys) {
        const isMatch = await bcrypt.compare(plainKey, key.key_hash);
        if (isMatch) {
          matchingKey = key;
          break;
        }
      }

      if (!matchingKey) {
        throw new Error('Chave de registro inválida');
      }

      // Validações
      if (matchingKey.revoked) {
        throw new Error('Chave de registro foi revogada');
      }

      if (matchingKey.expires_at && new Date() > new Date(matchingKey.expires_at)) {
        throw new Error('Chave de registro expirada');
      }

      if (matchingKey.uses_left <= 0) {
        throw new Error('Chave de registro esgotou os usos permitidos');
      }

      if (matchingKey.tenant_id !== tenantId) {
        throw new Error('Chave de registro não pertence ao tenant especificado');
      }

      // Decrementar usos restantes e registrar uso
      const usedLog = {
        usedAt: new Date().toISOString(),
        tenantId: tenantId,
        ip: 'system' // TODO: capturar IP real do request
      };

      const updatedUsedLogs = Array.isArray(matchingKey.used_logs) 
        ? [...matchingKey.used_logs, usedLog]
        : [usedLog];

      // Atualizar chave no banco
      await database.updateRegistrationKey(matchingKey.id, {
        uses_left: matchingKey.uses_left - 1,
        used_logs: updatedUsedLogs
      });

      console.log('Registration key validated and consumed successfully');
      return {
        accountType: matchingKey.account_type as 'SIMPLES' | 'COMPOSTA' | 'GERENCIAL',
        tenantId: matchingKey.tenant_id!
      };

    } catch (error) {
      console.error('Error validating registration key:', error);
      throw error;
    }
  }
}

export const registrationKeyService = new RegistrationKeyService();