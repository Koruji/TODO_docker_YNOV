package com.todo.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Critères de recherche de tâches. Tous sont optionnels et se cumulent (ET).
 *
 * @param q         texte cherché dans le titre, la description et le lieu
 * @param startDate début de la fenêtre : garde les tâches qui se terminent à cette date ou après
 * @param endDate   fin de la fenêtre : garde les tâches qui commencent à cette date ou avant
 * @param place     lieu exact (sans tenir compte de la casse)
 * @param levels    niveaux acceptés (1 à 3)
 * @param done      true = réalisées, false = à venir, absent = les deux
 */
public record TaskSearchCriteria(
    String q,
    LocalDate startDate,
    LocalDate endDate,
    String place,
    List<Integer> levels,
    Boolean done
) {}
