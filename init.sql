CREATE TABLE IF NOT EXISTS issues (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  location VARCHAR(200) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  reporter_name VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);

INSERT INTO issues (title, description, category, location, priority, status, reporter_name)
VALUES
  ('Broken hallway lighting', 'West wing corridor lights remain off after sunset and create an accessibility concern.', 'ELECTRICAL', 'West Hallway B', 'HIGH', 'OPEN', 'Alicia Stone'),
  ('Blocked restroom drain', 'The first-floor restroom drain is backing up and has standing water.', 'PLUMBING', 'Library Annex', 'CRITICAL', 'ASSIGNED', 'Marcus Lee'),
  ('Campus Wi-Fi outage', 'Students cannot connect to the student Wi-Fi in the engineering block.', 'INTERNET', 'Engineering Block', 'HIGH', 'IN_PROGRESS', 'Priya Sharma'),
  ('Lab bench cleaning required', 'Several lab benches need deep cleaning before afternoon classes.', 'CLEANING', 'Biology Lab 2', 'MEDIUM', 'OPEN', 'Daniel Kim'),
  ('Damaged classroom chair', 'A classroom chair in Room 201 has a broken leg and is unsafe to use.', 'FURNITURE', 'Room 201', 'MEDIUM', 'RESOLVED', 'Nora Patel')
ON CONFLICT DO NOTHING;

UPDATE issues
SET updated_at = CURRENT_TIMESTAMP
WHERE updated_at IS NULL;
