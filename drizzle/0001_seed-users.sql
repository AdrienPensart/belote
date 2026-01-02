-- Custom SQL migration file, put your code below! --
INSERT INTO gamesModes (name)
    VALUES 
    ('Panama'),
    ('Belote'),
    ('Belote a 6'),
    ('Tarot');
INSERT INTO users (pseudo, password, admin,ready,canPlayTarot,canPlayTwoTables)
    VALUES 
    ('adrien', '$2b$10$uNa1ZRqA.lZ/ium6uUUlde2LN8bsje0MAHmPzOtek/5u4SnmsQYv.', 1,0,0,0),
    ('florian', '$2b$10$uNa1ZRqA.lZ/ium6uUUlde2LN8bsje0MAHmPzOtek/5u4SnmsQYv.', 1,0,0,0),
    ('paul', '$2b$10$uNa1ZRqA.lZ/ium6uUUlde2LN8bsje0MAHmPzOtek/5u4SnmsQYv.', 1,0,0,0),
    ('gab', '$2b$10$uNa1ZRqA.lZ/ium6uUUlde2LN8bsje0MAHmPzOtek/5u4SnmsQYv.', 1,0,0,0),
    ('seb', '$2b$10$uNa1ZRqA.lZ/ium6uUUlde2LN8bsje0MAHmPzOtek/5u4SnmsQYv.', 1,0,0,0);
    
INSERT INTO tables (name, finished, panama, gamemode_id)
    VALUES 
    ('Panama', 0, 1, 1);