package com.todo.services;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.todo.dto.AuthResponse;
import com.todo.dto.LoginRequest;
import com.todo.dto.UserDto;
import com.todo.models.Users;
import com.todo.repositories.UsersRepository;

@Service
public class AuthService {

    private final UsersRepository usersRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UsersRepository usersRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.usersRepository = usersRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        // Même message que l'email soit inconnu ou le mot de passe faux, pour ne rien révéler
        Users user = usersRepository.findByEmail(request.email())
                .filter(u -> passwordEncoder.matches(request.password(), u.getPassword()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        return new AuthResponse(jwtService.generateToken(user), UserDto.from(user));
    }
}
