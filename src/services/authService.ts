
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { database } from '../config/database';

export class AuthService {
  private accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'dev-secret-change-in-production';
  private refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';

  constructor() {
    if (process.env.NODE_ENV === 'production' && (this.accessTokenSecret === 'dev-secret-change-in-production' || this.refreshTokenSecret === 'dev-refresh-secret-change-in-production')) {
      console.error('⚠️  WARNING: Using default JWT secrets in production! Please set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables.');
    }
  }

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  async generateTokens(user: any) {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      ...(user.role ? { role: user.role } : {
        tenantId: user.tenantId,
        accountType: user.accountType,
      }),
    };

    const accessToken = jwt.sign(payload, this.accessTokenSecret, { 
      expiresIn: (process.env.JWT_ACCESS_EXPIRES || '24h') as string,
      issuer: 'legalsaas',
      audience: 'legalsaas-users'
    } as any);
    
    const refreshToken = jwt.sign(payload, this.refreshTokenSecret, { 
      expiresIn: (process.env.JWT_REFRESH_EXPIRES || '7d') as string,
      issuer: 'legalsaas',
      audience: 'legalsaas-users'
    } as any);

    // Store refresh token in database
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
      await database.createRefreshToken({
        tokenHash,
        userId: user.id,
        expiresAt: expiresAt.toISOString(),
        isActive: true
      });
    } catch (error) {
      console.error('Error storing refresh token:', error);
    }

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<any> {
    try {
      return jwt.verify(token, this.accessTokenSecret, {
        issuer: 'legalsaas',
        audience: 'legalsaas-users'
      });
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  async verifyRefreshToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'legalsaas',
        audience: 'legalsaas-users'
      });

      // Get all active refresh tokens for the user and compare
      const userId = (decoded as any).userId;
      const userTokens = await database.getActiveRefreshTokensForUser(userId);
      
      let isValidToken = false;
      for (const storedToken of userTokens) {
        if (await bcrypt.compare(token, storedToken.tokenHash)) {
          isValidToken = true;
          break;
        }
      }
      
      if (!isValidToken) {
        throw new Error('Refresh token not found or expired');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  async refreshTokens(refreshToken: string) {
    const decoded = await this.verifyRefreshToken(refreshToken);
    
    // Get fresh user data
    const user = await database.findUserByEmail(decoded.email);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Revoke old refresh token by finding the matching one
    const userId = (decoded as any).userId;
    const userTokens = await database.getActiveRefreshTokensForUser(userId);
    
    for (const storedToken of userTokens) {
      if (await bcrypt.compare(refreshToken, storedToken.tokenHash)) {
        await database.revokeRefreshTokenById(storedToken.id);
        break;
      }
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user);
    
    return { user, tokens };
  }

  async revokeAllTokens(userId: string, isAdmin: boolean = false) {
    try {
      if (isAdmin) {
        // Handle admin token revocation if needed
        console.log('Revoking admin tokens for user:', userId);
      } else {
        await database.revokeAllUserTokens(userId);
      }
    } catch (error) {
      console.error('Error revoking tokens:', error);
    }
  }

  async loginUser(email: string, password: string) {
    const user = await database.findUserByEmail(email);
    
    if (!user) {
      // Use a generic error to prevent email enumeration
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    const isValidPassword = await this.verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await database.updateUserLastLogin(user.id);

    const tokens = await this.generateTokens(user);
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    return { user: userWithoutPassword, tokens };
  }

  async loginAdmin(email: string, password: string) {
    const admin = await database.findAdminByEmail(email);
    
    if (!admin) {
      throw new Error('Invalid admin credentials');
    }

    if (!admin.isActive) {
      throw new Error('Admin account is deactivated');
    }

    const isValidPassword = await this.verifyPassword(password, admin.password);
    if (!isValidPassword) {
      throw new Error('Invalid admin credentials');
    }

    // Update last login
    await database.updateAdminLastLogin(admin.id);

    const tokens = await this.generateTokens(admin);
    
    // Remove password from response
    const { password: _, ...adminWithoutPassword } = admin;
    
    return { user: adminWithoutPassword, tokens };
  }

  async registerUser(email: string, password: string, name: string, key: string) {
    // Validate registration key first
    const validKeys = await database.findValidRegistrationKeys();
    if (process.env.NODE_ENV === 'development') {
      console.log('Found valid registration keys:', validKeys.length);
    }
    
    let registrationKey = null;
    
    // Try to find a matching key by comparing the plain key with stored hashes
    for (const validKey of validKeys) {
      try {
        if (validKey.keyHash && await bcrypt.compare(key, validKey.keyHash)) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Key match found for ID:', validKey.id);
          }
          registrationKey = validKey;
          break;
        }
      } catch (error) {
        console.error('Error comparing key hash for ID', validKey.id, ':', error);
        continue;
      }
    }

    if (!registrationKey) {
      throw new Error('Invalid or expired registration key');
    }

    console.log('Valid registration key found:', registrationKey.id);
    
    // CRITICAL: Check if key has mandatory tenantId
    if (!registrationKey.tenantId) {
      console.error('Registration key missing required tenantId:', registrationKey.id);
      throw new Error('Invalid registration key - missing tenant association');
    }

    // Check if user already exists
    const existingUser = await database.findUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    const hashedPassword = await this.hashPassword(password);
    
    let tenant;
    let isNewTenant = false;

    // Get existing tenant (tenantId is now mandatory)
    const tenantsResult = await database.getAllTenants();
    const tenants = Array.isArray(tenantsResult) ? tenantsResult : tenantsResult.rows || [];
    tenant = tenants.find(t => t.id === registrationKey.tenantId);
    
    if (!tenant) {
      throw new Error('Associated tenant not found');
    }
    
    console.log('Using tenant:', { id: tenant.id, name: tenant.name });

    // Create user with explicit tenant association
    const userData = {
      email,
      password: hashedPassword,
      name,
      accountType: registrationKey.accountType,
      tenantId: tenant.id,
      isActive: true,
      mustChangePassword: false,
    };
    
    console.log('Creating user with data:', { 
      email: userData.email, 
      tenantId: userData.tenantId, 
      accountType: userData.accountType 
    });

    const user = await database.createUser(userData);
    
    console.log('User created:', { 
      id: user.id, 
      tenantId: user.tenantId,
      accountType: user.accountType
    });

    // Update registration key usage
    const currentUsedLogs = registrationKey.usedLogs;
    const usedLogsArray = currentUsedLogs ? (typeof currentUsedLogs === 'string' ? JSON.parse(currentUsedLogs) : currentUsedLogs) : [];
    
    await database.updateRegistrationKeyUsage(registrationKey.id, {
      usesLeft: registrationKey.usesLeft - 1,
      usedLogs: [
        ...usedLogsArray,
        {
          userId: user.id,
          email: user.email,
          usedAt: new Date().toISOString()
        }
      ]
    });
    
    console.log('Registration key usage updated successfully for ID:', registrationKey.id);

    const tokens = await this.generateTokens(user);
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    return { user: userWithoutPassword, tokens, isNewTenant };
  }
}

export const authService = new AuthService();
