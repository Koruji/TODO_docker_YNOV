package com.todo.services;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import com.todo.dto.TaskRequest;
import com.todo.dto.TaskResponse;
import com.todo.dto.TaskSearchCriteria;
import com.todo.exceptions.ResourceNotFoundException;
import com.todo.models.Tasks;
import com.todo.models.Users;
import com.todo.repositories.TasksRepository;
import com.todo.repositories.UsersRepository;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TasksRepository tasksRepository;
    @Mock
    private UsersRepository usersRepository;
    @InjectMocks
    private TaskService taskService;

    private Users owner;
    private Users other;

    @BeforeEach
    void setUp() {
        owner = new Users("jade", "jade@ynov.com", "hashed");
        ReflectionTestUtils.setField(owner, "id", 1L);
        other = new Users("tom", "tom@ynov.com", "hashed");
        ReflectionTestUtils.setField(other, "id", 2L);
    }

    private Tasks task(long id, Users user) {
        Tasks task = new Tasks("Label " + id, "Description " + id, user);
        ReflectionTestUtils.setField(task, "id", id);
        return task;
    }

    private TaskRequest request(LocalDate start, LocalDate end, Long collaboratorId, Boolean done) {
        return new TaskRequest("Réviser", "Docker", start, end, "Maison", 2, collaboratorId, done);
    }

    @Test
    void findAllByUserMapsTasks() {
        when(tasksRepository.findByUserId(1L)).thenReturn(List.of(task(10, owner), task(11, owner)));

        List<TaskResponse> result = taskService.findAllByUser(1L);

        assertThat(result).extracting(TaskResponse::id).containsExactly(10L, 11L);
    }

    @Test
    void findByIdReturnsOwnedTask() {
        when(tasksRepository.findById(10L)).thenReturn(Optional.of(task(10, owner)));

        assertThat(taskService.findById(10L, 1L).label()).isEqualTo("Label 10");
    }

    @Test
    void findByIdHidesTaskOfAnotherUser() {
        when(tasksRepository.findById(10L)).thenReturn(Optional.of(task(10, other)));

        assertThatThrownBy(() -> taskService.findById(10L, 1L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Task 10 not found");
    }

    @Test
    void findByIdThrowsWhenMissing() {
        when(tasksRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.findById(404L, 1L)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void createSavesTaskForUser() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(tasksRepository.save(any(Tasks.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse response = taskService.create(1L,
                request(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 5), null, null));

        ArgumentCaptor<Tasks> saved = ArgumentCaptor.forClass(Tasks.class);
        verify(tasksRepository).save(saved.capture());
        assertThat(saved.getValue().getUser()).isSameAs(owner);
        assertThat(saved.getValue().getStartDate()).isEqualTo(LocalDate.of(2026, 10, 1));
        assertThat(saved.getValue().getLevel()).isEqualTo(2);
        assertThat(saved.getValue().isDone()).isFalse();
        assertThat(response.label()).isEqualTo("Réviser");
        assertThat(response.collaborator()).isNull();
    }

    @Test
    void createWithCollaboratorAttachesCollaborator() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(usersRepository.findById(2L)).thenReturn(Optional.of(other));
        when(tasksRepository.save(any(Tasks.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse response = taskService.create(1L, request(null, null, 2L, null));

        assertThat(response.collaborator().id()).isEqualTo(2L);
    }

    @Test
    void createFailsWhenCollaboratorMissing() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(usersRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.create(1L, request(null, null, 99L, null)))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Collaborator 99 not found");
        verify(tasksRepository, never()).save(any());
    }

    @Test
    void createFailsWhenUserMissing() {
        when(usersRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.create(1L, request(null, null, null, null)))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("User 1 not found");
    }

    @Test
    void createRejectsEndDateBeforeStartDate() {
        assertThatThrownBy(() -> taskService.create(1L,
                request(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 1), null, null)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(tasksRepository, never()).save(any());
    }

    @Test
    void createMarkedDoneSetsDoneAtToday() {
        when(usersRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(tasksRepository.save(any(Tasks.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskResponse response = taskService.create(1L, request(null, null, null, true));

        assertThat(response.done()).isTrue();
        assertThat(response.doneAt()).isEqualTo(LocalDate.now());
    }

    @Test
    void updateChangesFieldsOfOwnedTask() {
        Tasks existing = task(10, owner);
        when(tasksRepository.findById(10L)).thenReturn(Optional.of(existing));

        TaskResponse response = taskService.update(10L, 1L,
                request(LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 3), null, null));

        assertThat(response.label()).isEqualTo("Réviser");
        assertThat(existing.getDescription()).isEqualTo("Docker");
        assertThat(existing.getPlace()).isEqualTo("Maison");
        assertThat(existing.getEndDate()).isEqualTo(LocalDate.of(2026, 10, 3));
    }

    @Test
    void updateMarkingDoneSetsDoneAtAndUnmarkingClearsIt() {
        Tasks existing = task(10, owner);
        when(tasksRepository.findById(10L)).thenReturn(Optional.of(existing));

        taskService.update(10L, 1L, request(null, null, null, true));
        assertThat(existing.isDone()).isTrue();
        assertThat(existing.getDoneAt()).isEqualTo(LocalDate.now());

        taskService.update(10L, 1L, request(null, null, null, false));
        assertThat(existing.isDone()).isFalse();
        assertThat(existing.getDoneAt()).isNull();
    }

    @Test
    void updateWithoutDoneKeepsDoneState() {
        Tasks existing = task(10, owner);
        existing.setDone(true);
        existing.setDoneAt(LocalDate.of(2026, 10, 1));
        when(tasksRepository.findById(10L)).thenReturn(Optional.of(existing));

        taskService.update(10L, 1L, request(null, null, null, null));

        assertThat(existing.isDone()).isTrue();
        assertThat(existing.getDoneAt()).isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test
    void updateRejectsTaskOfAnotherUser() {
        when(tasksRepository.findById(10L)).thenReturn(Optional.of(task(10, other)));

        assertThatThrownBy(() -> taskService.update(10L, 1L, request(null, null, null, null)))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void updateRejectsEndDateBeforeStartDate() {
        assertThatThrownBy(() -> taskService.update(10L, 1L,
                request(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 1), null, null)))
                .isInstanceOf(ResponseStatusException.class);
        verify(tasksRepository, never()).findById(any());
    }

    @Test
    void deleteRemovesOwnedTask() {
        Tasks existing = task(10, owner);
        when(tasksRepository.findById(10L)).thenReturn(Optional.of(existing));

        taskService.delete(10L, 1L);

        verify(tasksRepository).delete(existing);
    }

    @Test
    void deleteRejectsTaskOfAnotherUser() {
        when(tasksRepository.findById(10L)).thenReturn(Optional.of(task(10, other)));

        assertThatThrownBy(() -> taskService.delete(10L, 1L)).isInstanceOf(ResourceNotFoundException.class);
        verify(tasksRepository, never()).delete(any(Tasks.class));
    }

    @Test
    void setReminderTogglesFlag() {
        Tasks existing = task(10, owner);
        when(tasksRepository.findById(10L)).thenReturn(Optional.of(existing));

        TaskResponse enabled = taskService.setReminder(10L, 1L, true);
        assertThat(enabled.reminder()).isTrue();
        assertThat(existing.isReminder()).isTrue();

        TaskResponse disabled = taskService.setReminder(10L, 1L, false);
        assertThat(disabled.reminder()).isFalse();
    }

    @Test
    void setReminderRejectsTaskOfAnotherUser() {
        when(tasksRepository.findById(10L)).thenReturn(Optional.of(task(10, other)));

        assertThatThrownBy(() -> taskService.setReminder(10L, 1L, true))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void searchRejectsEndDateBeforeStartDate() {
        TaskSearchCriteria criteria = new TaskSearchCriteria(null, LocalDate.of(2026, 10, 5),
                LocalDate.of(2026, 10, 1), null, null, null);

        assertThatThrownBy(() -> taskService.search(1L, criteria))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void searchMapsRepositoryResults() {
        when(tasksRepository.findAll(ArgumentMatchers.<Specification<Tasks>>any(), any(Sort.class)))
                .thenReturn(List.of(task(10, owner), task(11, owner)));

        List<TaskResponse> result = taskService.search(1L,
                new TaskSearchCriteria("doc", null, null, null, null, null));

        assertThat(result).extracting(TaskResponse::id).containsExactly(10L, 11L);
    }

    @Test
    void findPlacesRemovesDuplicatesIgnoringCaseAndSorts() {
        when(tasksRepository.findDistinctPlacesByUserId(1L))
                .thenReturn(List.of("maison", "YNOV", "Maison", "  ", "bibliothèque", " Ynov "));

        List<String> places = taskService.findPlaces(1L);

        assertThat(places).containsExactly("bibliothèque", "maison", "YNOV");
    }

    @Test
    void findRemindersKeepsOnlyTasksWithReminder() {
        Tasks withReminder = task(10, owner);
        withReminder.setReminder(true);
        Tasks withoutReminder = task(11, owner);
        when(tasksRepository.findAll(ArgumentMatchers.<Specification<Tasks>>any(), any(Sort.class)))
                .thenReturn(List.of(withReminder, withoutReminder));

        List<TaskResponse> result = taskService.findReminders(1L, LocalDate.of(2026, 10, 29));

        assertThat(result).extracting(TaskResponse::id).containsExactly(10L);
    }
}
