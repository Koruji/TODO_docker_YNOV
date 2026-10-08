package com.todo.dto;

import jakarta.validation.constraints.*;

public record UserUpdateRequest(
    @NotBlank @Size(max = 50) String username,
    @NotBlank @Email String email,
    @Size(max = 500) String profilePicture
) {}
