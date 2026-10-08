package com.todo.dto;

import java.time.LocalDate;
import jakarta.validation.constraints.*;

public record TaskRequest(
    @NotBlank String label,
    @NotBlank String description, 
    LocalDate startDate,
    LocalDate endDate,
    @Size(max = 255) String place,
    @Min(0) @Max(3) Integer level,
    Long collaboratorId
) {}
