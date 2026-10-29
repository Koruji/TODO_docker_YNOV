package com.todo.services;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import com.todo.dto.AuthResponse;
import com.todo.dto.LoginRequest;
import com.todo.models.Users;
import com.todo.repositories.UsersRepository;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UsersRepository usersRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;
    @InjectMocks
    private AuthService authService;

    private Users user() {
        Users user = new Users("jade", "jade@ynov.com", "hashed");
        ReflectionTestUtils.setField(user, "id", 1L);
        return user;
    }

    @Test
    void loginReturnsTokenAndUser() {
        Users user = user();
        when(usersRepository.findByEmail("jade@ynov.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "hashed")).thenReturn(true);
        when(jwtService.generateToken(user)).thenReturn("token");

        AuthResponse response = authService.login(new LoginRequest("jade@ynov.com", "secret123"));

        assertThat(response.token()).isEqualTo("token");
        assertThat(response.user().id()).isEqualTo(1L);
        assertThat(response.user().username()).isEqualTo("jade");
    }

    @Test
    void loginFailsWhenEmailUnknown() {
        when(usersRepository.findByEmail("nobody@ynov.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("nobody@ynov.com", "secret123")))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(ex.getReason()).isEqualTo("Invalid credentials");
                });
        verifyNoInteractions(jwtService);
    }

    @Test
    void loginFailsWhenPasswordWrong() {
        when(usersRepository.findByEmail("jade@ynov.com")).thenReturn(Optional.of(user()));
        when(passwordEncoder.matches("wrong", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("jade@ynov.com", "wrong")))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(ex.getReason()).isEqualTo("Invalid credentials");
                });
        verifyNoInteractions(jwtService);
    }
}
