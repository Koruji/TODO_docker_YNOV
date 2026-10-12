package com.todo.repositories;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.data.jpa.domain.Specification;

import com.todo.dto.TaskSearchCriteria;
import com.todo.models.Tasks;

import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;

/** Construit la requête de recherche : chaque critère renseigné ajoute une condition. */
public final class TaskSpecifications {

    private TaskSpecifications() {}

    public static Specification<Tasks> matching(Long userId, TaskSearchCriteria c) {
        return (root, query, cb) -> {
            List<Predicate> where = new ArrayList<>();

            // Toujours : uniquement les tâches de l'utilisateur connecté
            where.add(cb.equal(root.get("user").get("id"), userId));

            if (hasText(c.q())) {
                String pattern = "%" + escapeLike(c.q().trim().toLowerCase(Locale.ROOT)) + "%";
                where.add(cb.or(
                    cb.like(cb.lower(root.get("label")), pattern, '\\'),
                    cb.like(cb.lower(root.get("description")), pattern, '\\'),
                    cb.like(cb.lower(root.get("place")), pattern, '\\')));
            }

            // Une tâche couvre la période [début, fin] ; si une seule date existe, elle sert aux deux bornes.
            // Une tâche sans aucune date ne passe pas dès qu'une date est demandée (comparaison NULL = faux).
            Expression<LocalDate> taskStart = cb.coalesce(root.<LocalDate>get("startDate"), root.<LocalDate>get("endDate"));
            Expression<LocalDate> taskEnd = cb.coalesce(root.<LocalDate>get("endDate"), root.<LocalDate>get("startDate"));
            if (c.startDate() != null) where.add(cb.greaterThanOrEqualTo(taskEnd, c.startDate()));
            if (c.endDate() != null) where.add(cb.lessThanOrEqualTo(taskStart, c.endDate()));

            if (hasText(c.place())) {
                where.add(cb.equal(cb.lower(root.get("place")), c.place().trim().toLowerCase(Locale.ROOT)));
            }

            if (c.levels() != null && !c.levels().isEmpty()) {
                where.add(root.get("level").in(c.levels()));
            }

            if (c.done() != null) {
                where.add(cb.equal(root.get("done"), c.done()));
            }

            return cb.and(where.toArray(Predicate[]::new));
        };
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    // % et _ saisis par l'utilisateur doivent être cherchés tels quels
    private static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
