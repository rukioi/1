
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@helium/heliumdb?sslmode=disable',
});

async function fixTenantSchemas() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Get all tenants
    const tenantsResult = await client.query('SELECT id FROM tenants');
    const tenants = tenantsResult.rows;

    for (const tenant of tenants) {
      const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
      
      console.log(`Creating/fixing schema for tenant: ${schemaName}`);

      // Create schema if not exists
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // Create tables for this tenant schema
      const createTablesQueries = [
        `CREATE TABLE IF NOT EXISTS "${schemaName}".clients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT,
          mobile TEXT,
          organization TEXT,
          country TEXT DEFAULT 'BR',
          state TEXT,
          address TEXT,
          city TEXT,
          zip_code TEXT,
          budget DECIMAL(10,2) DEFAULT 0,
          currency TEXT DEFAULT 'BRL',
          level TEXT,
          description TEXT,
          pis TEXT,
          cei TEXT,
          professional_title TEXT,
          marital_status TEXT,
          birth_date TEXT,
          cpf TEXT,
          rg TEXT,
          inss_status TEXT,
          amount_paid DECIMAL(10,2) DEFAULT 0,
          referred_by TEXT,
          registered_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS "${schemaName}".projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'active',
          client_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS "${schemaName}".tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'pending',
          priority TEXT DEFAULT 'medium',
          project_id UUID,
          assigned_to TEXT,
          due_date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS "${schemaName}".invoices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_id UUID,
          amount DECIMAL(10,2) NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'pending',
          due_date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS "${schemaName}".transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          description TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          type TEXT NOT NULL,
          category TEXT,
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      for (const query of createTablesQueries) {
        await client.query(query);
      }

      console.log(`✅ Schema ${schemaName} created/updated successfully`);
    }

    console.log('All tenant schemas fixed successfully!');
  } catch (error) {
    console.error('Error fixing tenant schemas:', error);
  } finally {
    await client.end();
  }
}

fixTenantSchemas();
