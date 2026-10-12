package com.todo.repositories;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.todo.models.Tasks;

public interface TasksRepository extends JpaRepository<Tasks, Long>, JpaSpecificationExecutor<Tasks> {
    List<Tasks> findByUserId(Long userId);

    List<Tasks> findByCollaboratorId(Long collaboratorId);

    List<Tasks> findByUserIdAndLevel(Long userId, Integer level);

    @Query("select distinct t.place from Tasks t where t.user.id = :userId and t.place is not null and t.place <> '' order by t.place")
    List<String> findDistinctPlacesByUserId(@Param("userId") Long userId);

    @Query("select new com.todo.repositories.DayCount(t.createdAt, count(t)) from Tasks t "
            + "where t.user.id = :userId and t.createdAt between :from and :to group by t.createdAt")
    List<DayCount> countCreatedByDay(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select new com.todo.repositories.DayCount(t.doneAt, count(t)) from Tasks t "
            + "where t.user.id = :userId and t.done = true and t.doneAt between :from and :to group by t.doneAt")
    List<DayCount> countDoneByDay(@Param("userId") Long userId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
