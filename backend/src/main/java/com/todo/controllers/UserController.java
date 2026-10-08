package com.todo.controllers;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import com.todo.dto.UserDto;
import com.todo.dto.UserUpdateRequest;
import com.todo.services.UserService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/users/me")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public UserDto me(@AuthenticationPrincipal Jwt jwt) {
        return userService.findById(userId(jwt));
    }

    @PutMapping
    public UserDto update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UserUpdateRequest request) {
        return userService.update(userId(jwt), request);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt) {
        userService.delete(userId(jwt));
    }

    private Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
