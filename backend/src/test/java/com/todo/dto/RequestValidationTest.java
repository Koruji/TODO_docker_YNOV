package com.todo.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Set;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

class RequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void init() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void close() {
        factory.close();
    }

    private static <T> Set<String> invalidFields(T target) {
        return validator.validate(target).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(Object::toString)
                .collect(java.util.stream.Collectors.toSet());
    }

    @Test
    void validRegisterRequestHasNoViolation() {
        assertThat(invalidFields(new RegisterRequest("jade", "jade@ynov.com", "secret123"))).isEmpty();
    }

    @Test
    void registerRejectsBlankUsernameInvalidEmailAndShortPassword() {
        assertThat(invalidFields(new RegisterRequest(" ", "not-an-email", "short")))
                .containsExactlyInAnyOrder("username", "email", "password");
    }

    @Test
    void registerRejectsTooLongUsernameAndPassword() {
        assertThat(invalidFields(new RegisterRequest("a".repeat(51), "jade@ynov.com", "p".repeat(73))))
                .containsExactlyInAnyOrder("username", "password");
    }

    @Test
    void loginRejectsMissingFields() {
        assertThat(invalidFields(new LoginRequest(null, ""))).containsExactlyInAnyOrder("email", "password");
    }

    @Test
    void validTaskRequestHasNoViolation() {
        TaskRequest request = new TaskRequest("Label", "Description", LocalDate.of(2026, 10, 1),
                LocalDate.of(2026, 10, 2), "Maison", 3, null, false);

        assertThat(invalidFields(request)).isEmpty();
    }

    @Test
    void taskRejectsBlankLabelAndDescription() {
        assertThat(invalidFields(new TaskRequest("", " ", null, null, null, null, null, null)))
                .containsExactlyInAnyOrder("label", "description");
    }

    @Test
    void taskRejectsLevelOutOfRange() {
        assertThat(invalidFields(new TaskRequest("L", "D", null, null, null, -1, null, null))).containsExactly("level");
        assertThat(invalidFields(new TaskRequest("L", "D", null, null, null, 4, null, null))).containsExactly("level");
    }

    @Test
    void taskRejectsTooLongPlace() {
        assertThat(invalidFields(new TaskRequest("L", "D", null, null, "x".repeat(256), 1, null, null)))
                .containsExactly("place");
    }

    @Test
    void passwordUpdateRejectsShortNewPassword() {
        assertThat(invalidFields(new PasswordUpdateRequest("old", "short"))).containsExactly("newPassword");
    }

    @Test
    void userUpdateRejectsInvalidEmailAndTooLongPicture() {
        assertThat(invalidFields(new UserUpdateRequest("jade", "nope", "p".repeat(501))))
                .containsExactlyInAnyOrder("email", "profilePicture");
    }
}
