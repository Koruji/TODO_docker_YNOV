package com.todo.controllers;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.todo.dto.DailyActivity;
import com.todo.services.StatsService;

@RestController
@RequestMapping("/stats")
public class StatsController {

    private static final int DEFAULT_MONTHS = 4;

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    /**
     * Tâches créées et réalisées par jour. Sans paramètre : les 4 derniers mois.
     * Ex. : GET /stats/activity?from=2026-06-15&to=2026-10-12
     */
    @GetMapping("/activity")
    public List<DailyActivity> activity(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.minusMonths(DEFAULT_MONTHS).plusDays(1);
        return statsService.activity(Long.valueOf(jwt.getSubject()), start, end);
    }
}
