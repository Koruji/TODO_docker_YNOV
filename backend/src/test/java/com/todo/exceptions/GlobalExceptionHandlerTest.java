package com.todo.exceptions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler handler;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler();
        request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/tasks/1");
    }

    @Test
    void notFoundReturns404() {
        ResponseEntity<ApiError> response = handler.handleNotFound(new ResourceNotFoundException("Task 1 not found"), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        ApiError body = response.getBody();
        assertThat(body.status()).isEqualTo(404);
        assertThat(body.error()).isEqualTo("Not Found");
        assertThat(body.message()).isEqualTo("Task 1 not found");
        assertThat(body.path()).isEqualTo("/tasks/1");
        assertThat(body.timestamp()).isNotNull();
        assertThat(body.errors()).isNull();
    }

    @Test
    void conflictReturns409() {
        ResponseEntity<ApiError> response = handler.handleConflict(new ConflictException("Email already used"), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().message()).isEqualTo("Email already used");
    }

    @Test
    void integrityViolationReturnsGenericConflict() {
        ResponseEntity<ApiError> response = handler.handleIntegrity(new DataIntegrityViolationException("duplicate key"), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().message()).isEqualTo("Data conflict");
    }

    @Test
    void unreadableBodyReturns400() {
        ResponseEntity<ApiError> response = handler.handleUnreadable(mock(HttpMessageNotReadableException.class), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().message()).isEqualTo("Malformed or unreadable request body");
    }

    @Test
    void responseStatusExceptionKeepsStatusAndReason() {
        ResponseEntity<ApiError> response = handler.handleStatus(
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().error()).isEqualTo("Unauthorized");
        assertThat(response.getBody().message()).isEqualTo("Invalid credentials");
    }
}
