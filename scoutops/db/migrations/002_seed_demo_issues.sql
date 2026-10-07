INSERT INTO issues (title, description, category, location, priority, status, reporter_name)
SELECT 'Broken hallway lighting', 'West wing corridor lights remain off after sunset and create an accessibility concern.', 'ELECTRICAL', 'West Hallway B', 'HIGH', 'OPEN', 'Alicia Stone'
WHERE NOT EXISTS (SELECT 1 FROM issues WHERE title = 'Broken hallway lighting');

INSERT INTO issues (title, description, category, location, priority, status, reporter_name)
SELECT 'Blocked restroom drain', 'The first-floor restroom drain is backing up and has standing water.', 'PLUMBING', 'Library Annex', 'CRITICAL', 'ASSIGNED', 'Marcus Lee'
WHERE NOT EXISTS (SELECT 1 FROM issues WHERE title = 'Blocked restroom drain');

INSERT INTO issues (title, description, category, location, priority, status, reporter_name)
SELECT 'Campus Wi-Fi outage', 'Students cannot connect to the student Wi-Fi in the engineering block.', 'INTERNET', 'Engineering Block', 'HIGH', 'IN_PROGRESS', 'Priya Sharma'
WHERE NOT EXISTS (SELECT 1 FROM issues WHERE title = 'Campus Wi-Fi outage');

INSERT INTO issues (title, description, category, location, priority, status, reporter_name)
SELECT 'Lab bench cleaning required', 'Several lab benches need deep cleaning before afternoon classes.', 'CLEANING', 'Biology Lab 2', 'MEDIUM', 'OPEN', 'Daniel Kim'
WHERE NOT EXISTS (SELECT 1 FROM issues WHERE title = 'Lab bench cleaning required');

INSERT INTO issues (title, description, category, location, priority, status, reporter_name)
SELECT 'Damaged classroom chair', 'A classroom chair in Room 201 has a broken leg and is unsafe to use.', 'FURNITURE', 'Room 201', 'MEDIUM', 'RESOLVED', 'Nora Patel'
WHERE NOT EXISTS (SELECT 1 FROM issues WHERE title = 'Damaged classroom chair');

UPDATE issues
SET updated_at = CURRENT_TIMESTAMP
WHERE updated_at IS NULL;

