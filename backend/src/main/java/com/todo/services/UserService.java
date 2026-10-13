package com.todo.services;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.todo.dto.PasswordUpdateRequest;
import com.todo.dto.RegisterRequest;
import com.todo.dto.UserDto;
import com.todo.dto.UserUpdateRequest;
import com.todo.exceptions.ConflictException;
import com.todo.exceptions.ResourceNotFoundException;
import com.todo.models.Users;
import com.todo.repositories.UsersRepository;

@Service
public class UserService {

    private final UsersRepository usersRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UsersRepository usersRepository, PasswordEncoder passwordEncoder) {
        this.usersRepository = usersRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserDto register(RegisterRequest request) {
        if (usersRepository.existsByUsername(request.username())) {
            throw new ConflictException("Username already taken");
        }
        if (usersRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email already used");
        }

        Users user = new Users(
                request.username(),
                request.email(),
                passwordEncoder.encode(request.password()));
        return UserDto.from(usersRepository.save(user));
    }

    @Transactional(readOnly = true)
    public UserDto findById(Long userId) {
        return UserDto.from(getUser(userId));
    }

    @Transactional
    public UserDto update(Long userId, UserUpdateRequest request) {
        Users user = getUser(userId);

        if (!user.getUsername().equals(request.username())
                && usersRepository.existsByUsername(request.username())) {
            throw new ConflictException("Username already taken");
        }
        if (!user.getEmail().equals(request.email())
                && usersRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email already used");
        }

        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setProfilePicture(request.profilePicture());
        return UserDto.from(user);
    }

    @Transactional
    public void updatePassword(Long userId, PasswordUpdateRequest request) {
        Users user = getUser(userId);
        // 400 et non 401 : un 401 déconnecterait le frontend alors que la session est valide
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
    }

    @Transactional
    public void delete(Long userId) {
        usersRepository.delete(getUser(userId));
    }

    private Users getUser(Long userId) {
        return usersRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User " + userId + " not found"));
    }
}
