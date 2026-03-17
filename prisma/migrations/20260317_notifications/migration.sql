-- In-App Notifications Table
-- Stores notification history per employee (no Web Push, no VAPID)

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,  -- employee id
  type TEXT NOT NULL,          -- 'LEAVE_REQUEST', 'ADVANCE_REQUEST', 'PAYSLIP_READY', 'SHIFT_REMINDER', 'GENERAL'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS notifications_tenant_recipient_idx ON notifications(tenant_id, recipient_id);
CREATE INDEX IF NOT EXISTS notifications_tenant_unread_idx ON notifications(tenant_id, recipient_id, read) WHERE read = false;
