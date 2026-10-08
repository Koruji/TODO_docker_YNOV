package com.todo.services;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.todo.dto.TaskRequest;
import com.todo.dto.TaskResponse;
import com.todo.exceptions.ResourceNotFoundException;
import com.todo.models.Tasks;
import com.todo.models.Users;
import com.todo.repositories.*;

@Service
public class TaskService {

    private final TasksRepository tasksRepository;
    private final UsersRepository usersRepository;

    public TaskService(TasksRepository tasksRepository, UsersRepository usersRepository) {
        this.tasksRepository = tasksRepository;
        this.usersRepository = usersRepository;
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> findAllByUser(Long userId) {
        return tasksRepository.findByUserId(userId).stream()
                .map(TaskResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskResponse findById(Long taskId, Long userId) {
        return TaskResponse.from(getOwnedTask(taskId, userId));
    }

    @Transactional
    public TaskResponse create(Long userId, TaskRequest request) {
        checkDates(request);
        Users user = usersRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User " + userId + " not found"));

        Tasks task = new Tasks(request.label(), request.description(), user);
        apply(task, request);
        return TaskResponse.from(tasksRepository.save(task));
    }

    @Transactional
    public TaskResponse update(Long taskId, Long userId, TaskRequest request) {
        checkDates(request);
        Tasks task = getOwnedTask(taskId, userId);

        task.setLabel(request.label());
        task.setDescription(request.description());
        apply(task, request);
        return TaskResponse.from(task);
    }

    @Transactional
    public void delete(Long taskId, Long userId) {
        tasksRepository.delete(getOwnedTask(taskId, userId));
    }

    private void apply(Tasks task, TaskRequest request) {
        task.setStartDate(request.startDate());
        task.setEndDate(request.endDate());
        task.setPlace(request.place());
        task.setLevel(request.level());
        task.setCollaborator(findCollaborator(request.collaboratorId()));
    }

    private Users findCollaborator(Long collaboratorId) {
        if (collaboratorId == null) {
            return null;
        }
        return usersRepository.findById(collaboratorId)
                .orElseThrow(() -> new ResourceNotFoundException("Collaborator " + collaboratorId + " not found"));
    }

    private Tasks getOwnedTask(Long taskId, Long userId) {
        return tasksRepository.findById(taskId)
                .filter(t -> t.getUser().getId().equals(userId))
                .orElseThrow(() -> new ResourceNotFoundException("Task " + taskId + " not found"));
    }

    private void checkDates(TaskRequest request) {
        if (request.startDate() != null && request.endDate() != null
                && request.endDate().isBefore(request.startDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endDate must not be before startDate");
        }
    }
}
