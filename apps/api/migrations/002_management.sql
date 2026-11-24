ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100);
UPDATE users SET name = split_part(email, '@', 1) WHERE name IS NULL;
ALTER TABLE users ALTER COLUMN name SET NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(80) NOT NULL DEFAULT 'Member';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(120) UNIQUE,
  name VARCHAR(200) NOT NULL CHECK (length(btrim(name)) > 0),
  level VARCHAR(80) NOT NULL,
  country VARCHAR(100) NOT NULL,
  city VARCHAR(120),
  founded_year INTEGER CHECK (founded_year BETWEEN 1000 AND 9999),
  supplying_since DATE,
  annual_revenue NUMERIC(20,2) CHECK (annual_revenue >= 0),
  employees INTEGER CHECK (employees >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS companies_level_idx ON companies(level);
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  relationship_type VARCHAR(80) NOT NULL DEFAULT 'supplier_of',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT relationships_no_self CHECK (supplier_id <> customer_id),
  CONSTRAINT relationships_unique UNIQUE(supplier_id, customer_id, relationship_type)
);
CREATE INDEX IF NOT EXISTS relationships_customer_idx ON relationships(customer_id);
