-- Custom SQL migration file, put your code below! --
DELETE from tables_users;
DELETE from tables where panama = 0;
DELETE from users;