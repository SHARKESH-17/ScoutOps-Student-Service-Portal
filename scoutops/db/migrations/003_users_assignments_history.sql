CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('reporter', 'staff', 'admin')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE issues
  ADD COLUMN assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_issues_assigned_to ON issues(assigned_to);

CREATE TABLE issue_status_history (
  id BIGSERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  old_status VARCHAR(20) NOT NULL,
  new_status VARCHAR(20) NOT NULL,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_issue_status_history_issue_changed
  ON issue_status_history(issue_id, changed_at DESC);

CREATE FUNCTION record_issue_status_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NULLIF(current_setting('app.user_id', TRUE), '')::INTEGER
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issues_status_history
AFTER UPDATE OF status ON issues
FOR EACH ROW
EXECUTE FUNCTION record_issue_status_change();
