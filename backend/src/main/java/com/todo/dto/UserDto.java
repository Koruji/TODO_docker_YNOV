package com.todo.dto;

import com.todo.models.Users;

public record UserDto(
    Long id,
    String username,
    String profilePicture
) {
    public static UserDto from(Users u) {
        return new UserDto(u.getId(), u.getUsername(), u.getProfilePicture());
    }
}
