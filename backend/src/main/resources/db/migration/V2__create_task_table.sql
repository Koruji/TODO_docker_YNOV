CREATE TABLE tasks (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    label           VARCHAR(255) NOT NULL,
    description     TEXT         NOT NULL,
    user_id         BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    collaborator_id BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    start_date      DATE,
    end_date        DATE,
    place           VARCHAR(255),
    level           INTEGER      CHECK (level BETWEEN 0 AND 3),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_tasks_user_id ON tasks (user_id);
CREATE INDEX idx_tasks_collaborator_id ON tasks (collaborator_id);
