package com.todo.controllers;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import com.todo.dto.AuthResponse;
import com.todo.dto.LoginRequest;
import com.todo.dto.RegisterRequest;
import com.todo.dto.UserDto;
import com.todo.services.AuthService;
import com.todo.services.UserService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserService userService;
    private final AuthService authService;

    public AuthController(UserService userService, AuthService authService) {
        this.userService = userService;
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto register(@Valid @RequestBody RegisterRequest request) {
        return userService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }
}
