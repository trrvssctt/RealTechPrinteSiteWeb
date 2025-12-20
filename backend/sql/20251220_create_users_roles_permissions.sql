-- Migration: create users, roles, permissions and user_actions (logs)
CREATE TABLE IF NOT EXISTS app.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.role_permissions (
  role_id uuid REFERENCES app.roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES app.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);


CREATE TABLE IF NOT EXISTS app.user_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- seed basic roles
INSERT INTO app.roles (name, description)
  VALUES ('admin', 'Full administrator'), ('manager', 'Manager with elevated rights'), ('employee', 'Regular employee')
  ON CONFLICT (name) DO NOTHING;
