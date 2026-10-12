package com.todo.repositories;

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
}
