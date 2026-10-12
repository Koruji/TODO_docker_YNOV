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

import com.todo.dto.TaskResponse;
import com.todo.dto.TaskSearchCriteria;
import com.todo.services.TaskService;

@RestController
@RequestMapping("/search")
public class SearchController {

    private final TaskService taskService;

    public SearchController(TaskService taskService) {
        this.taskService = taskService;
    }

    /** Ex. : GET /search/tasks?q=dentiste&startDate=2026-10-01&endDate=2026-10-31&place=Paris&levels=2,3&done=false */
    @GetMapping("/tasks")
    public List<TaskResponse> searchTasks(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String place,
            @RequestParam(required = false) List<Integer> levels,
            @RequestParam(required = false) Boolean done) {
        var criteria = new TaskSearchCriteria(q, startDate, endDate, place, levels, done);
        return taskService.search(Long.valueOf(jwt.getSubject()), criteria);
    }

    /** Toutes les tâches réalisées de l'utilisateur. */
    @GetMapping("/tasks/done")
    public List<TaskResponse> doneTasks(@AuthenticationPrincipal Jwt jwt) {
        return taskService.search(Long.valueOf(jwt.getSubject()), new TaskSearchCriteria(null, null, null, null, null, true));
    }

    /** Toutes les tâches non faites de l'utilisateur. */
    @GetMapping("/tasks/todo")
    public List<TaskResponse> todoTasks(@AuthenticationPrincipal Jwt jwt) {
        return taskService.search(Long.valueOf(jwt.getSubject()), new TaskSearchCriteria(null, null, null, null, null, false));
    }

    /** Lieux déjà renseignés, pour alimenter la liste déroulante des filtres. */
    @GetMapping("/places")
    public List<String> places(@AuthenticationPrincipal Jwt jwt) {
        return taskService.findPlaces(Long.valueOf(jwt.getSubject()));
    }
}
