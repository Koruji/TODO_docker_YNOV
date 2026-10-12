package com.todo.services;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.todo.dto.DailyActivity;
import com.todo.repositories.DayCount;
import com.todo.repositories.TasksRepository;

@Service
public class StatsService {

    private static final long MAX_DAYS = 366;

    private final TasksRepository tasksRepository;

    public StatsService(TasksRepository tasksRepository) {
        this.tasksRepository = tasksRepository;
    }

    /** Activité jour par jour entre `from` et `to` (inclus). Les jours sans activité ne sont pas renvoyés. */
    @Transactional(readOnly = true)
    public List<DailyActivity> activity(Long userId, LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "to must not be before from");
        }
        if (ChronoUnit.DAYS.between(from, to) > MAX_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "range must not exceed " + MAX_DAYS + " days");
        }

        Map<LocalDate, long[]> byDay = new TreeMap<>(); // [créées, réalisées]
        for (DayCount c : tasksRepository.countCreatedByDay(userId, from, to)) {
            byDay.computeIfAbsent(c.day(), d -> new long[2])[0] = c.total();
        }
        for (DayCount c : tasksRepository.countDoneByDay(userId, from, to)) {
            byDay.computeIfAbsent(c.day(), d -> new long[2])[1] = c.total();
        }
        return byDay.entrySet().stream()
                .map(e -> new DailyActivity(e.getKey(), e.getValue()[0], e.getValue()[1]))
                .toList();
    }
}
