package com.todo.repositories;

import java.time.LocalDate;

/** Nombre de tâches pour un jour donné (résultat des requêtes de statistiques). */
public record DayCount(LocalDate day, long total) {}
