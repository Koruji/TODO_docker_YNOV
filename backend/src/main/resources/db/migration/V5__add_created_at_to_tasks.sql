-- Date de création : les tâches déjà présentes reçoivent la date de la migration (leur vraie date n'était pas conservée)
ALTER TABLE tasks ADD COLUMN created_at DATE NOT NULL DEFAULT CURRENT_DATE;
