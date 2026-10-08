package com.todo.controllers;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import com.todo.dto.TaskRequest;
import com.todo.dto.TaskResponse;
import com.todo.services.TaskService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public List<TaskResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return taskService.findAllByUser(userId(jwt));
    }

    @GetMapping("/{id}")
    public TaskResponse get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return taskService.findById(id, userId(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TaskRequest request) {
        return taskService.create(userId(jwt), request);
    }

    @PutMapping("/{id}")
    public TaskResponse update(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody TaskRequest request) {
        return taskService.update(id, userId(jwt), request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        taskService.delete(id, userId(jwt));
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
