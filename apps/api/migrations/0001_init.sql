CREATE TABLE users (
  id            uuid PRIMARY KEY,
  email         text        NOT NULL,
  password_hash text        NOT NULL,
  role          text        NOT NULL CHECK (role IN ('CLINIC', 'PATIENT')),
  full_name     text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

CREATE TABLE patients (
  id         uuid PRIMARY KEY,
  user_id    uuid        NOT NULL UNIQUE REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE exam_types (
  id   uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE appointments (
  id           uuid PRIMARY KEY,
  patient_id   uuid        NOT NULL REFERENCES patients (id),
  exam_type_id uuid        NOT NULL REFERENCES exam_types (id),
  slot_start   timestamptz NOT NULL,
  status       text        NOT NULL CHECK (status IN ('SCHEDULED', 'CANCELLED')),
  created_at   timestamptz NOT NULL,
  cancelled_at timestamptz,
  CONSTRAINT appointments_slot_on_grid CHECK (extract(epoch FROM slot_start) % 1800 = 0),
  CONSTRAINT appointments_cancel_consistency CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL))
);

-- Single room: one active appointment per slot. A cancelled row leaves the index, freeing the slot.
CREATE UNIQUE INDEX appointments_active_slot_key ON appointments (slot_start) WHERE status = 'SCHEDULED';
CREATE INDEX appointments_slot_start_idx ON appointments (slot_start);
CREATE INDEX appointments_patient_slot_idx ON appointments (patient_id, slot_start);

CREATE TABLE reports (
  id                uuid PRIMARY KEY,
  appointment_id    uuid        NOT NULL REFERENCES appointments (id),
  title             text        NOT NULL,
  body              text        NOT NULL,
  professional_name text        NOT NULL,
  status            text        NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED')),
  published_at      timestamptz,
  created_at        timestamptz NOT NULL,
  updated_at        timestamptz NOT NULL,
  CONSTRAINT reports_appointment_id_key UNIQUE (appointment_id),
  CONSTRAINT reports_publish_consistency CHECK ((status = 'PUBLISHED') = (published_at IS NOT NULL))
);

-- Defense in depth: the repository already guards with WHERE status = 'DRAFT'.
CREATE FUNCTION reports_forbid_published_change() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'published reports are immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_immutable_once_published
  BEFORE UPDATE OR DELETE ON reports
  FOR EACH ROW EXECUTE FUNCTION reports_forbid_published_change();
