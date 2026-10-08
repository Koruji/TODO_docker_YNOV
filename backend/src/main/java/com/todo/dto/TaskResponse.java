package com.todo.dto;

import java.time.LocalDate;

import com.todo.models.Tasks;

public record TaskResponse(
    Long id,
    String label,
    String description,
    LocalDate startDate,
    LocalDate endDate,
    String place, 
    Integer level, 
    UserDto user,
    UserDto collaborator
) {
    public static TaskResponse from(Tasks t) {
        return new TaskResponse(
            t.getId(),
            t.getLabel(),
            t.getDescription(),
            t.getStartDate(),
            t.getEndDate(),
            t.getPlace(),
            t.getLevel(),
            UserDto.from(t.getUser()),
            t.getCollaborator() == null ? null : UserDto.from(t.getCollaborator())
        );
    }
}
