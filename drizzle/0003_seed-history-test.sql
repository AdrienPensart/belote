-- Seed data for testing history feature --

-- Add quentin user (password = "password")
INSERT OR IGNORE INTO users (pseudo, password, admin, ready, canPlayTarot, canPlayTwoTables)
    VALUES
    ('quentin', '$2b$10$4ChIYXyx6AjTsDO/F96XoO6wE41Ge3nUqB78obCYPJM0N11a/mNVq', 1, 0, 0, 0);

-- Create finished game tables (Belote = gamemode_id 2)
INSERT INTO tables (name, finished, panama, gamemode_id)
    VALUES
    ('Table 1 (Belote)', 1, 0, 2),
    ('Table 2 (Belote)', 1, 0, 2),
    ('Table 3 (Belote)', 1, 0, 2),
    ('Table 4 (Belote)', 1, 0, 2),
    ('Table 5 (Belote)', 1, 0, 2);

-- Add players to finished tables
-- Game 1: quentin + adrien (red) vs florian + paul (black) - quentin wins
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'red', 1
    FROM tables t, users u
    WHERE t.name = 'Table 1 (Belote)' AND u.pseudo = 'quentin';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'red', 1
    FROM tables t, users u
    WHERE t.name = 'Table 1 (Belote)' AND u.pseudo = 'adrien';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'black', 0
    FROM tables t, users u
    WHERE t.name = 'Table 1 (Belote)' AND u.pseudo = 'florian';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'black', 0
    FROM tables t, users u
    WHERE t.name = 'Table 1 (Belote)' AND u.pseudo = 'paul';

-- Game 2: quentin + florian (red) vs gab + seb (black) - quentin loses
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'red', 0
    FROM tables t, users u
    WHERE t.name = 'Table 2 (Belote)' AND u.pseudo = 'quentin';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'red', 0
    FROM tables t, users u
    WHERE t.name = 'Table 2 (Belote)' AND u.pseudo = 'florian';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'black', 1
    FROM tables t, users u
    WHERE t.name = 'Table 2 (Belote)' AND u.pseudo = 'gab';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'black', 1
    FROM tables t, users u
    WHERE t.name = 'Table 2 (Belote)' AND u.pseudo = 'seb';

-- Game 3: quentin + paul (red) vs adrien + gab (black) - quentin wins
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'red', 1
    FROM tables t, users u
    WHERE t.name = 'Table 3 (Belote)' AND u.pseudo = 'quentin';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'red', 1
    FROM tables t, users u
    WHERE t.name = 'Table 3 (Belote)' AND u.pseudo = 'paul';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'black', 0
    FROM tables t, users u
    WHERE t.name = 'Table 3 (Belote)' AND u.pseudo = 'adrien';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'black', 0
    FROM tables t, users u
    WHERE t.name = 'Table 3 (Belote)' AND u.pseudo = 'gab';

-- Game 4: quentin + gab (red) vs florian + seb (black) - quentin wins
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'red', 1
    FROM tables t, users u
    WHERE t.name = 'Table 4 (Belote)' AND u.pseudo = 'quentin';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'red', 1
    FROM tables t, users u
    WHERE t.name = 'Table 4 (Belote)' AND u.pseudo = 'gab';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'black', 0
    FROM tables t, users u
    WHERE t.name = 'Table 4 (Belote)' AND u.pseudo = 'florian';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'black', 0
    FROM tables t, users u
    WHERE t.name = 'Table 4 (Belote)' AND u.pseudo = 'seb';

-- Game 5: quentin + seb (red) vs paul + adrien (black) - quentin loses
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'red', 0
    FROM tables t, users u
    WHERE t.name = 'Table 5 (Belote)' AND u.pseudo = 'quentin';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'red', 0
    FROM tables t, users u
    WHERE t.name = 'Table 5 (Belote)' AND u.pseudo = 'seb';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'black', 1
    FROM tables t, users u
    WHERE t.name = 'Table 5 (Belote)' AND u.pseudo = 'paul';
INSERT INTO tables_users (table_id, user_id, team, winner)
    SELECT t.id, u.id, 'black', 1
    FROM tables t, users u
    WHERE t.name = 'Table 5 (Belote)' AND u.pseudo = 'adrien';
