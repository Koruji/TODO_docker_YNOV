package com.todo.dto;

import jakarta.validation.constraints.*;

public record PasswordUpdateRequest(
    @NotBlank String currentPassword,
    @NotBlank @Size(min = 8, max = 72) String newPassword
) {}
