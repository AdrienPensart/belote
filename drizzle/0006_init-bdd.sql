-- Custom SQL migration file, put your code below! --
INSERT INTO users (pseudo,email, password, admin,ready,canPlayTarot,canPlayTwoTables)
    VALUES 
    ('adrien', 'adrien@yopmail.com', '$2b$10$uNa1ZRqA.lZ/ium6uUUlde2LN8bsje0MAHmPzOtek/5u4SnmsQYv.', 1,0,0,0),
    ('florian','florian@yopmail.com', '$2b$10$uNa1ZRqA.lZ/ium6uUUlde2LN8bsje0MAHmPzOtek/5u4SnmsQYv.', 1,0,0,0),
    ('paul','paul@yopmail.com', '$2b$10$uNa1ZRqA.lZ/ium6uUUlde2LN8bsje0MAHmPzOtek/5u4SnmsQYv.', 1,0,0,0),
    ('quentin','quentin@yopmail.com', '$2b$10$uNa1ZRqA.lZ/ium6uUUlde2LN8bsje0MAHmPzOtek/5u4SnmsQYv.', 1,0,0,0),
    ('gab','gab@yopmail.com', '$2b$10$uNa1ZRqA.lZ/ium6uUUlde2LN8bsje0MAHmPzOtek/5u4SnmsQYv.', 1,0,0,0);