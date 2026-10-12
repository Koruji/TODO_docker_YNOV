package com.todo.repositories;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.todo.models.Tasks;

public interface TasksRepository extends JpaRepository<Tasks, Long>, JpaSpecificationExecutor<Tasks> {
    List<Tasks> findByUserId(Long userId);

    List<Tasks> findByCollaboratorId(Long collaboratorId);

    List<Tasks> findByUserIdAndLevel(Long userId, Integer level);
}
