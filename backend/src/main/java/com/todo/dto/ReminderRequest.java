package com.todo.dto;

import jakarta.validation.constraints.NotNull;

public record ReminderRequest(@NotNull Boolean enabled) {}
