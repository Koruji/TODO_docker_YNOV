package com.todo.dto;

import java.time.LocalDate;

/** Activité d'un jour : tâches créées et tâches réalisées ce jour-là. */
public record DailyActivity(LocalDate date, long created, long done) {}
