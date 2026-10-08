package com.todo.dto;

import jakarta.validation.constraints.*;

public record RegisterRequest(
    @NotBlank @Size(max = 50) String username,
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8, max = 72) String password
) {}
