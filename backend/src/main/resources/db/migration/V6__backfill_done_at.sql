-- Les tâches déjà réalisées avant l'ajout de done_at n'ont pas de date de validation : on leur donne celle d'aujourd'hui
UPDATE tasks SET done_at = CURRENT_DATE WHERE done = TRUE AND done_at IS NULL;
