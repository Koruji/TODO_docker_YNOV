package com.todo.services;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import com.todo.dto.DeleteAccountRequest;
import com.todo.dto.PasswordUpdateRequest;
import com.todo.dto.RegisterRequest;
import com.todo.dto.UserDto;
import com.todo.dto.UserUpdateRequest;
import com.todo.exceptions.ConflictException;
import com.todo.exceptions.ResourceNotFoundException;
import com.todo.models.Users;
import com.todo.repositories.UsersRepository;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UsersRepository usersRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @InjectMocks
    private UserService userService;

    private Users user;

    @BeforeEach
    void setUp() {
        user = new Users("jade", "jade@ynov.com", "hashed");
        ReflectionTestUtils.setField(user, "id", 1L);
    }

    @Test
    void registerEncodesPasswordAndSavesUser() {
        when(usersRepository.existsByUsername("jade")).thenReturn(false);
        when(usersRepository.existsByEmail("jade@ynov.com")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("encoded");
        when(usersRepository.save(any(Users.class))).thenAnswer(inv -> inv.getArgument(0));

        UserDto dto = userService.register(new RegisterRequest("jade", "jade@ynov.com", "secret123"));

        ArgumentCaptor<Users> saved = ArgumentCaptor.forClass(Users.class);
        verify(usersRepository).save(saved.capture());
        assertThat(saved.getValue().getPassword()).isEqualTo("encoded");
        assertThat(dto.username()).isEqualTo("jade");
        assertThat(dto.email()).isEqualTo("jade@ynov.com");
    }

    @Test
    void registerRejectsExistingUsername() {
        when(usersRepository.existsByUsername("jade")).thenReturn(true);

        assertThatThrownBy(() -> userService.register(new RegisterRequest("jade", "new@ynov.com", "secret123")))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Username already taken");
        verify(usersRepository, never()).save(any());
    }

    @Test
    void registerRejectsExistingEmail() {
        when(usersRepository.existsByUsername("other")).thenReturn(false);
        when(usersRepository.existsByEmail("jade@ynov.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.register(new RegisterRequest("other", "jade@ynov.com", "secret123")))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Email already used");
        verify(usersRepository, never()).save(any());
    }

    @Test
    void findByIdReturnsUser() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(user));

        assertThat(userService.findById(1L).username()).isEqualTo("jade");
    }

    @Test
    void findByIdThrowsWhenMissing() {
        when(usersRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.findById(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("User 99 not found");
    }

    @Test
    void updateChangesFields() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(user));
        when(usersRepository.existsByUsername("jade2")).thenReturn(false);
        when(usersRepository.existsByEmail("jade2@ynov.com")).thenReturn(false);

        UserDto dto = userService.update(1L, new UserUpdateRequest("jade2", "jade2@ynov.com", "pic.png"));

        assertThat(dto.username()).isEqualTo("jade2");
        assertThat(dto.email()).isEqualTo("jade2@ynov.com");
        assertThat(dto.profilePicture()).isEqualTo("pic.png");
    }

    @Test
    void updateKeepingSameUsernameAndEmailSkipsUniquenessCheck() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(user));

        UserDto dto = userService.update(1L, new UserUpdateRequest("jade", "jade@ynov.com", null));

        assertThat(dto.username()).isEqualTo("jade");
        verify(usersRepository, never()).existsByUsername(any());
        verify(usersRepository, never()).existsByEmail(any());
    }

    @Test
    void updateRejectsTakenUsername() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(user));
        when(usersRepository.existsByUsername("taken")).thenReturn(true);

        assertThatThrownBy(() -> userService.update(1L, new UserUpdateRequest("taken", "jade@ynov.com", null)))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Username already taken");
    }

    @Test
    void updateRejectsTakenEmail() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(user));
        when(usersRepository.existsByEmail("taken@ynov.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.update(1L, new UserUpdateRequest("jade", "taken@ynov.com", null)))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Email already used");
    }

    @Test
    void updatePasswordEncodesNewPassword() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("old", "hashed")).thenReturn(true);
        when(passwordEncoder.encode("newpassword")).thenReturn("newhash");

        userService.updatePassword(1L, new PasswordUpdateRequest("old", "newpassword"));

        assertThat(user.getPassword()).isEqualTo("newhash");
    }

    @Test
    void updatePasswordRejectsWrongCurrentPassword() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> userService.updatePassword(1L, new PasswordUpdateRequest("wrong", "newpassword")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThat(user.getPassword()).isEqualTo("hashed");
    }

    @Test
    void deleteRemovesUserWhenPasswordMatches() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "hashed")).thenReturn(true);

        userService.delete(1L, new DeleteAccountRequest("secret123"));

        verify(usersRepository).delete(user);
    }

    @Test
    void deleteRejectsWrongPassword() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> userService.delete(1L, new DeleteAccountRequest("wrong")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(usersRepository, never()).delete(any());
    }
}
