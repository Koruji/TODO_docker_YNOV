package com.todo.services;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.todo.dto.DailyActivity;
import com.todo.repositories.DayCount;
import com.todo.repositories.TasksRepository;

@ExtendWith(MockitoExtension.class)
class StatsServiceTest {

    private static final LocalDate FROM = LocalDate.of(2026, 10, 1);
    private static final LocalDate TO = LocalDate.of(2026, 10, 31);

    @Mock
    private TasksRepository tasksRepository;
    @InjectMocks
    private StatsService statsService;

    @Test
    void mergesCreatedAndDoneCountsByDaySortedByDate() {
        when(tasksRepository.countCreatedByDay(1L, FROM, TO)).thenReturn(List.of(
                new DayCount(LocalDate.of(2026, 10, 3), 2),
                new DayCount(LocalDate.of(2026, 10, 1), 1)));
        when(tasksRepository.countDoneByDay(1L, FROM, TO)).thenReturn(List.of(
                new DayCount(LocalDate.of(2026, 10, 3), 4),
                new DayCount(LocalDate.of(2026, 10, 10), 5)));

        List<DailyActivity> result = statsService.activity(1L, FROM, TO);

        assertThat(result).containsExactly(
                new DailyActivity(LocalDate.of(2026, 10, 1), 1, 0),
                new DailyActivity(LocalDate.of(2026, 10, 3), 2, 4),
                new DailyActivity(LocalDate.of(2026, 10, 10), 0, 5));
    }

    @Test
    void returnsEmptyListWhenNoActivity() {
        when(tasksRepository.countCreatedByDay(1L, FROM, TO)).thenReturn(List.of());
        when(tasksRepository.countDoneByDay(1L, FROM, TO)).thenReturn(List.of());

        assertThat(statsService.activity(1L, FROM, TO)).isEmpty();
    }

    @Test
    void acceptsSingleDayRange() {
        when(tasksRepository.countCreatedByDay(1L, FROM, FROM)).thenReturn(List.of(new DayCount(FROM, 3)));
        when(tasksRepository.countDoneByDay(1L, FROM, FROM)).thenReturn(List.of());

        assertThat(statsService.activity(1L, FROM, FROM)).containsExactly(new DailyActivity(FROM, 3, 0));
    }

    @Test
    void acceptsRangeOfExactlyMaxDays() {
        LocalDate to = FROM.plusDays(366);
        when(tasksRepository.countCreatedByDay(1L, FROM, to)).thenReturn(List.of());
        when(tasksRepository.countDoneByDay(1L, FROM, to)).thenReturn(List.of());

        assertThat(statsService.activity(1L, FROM, to)).isEmpty();
    }

    @Test
    void rejectsToBeforeFrom() {
        assertThatThrownBy(() -> statsService.activity(1L, TO, FROM))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(ex.getReason()).isEqualTo("to must not be before from");
                });
        verifyNoInteractions(tasksRepository);
    }

    @Test
    void rejectsRangeLongerThanMaxDays() {
        assertThatThrownBy(() -> statsService.activity(1L, FROM, FROM.plusDays(367)))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(ex.getReason()).isEqualTo("range must not exceed 366 days");
                });
        verifyNoInteractions(tasksRepository);
    }
}
