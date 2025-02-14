-- Custom SQL migration file, put your code below! --
ALTER TABLE app MODIFY name VARCHAR(255) NOT NULL COLLATE utf8mb4_bin;
